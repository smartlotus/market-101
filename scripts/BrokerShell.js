/**
 * BrokerShell —— 宿主的**唯一宿主 Node**（Stage 0 五区域 + Stage 1 线性互动层）。
 *
 * 职责边界（见 plan.md / .vibegame/spec/guides/market-101-architecture.md）：
 *   - 纯游戏逻辑全在 scripts/sim/*（普通 JS，不继承 Node，可被 eval 直接断言）
 *   - 章节状态机全在 scripts/chapter/*（纯 JS，经注入端口访问市场层）
 *   - 视图层：五区域 scripts/ui/*、章节三层 scripts/ui/chapter/*
 *   - 本类只做四件事：加载数据、持有 `MarketSim` 与 `ChapterRuntime`、**把每一层接起来**、
 *     把状态渲染进 DOM
 *   - 唯一的 `runtimeState()` 在这里：`{ ...sim.snapshot(), chapter }`（只增不改，plan 决策 7）
 *
 * 层的接线（plan「分层与落点」）：
 *   ShellRoot（五区域 + 开户门 + 展示模式）
 *   ChapterRoot（场景层 / 对话层 / 常驻卡层 / 词典）—— 挂 ui.root
 *   ChapterOverlay（面板层，真暂停）—— 场景里的 Node，由本类找出并交给 ChapterRoot
 *
 * 存档（plan 决策 6）：读存档 → 建 sim → 建 runtime → **先恢复世界、再恢复章节**。
 * 顺序不可反：`ChapterRuntime` 构造时会做一次「章内进场清残留」（PRD §3.7），
 * 若先恢复世界会被清掉；`loadFrom` 只回到节拍起点，不再清任何东西。
 *
 * 测试钩子（白盒驱动面）：
 *   Stage 0 六个：advanceDay / submitOrder / reset / selectInstrument / devSetEvent / devDrawEvent
 *   章节：chapter*（Ack / Answer / Read / Select / ClosePanel / GiveUp / Confirm / SetMode /
 *         EndPhase / ExtraStep / CompleteExtra / OpenPanel / Match / FlowStep）与 setMuted / toggleMute /
 *         callMentor / openDictionary / openMentorHistory / toggleProactive /
 *         openProgress / openNavStanding /
 *         resetAccount / topUpCapital / resetChapterProgress
 *   确定性 dev：devGotoBeat / devGotoChapter / devSatisfy / devInjectRatingInputs / devForceGrade /
 *         devAdvanceDay / devTopUpCapital / devSkipToSandbox / devSetChapterGrades
 */

import { Node } from '../engine/Node.js'
import { fetchJson } from '../engine/url.js'
import MarketSim from './sim/market.js'
import { QUOTE_PARAMS } from './sim/quote.js'
import { LOT_SIZE, PRICE_TICK, computeFee, roundMoney } from './sim/fees.js'
import ChapterRuntime from './chapter/runtime.js'
import MentorScheduler from './chapter/mentor.js'
import SaveStore, { DEFAULT_SAVE_KEY } from './chapter/saveStore.js'
import ShellRoot from './ui/ShellRoot.js'
import ChapterRoot from './ui/chapter/ChapterRoot.js'
import TopBarView from './ui/TopBarView.js'
import WatchlistView from './ui/WatchlistView.js'
import QuoteView from './ui/QuoteView.js'
import OrderPanelView from './ui/OrderPanelView.js'
import PositionsView from './ui/PositionsView.js'
import MentorView from './ui/MentorView.js'
import { fmtMoney } from './ui/kit.js'

export default class BrokerShell extends Node {
  constructor() {
    super()
    this.sim = null
    this.chapter = null
    this.runtimePort = null
    this.chapterRoot = null
    this.overlay = null
    this.shell = null
    this.saveStore = null
    this.chaptersDoc = null
    this.conceptsDoc = null
    this.instruments = []
    this.events = []
    this.views = {}
    this._hintsSignature = null
    this._refreshing = false
  }

  async ready() {
    const cfg = this.config || {}
    const [instrumentsDoc, eventsDoc, chaptersDoc, conceptsDoc] = await Promise.all([
      fetchJson(cfg.instrumentsPath || 'config/instruments.json'),
      fetchJson(cfg.eventsPath || 'config/events.json'),
      fetchJson(cfg.chaptersPath || 'config/chapters.json'),
      fetchJson(cfg.conceptsPath || 'config/concepts.json'),
    ])
    this.instruments = Array.isArray(instrumentsDoc.instruments) ? instrumentsDoc.instruments : []
    this.events = Array.isArray(eventsDoc.events) ? eventsDoc.events : []
    this.chaptersDoc = chaptersDoc
    this.conceptsDoc = conceptsDoc

    // 开局不进入第一个交易日会话：章内由节拍 1.3 入金后的 beginFirstDay() 开启（PRD §2.1）。
    this.sim = new MarketSim({
      instruments: this.instruments,
      events: this.events,
      config: {
        initialCash: cfg.initialCash ?? 100000,
        startDate: cfg.startDate ?? '2026-01-05',
        historyBars: cfg.historyBars ?? 30,
        defaultInstrumentId: cfg.defaultInstrumentId ?? (this.instruments[0] && this.instruments[0].id),
        autoEnterFirstDay: false,
      },
    })

    this.saveStore = new SaveStore({ key: cfg.saveKey || DEFAULT_SAVE_KEY })
    const saved = this.saveStore.read()

    this.chapter = new ChapterRuntime({
      chapters: this.chaptersDoc,
      mentor: new MentorScheduler(),
      sim: this.sim,
      saveStore: this.saveStore,
      config: {
        // 初始本金（唯一来源 = scene config）：结业评定的分母与净值曲线的参考线都读它，
        // 章节层与 `standing.js` 都不写字面量。
        initialCapital: Number(cfg.initialCash ?? 100000),
        canAfford: (instrumentId) => this._canAffordOneLot(instrumentId),
        marketChanges: () => this._marketChanges(),
        // 节拍声明的 `forceEvent` 钉到下一次开市推进（第五章把 M03 钉在 5.5）
        pinNextEvent: (eventId) => this.sim.pinDirectedEvent(eventId),
        // 尾声的「什么都不做的自己」推算需要游戏内经过的天数
        dayIndex: () => this.sim.calendar.dayIndex,
      },
    })
    if (saved) {
      this.sim.loadFrom(saved.world)
      this.chapter.loadFrom(saved.chapter)
    }

    this.shell = new ShellRoot(this.sceneTree.ui)
    this.overlay = this._findOverlay()
    this._buildViews(cfg)
    this.runtimePort = this._createRuntimePort()
    this.chapterRoot = new ChapterRoot(this.sceneTree.ui, {
      runtime: this.runtimePort,
      overlay: this.overlay,
      chapters: this.chaptersDoc,
      concepts: this.conceptsDoc,
      instruments: this.instruments,
    })
    this._bindOverlayEvents()
    this.refresh()
  }

  /**
   * 交给章节层的 `runtime` 端口。
   *
   * 章节层（对话层 / 场景层 / 面板层 / 常驻卡）的控件回调直连运行时 —— 这正是
   * 「DOM 回调与 eval 钩子走同一条路径」的结构性保证，本任务**不能**把它拆成两套。
   * 但章节层只重绘自己，五区域壳不会跟着更新（例如对话层点了「开始」→ 节拍变 1.1，
   * 场景层要换上银行大厅；面板层读了条目 → 交易面板要重算）。
   *
   * 因此宿主再包一层：**只**在会改变运行时状态的调用后触发一次全壳重绘。
   * `notePanelPause` / `noteNav` 这类「被读取时回报」的调用**故意不在触发集合里** ——
   * 前者由 `update()` 内部回报，若触发重绘就会递归。
   */
  _createRuntimePort() {
    const target = this.chapter
    const shell = this
    const MUTATORS = new Set([
      'chapterAck', 'chapterAnswer', 'chapterRead', 'chapterSelect', 'closePanel', 'openPanel',
      'chapterMatch', 'chapterFlowStep', 'chapterBuyOption',
      'giveUp', 'setMode', 'setMuted', 'setProactiveEnabled', 'callMentor', 'advanceEndPhase',
      'advanceExtraStep', 'completeExtraSegment', 'confirmChapter', 'resetChapterProgress',
      'devTopUpCapital', 'devGotoBeat', 'devGotoChapter', 'devSatisfy', 'devInjectRatingInputs', 'devAdvanceDay',
    ])
    return new Proxy(target, {
      get(obj, prop) {
        const value = obj[prop]
        if (typeof value !== 'function') return value
        const bound = value.bind(obj)
        if (!MUTATORS.has(prop)) return bound
        return (...args) => {
          const result = bound(...args)
          shell.refresh()
          return result
        }
      },
    })
  }

  // === 层与层之间的接线 ===

  _findOverlay() {
    const found = this.findByTag('overlay')
    const list = Array.isArray(found) ? found : found ? [found] : []
    return list[0] || null
  }

  /** 对话层的「我暂时不想试」会在运行时代为演示一次拒单；回放由宿主执行（视图不复制撮合逻辑）。 */
  _bindOverlayEvents() {
    const root = this.sceneTree.ui && this.sceneTree.ui.root
    if (!root) return
    this._onGiveUpDemo = (event) => this.replayGiveUpDemo(event && event.detail)
    root.addEventListener('chapter-giveup-demo', this._onGiveUpDemo)
  }

  _buildViews(cfg) {
    const ui = this.sceneTree.ui
    const s = this.shell
    const params = QUOTE_PARAMS.A_SHARE
    const shared = { instruments: this.instruments }
    const hints = this._chapterHints(this.chapter.snapshot().chapterId)

    this.views.topBar = new TopBarView(s.topbarEl, ui, cfg)
    this.views.watchlist = new WatchlistView(s.watchEl, ui, { ...shared, hints })
    this.views.quote = new QuoteView(s.midEl, ui, {
      ...shared,
      params,
      klinesFor: (id) => this.sim.klinesFor(id),
    })
    this.views.order = new OrderPanelView(s.ticketEl, ui, {
      ...shared,
      slippagePct: params.slippagePct,
      hints,
    })
    this.views.positions = new PositionsView(s.positionsEl, ui, shared)
    this.views.mentor = new MentorView(s.mentorEl, ui, {
      rejectMentorLines: cfg.rejectMentorLines || {},
    })

    // 顶栏：进入下一交易日 / 重置账户 / 全局菜单五件事（PRD §3.2 / §4 / §3.6）
    this.views.topBar.onAdvance = () => this.advanceDay()
    this.views.topBar.onReset = () => this.resetAccount()
    this.views.topBar.onResetChapter = () => this.resetChapterProgress()
    this.views.topBar.onSetMode = (mode) => this.setMode(mode)
    this.views.topBar.onToggleMute = () => this.toggleMute()
    this.views.topBar.onOpenDictionary = () => this.openDictionary()
    this.views.topBar.onOpenMentorHistory = () => this.openMentorHistory()
    this.views.topBar.onOpenProgress = () => this.openProgress()
    this.views.topBar.onOpenNavStanding = () => this.openNavStanding()
    this.views.topBar.onToggleProactive = () => this.toggleProactive()
    // 自选列表：点选 = 玩家动作（`chapterSelect` 会打上 `selectTouched`，默认高亮不再拉回）
    this.views.watchlist.onSelect = (id) => this.selectInstrument(id)
    // 下单面板：提交走唯一入口 `submitOrder`；「回到买得起的那只」只改选中标的，不动数量
    this.views.order.onSubmit = (spec) => this.submitOrder(spec)
    this.views.order.onPickAffordable = () => this.selectCheapestAffordable()
  }

  /** 渲染入口：只在状态变化后调用（本 Node 无 update(dt)，DOM 不需要每帧重排） */
  refresh() {
    if (!this.sim || this._refreshing) return this.runtimeState()
    this._refreshing = true
    try {
      this._syncDefaultSelection()
      const state = this.runtimeState()
      this._syncShell(state)
      this._syncViewHints(state)
      for (const view of Object.values(this.views)) view.update?.(state)
      this.chapterRoot?.update(state)
      return state
    } finally {
      this._refreshing = false
    }
  }

  /**
   * 券商壳展示模式 = 节拍声明（`shellMode`）；`freeDay` / `sandbox` 一律全开，
   * 因为它们与 Stage 0 沙盒完全一致（PRD §3.2）—— 节拍声明不适用于这两种模式。
   */
  _syncShell(state) {
    const chapter = state.chapter || {}
    const mode = chapter.mode === 'chapter' ? chapter.shellMode : 'full'
    this.shell.setDisplayMode(mode)
    // 自由模式（尾声 E.4 之后）没有目标卡、也没有常驻侧栏 —— 把给侧栏预留的宽度还回行情区。
    // 只改一个 data 属性，具体宽度由 CSS 的 --rail-reserve 决定（布局数值不散落在 JS 里）。
    if (this.shell.el) this.shell.el.dataset.rail = chapter.mode === 'freeDay' ? 'off' : 'on'
    if (mode === 'openAccount') {
      this.shell.setGateContent(this._gateContent(state), (id) => this.chapterAck(id))
    }
  }

  /**
   * 开户门的按钮**由本拍数据派生**：`require[]` 里带 `simAction` 的 `interact` 条目
   * （1.2 开户 / 1.3 入金）。点它走的正是 `chapterAck` —— DOM 与 eval 钩子同一条路径。
   */
  _gateContent(state) {
    const chapter = state.chapter || {}
    const beat = chapter.beat || null
    const actions = ((beat && beat.require) || [])
      .filter((r) => r && r.kind === 'interact' && Array.isArray(r.simAction) && r.simAction.length)
      .map((r) => ({ id: r.id, label: r.label || r.id }))
    return {
      rows: [
        { label: '账户状态', value: state.accountOpened ? '已开户' : '未开户' },
        { label: '可用资金', value: fmtMoney(state.cash) },
      ],
      actions,
    }
  }

  /**
   * 本章的提示文案（`1 手约` 列标签 / 超资金提示 / 「回到买得起的那只」）。
   * 数据只在**本章首个需要它的节拍**上声明一次（第一章 = 1.4），而 1.5 的下单面板也要用，
   * 因此按「本章第一份 hints」取用，而不是按当前拍取（按拍取会让 1.5 拿不到）。
   */
  _chapterHints(chapterId) {
    const chapters = Array.isArray(this.chaptersDoc)
      ? this.chaptersDoc
      : (this.chaptersDoc && this.chaptersDoc.chapters) || []
    const ch = chapters.find((c) => Number(c.id) === Number(chapterId))
    for (const beat of (ch && ch.beats) || []) {
      if (beat && beat.hints) return beat.hints
    }
    return {}
  }

  /**
   * 提示文案只在 `chapter` 模式生效：`freeDay` / `sandbox` 与 Stage 0 沙盒完全一致
   * （PRD §3.2），节拍声明的 hints 不适用于它们。签名带模式，避免从 chapter 切到
   * sandbox 时因 chapterId 未变而漏掉清空。
   */
  _syncViewHints(state) {
    const chapter = state.chapter || {}
    const inChapter = chapter.mode === 'chapter'
    const signature = inChapter ? `ch:${chapter.chapterId}` : 'off'
    if (signature === this._hintsSignature) return
    this._hintsSignature = signature
    const hints = inChapter ? this._chapterHints(chapter.chapterId) : {}
    this.views.watchlist?.setHints?.(hints)
    this.views.order?.setHints?.(hints)
  }

  /**
   * 默认高亮 = 买得起的最低价款（PRD §3.4 缺陷修复 1）。
   * 仅当本拍有未满足的 `select(rule:'affordable')` 且玩家**还没点过**时执行；
   * 玩家点过之后（`selectTouched`）绝不拉回（Edge Case 1.4 / R6）。
   */
  _syncDefaultSelection() {
    if (this.chapter.mode !== 'chapter' || this.chapter.selectTouched) return null
    const beat = this.chapter.beatData()
    const requires = (beat && beat.require) || []
    const snapshot = this.chapter.snapshot()
    const pending = requires.some(
      (r) =>
        r &&
        r.kind === 'select' &&
        r.rule === 'affordable' &&
        (snapshot.beatRequirements || []).some((s) => s.id === r.id && !s.satisfied),
    )
    if (!pending) return null
    // 只改「默认高亮」（`selectedInstrumentId`），不替玩家完成 `select` 完成条件
    return this.sim.selectCheapestAffordable()
  }

  // === 派生量（供 ChapterRuntime 的注入式端口使用）===

  /** 1 手（含手续费）是否买得起 —— 与 `cheapestAffordableId()` / 撮合 `REJECT_1` 同一条判据。 */
  _canAffordOneLot(instrumentId) {
    const quote = this.sim.snapshot().quotes[instrumentId]
    if (!quote) return false
    const perLot = roundMoney(Number(quote.lastPrice) * LOT_SIZE)
    const cost = roundMoney(perLot + computeFee('A_SHARE', 'buy', perLot))
    return cost <= this.sim.account.cash
  }

  /** 章内各交易日的「7 只标的等权平均涨跌幅」（评级窗口的大盘对照项，PRD §3.3）。 */
  _marketChanges() {
    const quotes = this.sim.snapshot().quotes
    return this.instruments.map((inst) => Number(quotes[inst.id] && quotes[inst.id].changePct) || 0)
  }

  // === Runtime 状态（唯一来源）===

  runtimeState() {
    if (!this.sim) return { ready: false }
    const chapter = this.chapter ? this.chapter.snapshot() : null
    // 品种解锁跟着**当前所在章**（而不是「已通关的章」）—— 第三章就是要买 ETF，
    // 若等通关才解锁，那一章根本没东西可买。累加式，沙盒由 devSkipToSandbox 全开。
    if (chapter) {
      const done = Array.isArray(chapter.unlockedChapters) ? chapter.unlockedChapters : []
      const cur = Number(chapter.chapterId) || 1
      const max = done.reduce((m, v) => Math.max(m, Number(v) || 0), cur)
      this.sim.unlockForChapter(max)
      // 期权没有独立标的条目，靠章数据 `unlocks.markets` 显式声明（第八章）
      for (const mk of (chapter.unlocks && chapter.unlocks.markets) || []) {
        this.sim.unlockMarket(mk)
      }
    }
    return { ...this.sim.snapshot(), chapter }
  }

  // === Stage 0 六个测试钩子（语义不变）===

  /**
   * 「进入下一交易日」。章内若本拍声明了 `advanceDay` 完成条件（1.6 / 2.7），
   * 走 `chapterAck` 这条唯一路径（DOM 点击与 eval 驱动不可区分）；其余模式只推进市场层。
   */
  advanceDay() {
    const id = this._pendingAdvanceRequireId()
    if (id) {
      this.chapterAck(id)
      return this.runtimeState()
    }
    this.sim.advanceDay()
    this.chapter?.onMarketOpen?.({ viaAdvance: true })
    this.refresh()
    return this.runtimeState()
  }

  _pendingAdvanceRequireId() {
    if (!this.chapter || this.chapter.mode !== 'chapter') return null
    const beat = this.chapter.beatData()
    const snapshot = this.chapter.snapshot()
    const hit = ((beat && beat.require) || []).find(
      (r) =>
        r &&
        r.kind === 'advanceDay' &&
        (snapshot.beatRequirements || []).some((s) => s.id === r.id && !s.satisfied),
    )
    return hit ? hit.id : null
  }

  /** 唯一的委托入口（DOM 提交按钮与 eval 钩子共用）：下单 → 结果回喂章节状态机。 */
  submitOrder(spec) {
    const result = this.sim.submitOrder(spec)
    this.chapter?.onOrderResult?.(result, spec)
    this.refresh()
    return result
  }

  /** Stage 0 语义：世界重启（Stage 0 回归测试断言的是这条）。`resetAccount()` 是 PRD §3.6 的「重置账户」。 */
  reset() {
    this.sim.reset()
    this.views.order?.clearFilledOrders?.()
    this.chapter?.noteNav?.(this.sim.snapshot().NAV)
    this.refresh()
    return this.runtimeState()
  }

  selectInstrument(instrumentId) {
    this.sim.selectInstrument(instrumentId)
    // 玩家点选走 `chapterSelect(player:true)`：与 eval 钩子同一条路径
    this.chapter?.chapterSelect?.(instrumentId, { player: true })
    this.refresh()
    return this.runtimeState()
  }

  devSetEvent(spec) {
    return this.sim.devSetEvent(spec)
  }

  devDrawEvent() {
    return this.sim.devDrawEvent()
  }

  // === 章节层的玩家动作（DOM 回调与测试钩子共用同一条路径）===

  chapterAck(id) {
    const result = this.chapter.chapterAck(id)
    this.refresh()
    return result
  }

  chapterAnswer(choiceId, key) {
    const result = this.chapter.chapterAnswer(choiceId, key)
    this.refresh()
    return result
  }

  chapterRead(panelId, count = 1) {
    const result = this.chapter.chapterRead(panelId, count)
    this.refresh()
    return result
  }

  chapterSelect(instrumentId, options = undefined) {
    const result = this.chapter.chapterSelect(instrumentId, options || {})
    this.refresh()
    return result
  }

  chapterClosePanel(panelId = null) {
    const result = this.chapter.closePanel(panelId)
    this.refresh()
    return result
  }

  /**
   * 第四章的两个新玩家动作（与 `chapterAnswer` 同形）：配对与流程走查。
   * DOM 点击（`MatchGameView` 卡片 / `FlowWalkView` 步骤）与 eval 钩子走**同一条**路径。
   */
  chapterMatch(gameId, cardId, targetKey) {
    const result = this.chapter.chapterMatch(gameId, cardId, targetKey)
    this.refresh()
    return result
  }

  chapterFlowStep(walkId, stepId) {
    const result = this.chapter.chapterFlowStep(walkId, stepId)
    this.refresh()
    return result
  }

  /**
   * 买入期权（第八章）。走与股票下单同一条路径：市场层出结果 → 章节层标记完成条件。
   * 期权不建股票持仓，因此不经过 `submitOrder`，但结果照样交给 `onOrderResult`，
   * 使 `submit` 类完成条件的判定口径保持唯一。
   */
  chapterBuyOption(contractId, lots = 1) {
    const result = this.sim.buyOption({ contractId, lots })
    this.chapter?.onOrderResult?.(result, { side: 'buy', type: 'option' })
    this.refresh()
    return result
  }

  /** 「我暂时不想试」：运行时代为演示一次该拒单并让本拍完成（不卡死）。 */
  chapterGiveUp(beatId = null) {
    const result = this.chapter.giveUp(beatId)
    if (result && result.ok && result.demo) this.replayGiveUpDemo({ beatId: result.beatId, demo: result.demo })
    this.refresh()
    return result
  }

  chapterOpenPanel(panelId) {
    this.chapter.openPanel(panelId)
    this.refresh()
    return this.chapter.snapshot()
  }

  chapterConfirm() {
    const result = this.chapter.confirmChapter()
    this.refresh()
    return result
  }

  chapterEndPhase() {
    const phase = this.chapter.advanceEndPhase()
    this.refresh()
    return phase
  }

  chapterExtraStep() {
    const step = this.chapter.advanceExtraStep()
    this.refresh()
    return step
  }

  chapterCompleteExtra() {
    const result = this.chapter.completeExtraSegment()
    this.refresh()
    return result
  }

  /** 三种模式（PRD §3.2）：永不推进章节；从自由模式回主线会给一句承接语。 */
  setMode(mode) {
    const next = this.chapter.setMode(mode)
    this.refresh()
    return next
  }

  setMuted(muted) {
    const value = this.chapter.setMuted(muted)
    this.refresh()
    return value
  }

  toggleMute() {
    return this.setMuted(!this.chapter.muted)
  }

  callMentor(options = undefined) {
    const result = this.chapter.callMentor(options || {})
    this.refresh()
    return result
  }

  /** 词典与公式查询入口（PRD §3.3「不得用综合评分掩盖算法」）。 */
  openDictionary() {
    return this.chapterRoot?.dictionary?.open?.() || null
  }

  /** 导师对话历史入口（PRD §4「对话历史随时可回看」）。 */
  openMentorHistory() {
    return this.chapterRoot?.mentorHistory?.open?.() || null
  }

  /** 进度与解锁入口（PRD §5）：只读快照的面板，入口本身不改变任何状态。 */
  openProgress() {
    return this.chapterRoot?.progress?.open?.() || null
  }

  /** 净值与结业评定入口（PRD §6）：只读快照的面板。 */
  openNavStanding() {
    return this.chapterRoot?.navStanding?.open?.() || null
  }

  /** 「关闭非剧情发言」总开关（PRD §4）：只关他主动补的提示 / 讲解 / 点评，剧情对白照常。 */
  toggleProactive() {
    const enabled = this.chapter.mentor.proactiveEnabled
    const value = this.chapter.setProactiveEnabled(!enabled)
    this.refresh()
    return value
  }

  /** 「一键补足本金」（PRD §3.6）：`cash += ¥100,000 − NAV`，算外来入金，不限次数。 */
  topUpCapital() {
    const result = this.chapter.devTopUpCapital()
    this.chapter.noteNav(this.sim.snapshot().NAV)
    this.refresh()
    return result
  }

  /**
   * 「重置账户」（PRD §3.6）：清空持仓 + `cash = ¥100,000`，其余（行情 / 日历 / 净值曲线 /
   * 章节进度 / 词典 / 导师关系）全部保留；净增现金记入外来入金。
   */
  resetAccount() {
    const result = this.sim.resetAccount()
    this.views.order?.clearFilledOrders?.()
    if (result && Number(result.injection) > 0) this.chapter.noteInjection(result.injection)
    this.chapter.noteNav(this.sim.snapshot().NAV)
    this.refresh()
    return result
  }

  /** 章节进度重置（PRD §4 Reset）：回到第一章节拍 0 并清空存档（用于重玩）。 */
  resetChapterProgress() {
    this.chapter.resetChapterProgress()
    this.views.order?.clearFilledOrders?.()
    this.refresh()
    return this.runtimeState()
  }

  /** 买得起的最低价款（「回到买得起的那只」按钮 / 默认高亮规则的唯一实现）。 */
  selectCheapestAffordable() {
    const picked = this.sim.selectCheapestAffordable()
    this.refresh()
    return picked
  }

  /**
   * 「我暂时不想试」的演示回放：`config/chapters.json` 的 `giveUp.demo.steps[]`。
   * `priceRef` 只有两种（`lastPrice` / `limitUpPlusTick`），价格解析在宿主做，
   * 视图不复制任何撮合或报价推导逻辑。
   */
  replayGiveUpDemo({ demo = null } = {}) {
    const steps = (demo && demo.steps) || []
    const results = []
    for (const step of steps) {
      if (step && step.action === 'advanceToClosedDay') {
        this._advanceToClosedDay()
        continue
      }
      const spec = this._resolveDemoStep(step)
      if (!spec) continue
      const result = this.sim.submitOrder(spec)
      this.chapter.onOrderResult(result, spec)
      results.push(result)
    }
    this.refresh()
    return results
  }

  _resolveDemoStep(step) {
    if (!step || !step.side || !step.instrumentId) return null
    const id = step.instrumentId
    let price = null
    if (step.type !== 'market') {
      const quote = this.sim.snapshot().quotes[id]
      if (!quote) return null
      if (step.priceRef === 'limitUpPlusTick') price = roundMoney(this.sim.limitsFor(id).limitUp + PRICE_TICK)
      else price = roundMoney(quote.lastPrice)
    }
    return {
      side: step.side,
      instrumentId: id,
      type: step.type === 'market' ? 'market' : 'limit',
      price,
      qty: Number(step.qty) || LOT_SIZE,
    }
  }

  /** 推进到下一个休市日（演示「休市拒单」用；有界循环，永不死循环）。 */
  _advanceToClosedDay() {
    for (let i = 0; i < 8 && this.sim.calendar.isMarketOpen; i += 1) {
      this.sim.advanceDay()
      this.chapter.onMarketOpen({ viaAdvance: true })
    }
    return this.sim.snapshot().calendarClosedReason
  }

  // === 确定性 dev 钩子 ===

  devGotoBeat(chapterId, beatId = null) {
    const snapshot = this.chapter.devGotoBeat(chapterId, beatId)
    this.refresh()
    return snapshot
  }

  /** 进入指定章（第四章的确定性入口；第三章属 Stage 3，这里不造桥）。 */
  devGotoChapter(chapterId) {
    const snapshot = this.chapter.devGotoChapter(chapterId)
    this.refresh()
    return snapshot
  }

  devSatisfy(requireId) {
    const ok = this.chapter.devSatisfy(requireId)
    this.refresh()
    return ok
  }

  devInjectRatingInputs(inputs = {}) {
    const rating = this.chapter.devInjectRatingInputs(inputs)
    this.refresh()
    return rating
  }

  devForceGrade(grade) {
    return this.chapter.devForceGrade(grade)
  }

  /**
   * 直接写入章末评级记录（**只用于验证结业评定的三档与公式**）。
   * 与真实路径的唯一区别是多了一个调用方：真实路径由 `settle()` 写、且只在 `ch.rated` 时写。
   */
  devSetChapterGrades(grades = {}) {
    const result = this.chapter.devSetChapterGrades(grades)
    this.refresh()
    return result
  }

  devAdvanceDay(options = undefined) {
    const result = this.chapter.devAdvanceDay(options || {})
    this.refresh()
    return result
  }

  devTopUpCapital() {
    return this.topUpCapital()
  }

  /**
   * 进入与 Stage 0 沙盒**完全一致**的合法状态（Lead R2）：市场层走 `MarketSim.devSkipToSandbox()`，
   * 章节层切到第三种模式 `sandbox`（PRD §3.2：无目标卡、无引导）。Stage 0 的回归测试
   * 依赖「开局即可交易」，因此必须先走这个前置。
   */
  devSkipToSandbox() {
    this.sim.devSkipToSandbox()
    this.chapter.setMode('sandbox')
    this.chapter.noteNav(this.sim.snapshot().NAV)
    this.refresh()
    return this.runtimeState()
  }

  destroy() {
    const root = this.sceneTree && this.sceneTree.ui && this.sceneTree.ui.root
    if (root && this._onGiveUpDemo) root.removeEventListener('chapter-giveup-demo', this._onGiveUpDemo)
    this.chapterRoot?.destroy?.()
    this.chapterRoot = null
    this.shell?.destroy()
    this.shell = null
    this.views = {}
    this.overlay = null
    super.destroy()
  }
}
