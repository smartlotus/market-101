/**
 * ChapterRuntime —— 线性主线的**节拍状态机**（PRD §2.2 / §3.1 / §3.2 / §3.3 / §3.6 / §3.8）。
 *
 * 定位（plan.md 关键技术决策 1）：章节内容是数据（`config/chapters.json`），本类只是**通用解释器**。
 * 新增第三章 = 只加一段 JSON；只有出现**新的完成条件种类**时才动本文件（且先更新
 * `.vibegame/spec/guides/market-101-chapter-authoring.md` 的条件种类表）。
 *
 * 结构性约束：
 *   - 纯 JS，**不继承 `Node`**、无 DOM、无 `update()`，可被 `vibegame play eval` 直接构造并断言。
 *   - 不 import `scripts/sim/**`：市场层以**注入式端口**（`sim`）访问，端口只需
 *     `openAccount / fundInitial / beginFirstDay / advanceDay / clearResidualState /
 *      setDirectedEventQueue / pinDirectedEvent / directedDrawn / snapshot() / toJSON()`。
 *     依赖方向单向 `chapter → sim`；本类**从不**向市场层写回任何评级结果（锁 L2/L3）。
 *   - 节拍推进只有六种完成条件（`interact` / `read` / `select` / `submit` / `choice` / `advanceDay`），
 *     `require[]` 全满足前**没有任何推进路径**；「读一段文字」不可能满足其中任何一项。
 *   - DOM 控件回调与测试钩子走**同一条**路径（`chapterAck / chapterRead / chapterAnswer /
 *     chapterSelect / chapterClosePanel / onOrderResult / onMarketOpen`），所以「玩家操作」与
 *     「测试驱动」不可区分。
 *
 * 窗口口径（plan 决策 8/9）：
 *   - 评级窗口 = 本章第一个节拍开始 → 本章最后一个节拍结束；`NAV₀` = 窗口首个采样，`NAV₁` = 结算瞬间。
 *   - 采样点 = 窗口内每一次会改变 NAV 的动作（成交 / 推进交易日 / 外来入金）+ 窗口首尾。
 *   - `freeDay` / `sandbox` 的时间**完全排除**：离开 `chapter` 时记下 NAV，回到 `chapter` 时把这段
 *     NAV 差并入 `excludedPnl`（`调整NAV = NAV − 累计外来入金 − 窗口外盈亏`），故它既不进 `rar`
 *     也不进 `maxDD`，只如实暴露在 `ratingInputs.excludedPnl`。
 */

import {
  RATING_PARAMS,
  RATING_THRESHOLDS,
  MONEY_TIERS,
  averageChangePct,
  computeMarketMove,
  computeRating,
  moneyTierOf,
} from './rating.js'
import MentorScheduler, { MENTOR_TIMING, MENTOR_MAX_PROACTIVE, MENTOR_SOURCE } from './mentor.js'
import { computeStanding } from './standing.js'
import { SAVE_SCHEMA, sanitizeBySchema } from './saveStore.js'

/** 三种模式（PRD §3.2）。切换权永远在玩家手上，且**永不推进章节**。 */
export const MODES = ['chapter', 'freeDay', 'sandbox']

/** 第二节四类拒单节拍里「老周最多提示 2 次」——与「同一概念最多主动讲 2 次」同值（PRD §3.9 / Edge Cases）。 */
export const REJECT_HINT_MAX = MENTOR_MAX_PROACTIVE

/** 六种完成条件（闭合集合，不得自创；chapter-authoring 约定）。 */
export const REQUIRE_KINDS = ['interact', 'read', 'select', 'submit', 'choice', 'advanceDay']

function round6(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1e6) / 1e6
}

function fillTemplate(text, vars) {
  if (typeof text !== 'string') return ''
  return text.replace(/\{(\w+)\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m,
  )
}

/**
 * 千分位整数（`10000` → `10,000`）：**只**用于把数据文案里的金额占位符填成人读的样子。
 * 不参与任何计算，也不是金额的唯一来源 —— 金额一律来自 `MONEY_TIERS` / 账户快照。
 */
function groupThousands(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export class ChapterRuntime {
  /**
   * @param {object}   input
   * @param {object}   input.chapters   `config/chapters.json` 解析结果（或 `chapters` 数组）
   * @param {object}   [input.mentor]   `MentorScheduler` 实例（缺省自建）
   * @param {object}   [input.sim]      市场层端口（见文件头）；缺省则纯逻辑运行（测试可注入假端口）
   * @param {object}   [input.saveStore] `SaveStore` 实例；缺省则不落盘
   * @param {object}   [input.config]   `{ navProvider, canAfford, marketChanges }` 可选注入
   */
  constructor({ chapters, mentor = null, sim = null, saveStore = null, config = {} } = {}) {
    const doc = chapters || {}
    this.chapters = Array.isArray(doc) ? doc : Array.isArray(doc.chapters) ? doc.chapters : []
    this.copy = Array.isArray(doc) ? {} : doc.copy || {}
    this.startChapterId = Number(doc.startChapter) || 1
    this.config = {
      navProvider: null,
      canAfford: null,
      marketChanges: null,
      // 初始本金（¥100,000）由**配置注入**（`scenes/main.scene.json` → `BrokerShell`），
      // 本类与 `standing.js` 都不写字面量 —— 结业评定的分母只有一个来源。
      initialCapital: 0,
      ...config,
    }
    this.sim = sim
    this.saveStore = saveStore
    this.mentor = mentor || new MentorScheduler()

    this.chapterIndex = 0
    this.beatIndex = 0
    this.completedBeats = []
    this.mode = 'chapter'
    this.panelId = null
    this.pendingChoiceId = null
    this.answeredChoices = {}
    this.conceptsIntroduced = []
    this.ruleCardsSeen = []
    this.remedialUsedThisChapter = false
    this.extraSegment = null
    this.rating = null
    this.ratingInputs = null
    this.ratingWindow = null
    this.goalCardState = { yellowHinted: false }
    this.hintCounts = {}
    this.selectTouched = false
    this.chapterGrades = {}
    this.chapterEndReached = false
    this.endPhase = 'none'
    this.redLineActive = false
    this.interruptedBeatId = null
    this.lastNav = null
    this.moneyTier = 'green'
    this.mentorLine = { line: null, speaker: null, conceptKey: null, source: null }
    // —— Stage 2 新增（见 plan「Runtime State Contract」，既有字段一字不改）——
    /** 已走完理解确认的章号：章节绑定标注（词典）与解锁进度的唯一驱动。 */
    this.unlockedChapters = []
    /** A 级解锁的进阶词条 key 并集（persisted；判定只读这个集合）。 */
    this.advancedUnlocked = []
    /** 全部已说台词（有序、不截断、进存档）；`source ∈ MENTOR_SOURCE`。 */
    this.mentorHistory = []
    /** **毕生**外来入金累计（补足本金 + 重置账户；初始入金不计）—— 结业评定的唯一输入之一。 */
    this.injectionsTotal = 0
    /**
     * 第四章两个新互动的进度（第四章 = 机构章）。两者都只记**已完成**的东西：
     *   - `matchProgress[gameId] = { pairsDone: string[] }`：已配对的**卡**（不记错误次数）
     *   - `flowProgress[walkId]  = { index:int, done:string[] }`：已按正确顺序走完的步数
     * 「错配 / 错序」只返回 `{ok:false}`，**一个字节都不写** —— 于是无限重试、不计数、
     * 不错序重置已走步骤全部是结构性的，而不是特判出来的。
     */
    this.matchProgress = {}
    this.flowProgress = {}
    this._riskWarned = false

    this._req = {}
    this.readCounts = {}
    this.closedPanels = {}
    this._beatDone = false
    this._chapterRejectSeen = false
    this._forcedGrade = null
    this._pinsClaimed = []
    this._panelPause = null
    this._saveMeta = { exists: false, version: null, beatId: null }

    this.refreshSaveMeta()
    this.enterChapter(this._indexOfChapter(this.startChapterId))
  }

  // === 数据视图 ===

  get chapter() {
    return this.chapters[this.chapterIndex] || null
  }

  get beats() {
    const ch = this.chapter
    return ch && Array.isArray(ch.beats) ? ch.beats : []
  }

  get beat() {
    return this.beats[this.beatIndex] || null
  }

  get beatId() {
    const beat = this.beat
    return beat ? beat.id : null
  }

  /** 当前节的原始数据（对话层 / 面板层 / 场景层直接从快照取用，视图不反向依赖解释器）。 */
  beatData() {
    return this.beat
  }

  beatIndexById(chapterId, beatId) {
    const ch = this.chapters[this._indexOfChapter(chapterId)]
    if (!ch || !Array.isArray(ch.beats)) return -1
    return ch.beats.findIndex((b) => b.id === beatId)
  }

  _indexOfChapter(chapterId) {
    const id = Number(chapterId)
    const index = this.chapters.findIndex((c) => Number(c.id) === id)
    return index >= 0 ? index : 0
  }

  _panel(panelId) {
    const ch = this.chapter
    return (ch && ch.panels && ch.panels[panelId]) || null
  }

  _choice(choiceId) {
    const ch = this.chapter
    return (ch && ch.choices && ch.choices[choiceId]) || null
  }

  _requireSpec(id) {
    const beat = this.beat
    if (!beat || !Array.isArray(beat.require)) return null
    return beat.require.find((r) => r.id === id) || null
  }

  nextChapter() {
    const next = this.chapters[this.chapterIndex + 1]
    return next ? { id: next.id, name: next.name, preview: next.preview || null } : null
  }

  // === 解锁（**唯一驱动 = 走完一章**；与余额、与评级无关）===

  /**
   * 已解锁品种 —— **派生量**：`unlockedChapters` × 各章 `unlocks.instruments` 的并集。
   *
   * 不落盘、不留第二份真相，且**只读 `unlockedChapters` 一个字段**：
   * 钱（`lastNav` / `moneyTier` / `injectionsTotal`）与成绩（`chapterGrades` / `rating`）
   * 在结构上不可能影响它 —— 「解锁看理解，推进看成绩」。
   */
  get unlockedInstruments() {
    const out = []
    for (const ch of this.chapters) {
      if (!ch || !this.unlockedChapters.includes(Number(ch.id))) continue
      const ids = (ch.unlocks && ch.unlocks.instruments) || []
      for (const id of ids) {
        if (id && !out.includes(id)) out.push(id)
      }
    }
    return out
  }

  // === 结业评定（**派生量**，只展示；不写回、不参与解锁）===

  /**
   * 三档评定与其可见展开（PRD §6）。输入只有四项：
   * 已记录的评级、当前 NAV、**毕生**外来入金、初始本金；公式与阈值全部在 `standing.js`。
   */
  get graduationStanding() {
    const nav = Number.isFinite(this.lastNav) ? this.lastNav : this._nav()
    return computeStanding({
      grades: this.chapterGrades,
      finalNav: nav,
      injectionsTotal: this.injectionsTotal,
      initialCapital: this.config.initialCapital,
    })
  }

  // === 完成条件求值 ===

  /** 单个完成条件是否已满足（`read` 由读满 + 已关闭派生，其余由回调置位）。 */
  _satisfied(require) {
    if (!require) return false
    if (require.kind === 'read') {
      if (require.mustClose && !this.closedPanels[require.panelId]) return false
      return (this.readCounts[require.panelId] || 0) >= Number(require.count || 1)
    }
    return Boolean(this._req[require.id])
  }

  _allSatisfied() {
    const beat = this.beat
    if (!beat || !Array.isArray(beat.require) || beat.require.length === 0) return false
    return beat.require.every((r) => this._satisfied(r))
  }

  _mark(id, ok = true) {
    if (this._req[id] === ok) return false
    this._req[id] = ok
    return true
  }

  _satisfyKind(kind, matcher = null) {
    const beat = this.beat
    if (!beat || !Array.isArray(beat.require)) return []
    const hits = []
    for (const r of beat.require) {
      if (r.kind !== kind || this._satisfied(r)) continue
      if (matcher && !matcher(r)) continue
      this._mark(r.id)
      hits.push(r.id)
    }
    return hits
  }

  /** 推进检查：加演/补救段期间暂停节拍推进（PRD §3.6）。 */
  _afterMutate() {
    if (this.extraSegment) {
      // 段期间「暂停推进」只有在段有自己的面板时才成立：面板缺席 = 永久暂停 = 卡死。
      // 章末加演/补救段由 advanceEndPhase 开场；红线段没有章末流程代劳，故每次变更都补开一次。
      if (this.extraSegment.origin === 'redLine') this._ensureRedLinePanel()
      return false
    }
    const beat = this.beat
    if (!beat || this._beatDone) return false
    // 结构性保证：没有任何 require 的节拍不允许自动完成（防「进入即过关」）。
    if (!Array.isArray(beat.require) || beat.require.length === 0) return false
    if (!this._allSatisfied()) return false
    this._completeBeat()
    return true
  }

  _completeBeat() {
    const beat = this.beat
    if (!beat) return
    this._beatDone = true
    if (!this.completedBeats.includes(beat.id)) this.completedBeats.push(beat.id)
    if (beat.endOfChapter) {
      this._reachChapterEnd() // 章末自带存档（settle + 章末面板）
      return
    }
    if (this.beatIndex < this.beats.length - 1) {
      this.beatIndex += 1 // 严格 +1，不跳拍
      this._enterBeat()
    }
    // 存档点 = **下一拍的起点**（`beatIndex` 已前进、`_req` 已清空）：
    // 若在 `beatIndex += 1` 之前存，恢复会落回刚完成的那一拍，重放它的世界副作用。
    this.save()
  }

  // === 节拍生命周期 ===

  _enterBeat({ restoring = false } = {}) {
    const beat = this.beat
    if (!beat) return
    this._beatDone = false
    this._req = {}
    this.readCounts = {}
    this.closedPanels = {}
    this.panelId = null
    this.pendingChoiceId = null
    this.mentorLine = { line: null, speaker: null, conceptKey: null, source: null }
    // 配对 / 走查的**已完成**进度重新落成完成条件（进度进存档、`_req` 不进存档）
    this._resyncGatedProgress()
    for (const key of beat.concepts || []) {
      if (!this.conceptsIntroduced.includes(key)) this.conceptsIntroduced.push(key)
    }
    if (!restoring) {
      this._claimBeatPins()
      // 开口时机：拍首台词（`rejected` 类台词在被拒单时开口，见 _onReject）
      const opening = (beat.mentor || []).find((m) => m.timing !== 'rejected')
      if (opening) this._speak(opening)
      if (beat.savePoint) this.save()
    }
    if (!restoring && beat.panels && beat.panels.length && beat.panelAutoOpen !== false) {
      this.openPanel(beat.panels[0])
    }
  }

  /** 节拍点名的定向事件必须在该节拍被触发（PRD §3.8 硬要求）。 */
  _claimBeatPins() {
    const ch = this.chapter
    const beat = this.beat
    if (!ch || !beat || !Array.isArray(ch.pinnedEvents)) return []
    const claimed = []
    for (const pin of ch.pinnedEvents) {
      if (pin.beatId !== beat.id || !pin.eventId) continue
      if (this._isDrawn(pin.eventId)) continue // 已抽到过的不重复钉（刷新恢复时保护）
      if (this._pinsClaimed.includes(pin.eventId)) continue
      this.sim?.pinDirectedEvent?.(pin.eventId)
      this._pinsClaimed.push(pin.eventId)
      claimed.push(pin.eventId)
    }
    return claimed
  }

  _isDrawn(eventId) {
    const drawn = this.sim?.directedDrawn
    return Array.isArray(drawn) && drawn.includes(eventId)
  }

  _reachChapterEnd() {
    if (this.chapterEndReached) return
    this.chapterEndReached = true
    this._closeWindow()
    if (this.chapter && this.chapter.rated) this.settle()
    this._openEndPanel()
    this.save()
  }

  _openEndPanel() {
    const ch = this.chapter
    const end = (ch && ch.chapterEnd) || {}
    // endPhase: 'settlement' → 'extra' → 'confirm'（见 advanceEndPhase）
    if (end.settlementPanelId && this.rating) {
      this.endPhase = 'settlement'
      this.openPanel(end.settlementPanelId)
      return
    }
    this.endPhase = 'confirm'
    if (end.confirmPanelId) this.openPanel(end.confirmPanelId)
  }

  /** 章末流程推进：结算面板 →（加演/补救段）→ 理解确认面板。 */
  advanceEndPhase() {
    const ch = this.chapter
    const end = (ch && ch.chapterEnd) || {}
    if (this.endPhase === 'settlement') {
      if (this.extraSegment) {
        this.endPhase = 'extra'
        if (end.extraPanelId) this.openPanel(end.extraPanelId)
        else this.panelId = null
      } else {
        this.endPhase = 'confirm'
        if (end.confirmPanelId) this.openPanel(end.confirmPanelId)
      }
      this.save()
    }
    return this.endPhase
  }

  /** 加演段 / 补救段内的步进（不改变 beatCount）。 */
  advanceExtraStep() {
    const seg = this.extraSegment
    if (!seg) return null
    const total = Array.isArray(seg.steps) ? seg.steps.length : 0
    seg.stepIndex = Math.min(seg.stepIndex + 1, Math.max(0, total - 1))
    return seg.stepIndex
  }

  /**
   * 结束加演段 / 补救段（面板 `actions[].finish` 的最后一步与章末流程共用这一条出口）。
   * - 起因是章末评级：进入理解确认；
   * - 起因是红线：解除暂停、回到被打断的那个节拍继续（节拍推进恢复）。
   */
  completeExtraSegment() {
    const seg = this.extraSegment
    if (!seg) return null
    const origin = seg.origin
    const interrupted = this.interruptedBeatId
    this.extraSegment = null
    this.redLineActive = false
    this.interruptedBeatId = null
    // 红线：回到被打断的节拍（暂停期间节拍未前进，故正常情况下原地恢复即可）
    if (origin === 'redLine' && !this.chapterEndReached) {
      this.panelId = null
      const back = interrupted ? this.beatIndexById(this.chapter && this.chapter.id, interrupted) : -1
      if (back >= 0 && back !== this.beatIndex) {
        this.beatIndex = back
        this._enterBeat({ restoring: true })
      }
      // 本拍自己声明的面板若被补救段顶掉了，这里还回去（否则需要面板的 read 条件又没人满足 → 卡死）
      if (!this.panelId) {
        const beat = this.beat
        const panels = (beat && beat.panels) || []
        if (panels.length && beat.panelAutoOpen !== false) this.openPanel(panels[0])
      }
      this.save()
      this._afterMutate()
      return 'resumed'
    }
    const end = (this.chapter && this.chapter.chapterEnd) || {}
    this.endPhase = 'confirm'
    if (end.confirmPanelId) this.openPanel(end.confirmPanelId)
    else this.panelId = null
    this.save()
    return 'confirm'
  }

  /** 章末确认 → 下一章（PRD §4：第二章确认后进入 `freeDay`）。 */
  confirmChapter() {
    const ch = this.chapter
    if (!ch) return { ok: false, reason: 'no_chapter' }
    if (!this.chapterEndReached) return { ok: false, reason: 'chapter_not_finished' }
    if (this.extraSegment) return { ok: false, reason: 'extra_segment_pending' }
    const end = ch.chapterEnd || {}
    if (end.requiresRuleCards && this.ruleCardsSeen.length < Number(end.requiresRuleCards)) {
      return { ok: false, reason: 'rule_cards_missing' }
    }
    const choiceId = end.understandingChoiceId
    const choice = choiceId ? this._choice(choiceId) : null
    if (choice && choice.correctKey && this.answeredChoices[choiceId] !== choice.correctKey) {
      return { ok: false, reason: 'understanding_check_unanswered' }
    }
    const nextIndex = this.chapterIndex + 1
    const next = this.chapters[nextIndex]
    // 已走完理解确认 = 这一章「过了」：**唯一**的章节解锁驱动（与余额、评级无关，结构上不可能被钱影响）
    if (!this.unlockedChapters.includes(ch.id)) this.unlockedChapters.push(ch.id)
    if (next && next.implemented) {
      this.enterChapter(nextIndex)
      return { ok: true, chapterId: this.chapter.id, mode: this.mode, entered: next.id }
    }
    // 本任务只实现第一、二章：第二章确认后停在自由交易日窗口（PRD §4）。
    this.endPhase = 'none'
    this.panelId = null
    this.chapterEndReached = false
    this.setMode('freeDay')
    this.save()
    return { ok: true, chapterId: ch.id, mode: this.mode, entered: null, nextChapter: this.nextChapter() }
  }

  /** 进入某一章（清章内状态；`remedialUsedThisChapter` 在章边界重置，PRD §3.6）。 */
  enterChapter(index) {
    const target = Math.max(0, Math.min(index, this.chapters.length - 1))
    this.chapterIndex = target
    this.beatIndex = 0
    this.completedBeats = []
    this.conceptsIntroduced = []
    this.answeredChoices = {}
    this.pendingChoiceId = null
    this.panelId = null
    this.hintCounts = {}
    this.selectTouched = false
    this.remedialUsedThisChapter = false
    this.extraSegment = null
    this.rating = null
    this.ratingInputs = null
    this.goalCardState = { yellowHinted: false }
    this.chapterEndReached = false
    this.endPhase = 'none'
    this.redLineActive = false
    this.interruptedBeatId = null
    this._forcedGrade = null
    this._pinsClaimed = []
    this._chapterRejectSeen = false
    // 两个新互动的进度是**章内**状态：换章即从零开始（与 `answeredChoices` 同一条边界）
    this.matchProgress = {}
    this.flowProgress = {}
    const ch = this.chapter
    if (ch && ch.clearResidualsOnEnter) this.sim?.clearResidualState?.()
    if (ch && Array.isArray(ch.directedQueue)) this.sim?.setDirectedEventQueue?.(ch.directedQueue)
    this._openWindow()
    this._enterBeat()
    return this
  }

  /** 章节进度重置（PRD §4 Reset）：回到第一章节拍 0 并清空存档。 */
  resetChapterProgress() {
    this.saveStore?.clear?.()
    this.mode = 'chapter'
    // 「进度重置」= 这一轮从零开始：章节解锁、A 级解锁、对话历史与评级记录都清掉
    // （导师的每概念计数**不**清 —— 那是跨章累加的设计，见 test_mentor）。
    // `injectionsTotal` 也**不**清：它记的是账户的钱从哪来（补足 / 重置），不是章节进度，
    // 清了会让重置后的评定凭空好看（那条「补钱不能刷成绩」的硬规则就破了）。
    this.unlockedChapters = []
    this.advancedUnlocked = []
    this.mentorHistory = []
    this.chapterGrades = {}
    this._riskWarned = false
    this.enterChapter(this._indexOfChapter(this.startChapterId))
    this.refreshSaveMeta()
    return this
  }

  // === 玩家动作（DOM 回调与测试钩子共用同一条路径）===

  /**
   * `interact` / `advanceDay`：一个 UI 控件被操作（`chapterAck(id)`）。
   * 顶栏「进入下一交易日」也是控件，故 `advanceDay` 走同一条路径；数据声明的 `simAction`
   * 在这里执行（`openAccount` / `fundInitial` / `beginFirstDay` / `advanceDay`）。
   */
  chapterAck(id) {
    const spec = this._requireSpec(id)
    if (!spec || (spec.kind !== 'interact' && spec.kind !== 'advanceDay')) {
      return { ok: false, reason: 'unknown_interaction' }
    }
    this._mark(id)
    if (spec.simAction) this._runSimActions(spec.simAction, spec)
    if (spec.opensPanel) this.openPanel(spec.opensPanel)
    this._syncFromWorld()
    this._afterMutate()
    return { ok: true, id, beatId: this.beatId }
  }

  /** 数据声明的世界动作（`openAccount` / `fundInitial` / `beginFirstDay` / `advanceDay`）。 */
  _runSimActions(actions, spec) {
    if (!Array.isArray(actions) || !actions.length) return []
    const done = []
    for (const name of actions) {
      const fn = this.sim && this.sim[name]
      if (typeof fn === 'function') {
        fn.call(this.sim)
        done.push(name)
      }
    }
    this._syncFromWorld()
    if (spec && spec.opensFirstMarketDay) this.onMarketOpen({ viaAdvance: false })
    else if (actions.includes('advanceDay')) this.onMarketOpen({ viaAdvance: true })
    return done
  }

  /** `read`：面板被读满（参数 = **本次**读满的条目数，累加；`chapterRead(panelId, count)`）。 */
  chapterRead(panelId, count = 1) {
    if (!panelId) return { ok: false }
    const n = Math.max(1, Number(count) || 1)
    this.readCounts[panelId] = (this.readCounts[panelId] || 0) + n
    this._notePanelRead(panelId)
    this._afterMutate()
    return { ok: true, panelId, readCount: this.readCounts[panelId] }
  }

  /** `select`：在自选列表里点选。`player:false` = 系统默认高亮（不构成玩家的点选）。 */
  chapterSelect(instrumentId, { player = true, affordable = null } = {}) {
    if (!instrumentId) return { ok: false }
    if (player) this.selectTouched = true
    let canAfford = affordable
    if (canAfford === null && typeof this.config.canAfford === 'function') {
      canAfford = Boolean(this.config.canAfford(instrumentId))
    }
    const marked = []
    const beat = this.beat
    for (const r of (beat && beat.require) || []) {
      if (r.kind !== 'select' || this._satisfied(r)) continue
      if (r.instrumentId && r.instrumentId !== instrumentId) continue
      if (r.rule === 'affordable' && canAfford === false) continue
      this._mark(r.id)
      marked.push(r.id)
    }
    this._afterMutate()
    return { ok: marked.length > 0, instrumentId, marked }
  }

  /** `submit`：委托结果（`spec` 可选，用于补 type/side，因为市场层的结果里不含委托类型）。 */
  onOrderResult(result, spec = null) {
    if (!result || typeof result !== 'object') return { ok: false }
    const merged = { ...result }
    if (spec && typeof spec === 'object') {
      if (merged.type == null) merged.type = spec.type
      if (merged.side == null) merged.side = spec.side
    }
    if (merged.accepted === true && merged.status === 'filled') {
      this.noteTrade({ fee: merged.fee, notional: merged.notional })
    } else if (merged.accepted !== true) {
      // 本章出现过拒单 —— 「修正后的限价单」的判据（PRD §3.5 出场条件），跨节拍保留、章边界重置
      this._chapterRejectSeen = true
    }
    const marked = []
    const beat = this.beat
    if (!this.extraSegment && beat && Array.isArray(beat.require)) {
      // 一个委托结果只满足**一个**未满足的 submit 条件（避免一张单顶掉四类委托）
      for (const r of beat.require) {
        if (r.kind !== 'submit' || this._satisfied(r)) continue
        if (!this._matchesSubmit(r.expect, merged)) continue
        this._mark(r.id)
        marked.push(r.id)
        break
      }
    }
    if (merged.accepted !== true) this._onReject(merged)
    this._syncFromWorld()
    this._afterMutate()
    return { ok: marked.length > 0, marked, result: merged }
  }

  _matchesSubmit(expect, result) {
    if (!expect) return true
    if (expect.reasonCode) return result.accepted !== true && result.reasonCode === expect.reasonCode
    if (expect.accepted) {
      if (result.accepted !== true) return false
      if (expect.status && result.status !== expect.status) return false
      if (expect.side && result.side !== expect.side) return false
      if (expect.type && result.type && result.type !== expect.type) return false
      // 「修正后的限价单」：本章出现过拒单（即玩家学过怎么把价改回合法区间）
      if (expect.corrected && this._chapterRejectSeen !== true) return false
      return true
    }
    return true
  }

  /** 被拒单 / 亏损时的开口：先安慰、再解释；第 3 次起只显示一句「你试试看」（不卡死）。 */
  _onReject(result) {
    const beat = this.beat
    if (!beat) return
    const line = (beat.mentor || []).find((m) => m.timing === 'rejected') || null
    const spec = (beat.require || []).find((r) => r.kind === 'submit' && r.expect && r.expect.reasonCode)
    const expected = spec ? spec.expect.reasonCode : null
    if (expected && result.reasonCode === expected) {
      this._speak(line)
      return
    }
    const n = (this.hintCounts[beat.id] || 0) + 1
    this.hintCounts[beat.id] = n
    if (n <= REJECT_HINT_MAX) this._speak(line)
    else {
      // 第 3 次起的兜底句同样是**被拒单的安慰**（story/functional），因此经唯一闸门
      // `request()` 开口、归到 `source='beat'`（与上面 `_speak()` 的拒单台词同一分类）：
      // 静音**不得**吞掉它（lead 裁决），但它必须由穷举时机表判定 ——
      // 直接写 `_setMentorLine` 会成为第三处绕过闸门的发言。
      const verdict = this.mentor.request({
        timing: MENTOR_TIMING.REACTIVE,
        mode: this.mode,
        source: MENTOR_SOURCE.BEAT,
      })
      if (verdict.speak) {
        this._setMentorLine(this.copy.giveUpExhaustedLine || '', 'face', null, {
          timing: MENTOR_TIMING.REACTIVE,
          source: MENTOR_SOURCE.BEAT,
        })
      }
    }
  }

  /** `choice`：作答（**不判对错**；答错只重讲，同题可无限重试）。 */
  chapterAnswer(choiceId, key) {
    const choice = this._choice(choiceId)
    if (!choice) return { ok: false, reason: 'unknown_choice' }
    const answerKey = String(key)
    const option = (choice.options || []).find((o) => o.key === answerKey)
    if (!option) return { ok: false, reason: 'unknown_option' }
    this.answeredChoices[choiceId] = answerKey
    this.pendingChoiceId = choiceId
    if (option.feedback) {
      // 选项反馈是**功能性台词**（玩家必须读到自己这一选带来的后果），故经唯一闸门 `request()`
      // 开口并带上诊断来源。答对/答错与推进判定都不依赖台词 —— 静音下少一句话不会卡住任何一拍。
      const verdict = this.mentor.request({
        timing: MENTOR_TIMING.REACTIVE,
        mode: this.mode,
        conceptKey: choice.conceptKey || null,
        source: MENTOR_SOURCE.CHOICE_FEEDBACK,
      })
      if (verdict.speak) {
        this._setMentorLine(option.feedback, 'face', choice.conceptKey || null, {
          timing: MENTOR_TIMING.REACTIVE,
          source: MENTOR_SOURCE.CHOICE_FEEDBACK,
        })
      }
    }
    const correct = choice.correctKey ? answerKey === choice.correctKey : null
    if (correct === false) {
      // 只重讲：不标记完成、不记录次数、不出现任何否定措辞（PRD Edge Case）
      this.save()
      return { ok: true, correct, answeredKey: answerKey, advanced: false }
    }
    for (const r of (this.beat && this.beat.require) || []) {
      if (r.kind === 'choice' && r.choiceId === choiceId) this._mark(r.id)
    }
    this._afterMutate()
    this.save()
    return { ok: true, correct, answeredKey: answerKey, advanced: true }
  }

  // === 第四章的两个新玩家动作（与 `chapterAnswer` 同形：DOM 点击与 eval 钩子同路）===

  /**
   * `matchGame` 的配对游戏：把一张机构卡配到一条职责上（`chapterMatch(gameId, cardId, targetKey)`）。
   *
   * 只有三种结果，且**没有第四种**：
   *   - 数据里根本没有这条配对 → `{ok:false, reason:'no_such_pair'}`，**不改任何状态**
   *   - 这张卡已经配对过 → `ok:true`（幂等；刷新恢复后重放同一次点击不会算两次）
   *   - 配对成立 → 记进 `matchProgress`（只记已配对的卡，不记错误），并标记该配对声明的
   *     `requireId`（普通 `interact` 完成条件，**没有新增 `require[]` 种类**）
   *
   * 于是「无限重试、不记录错误次数、不显示『错』、不影响出场条件」是结构性的：错配路径里
   * 没有任何写操作可写。
   */
  chapterMatch(gameId, cardId, targetKey) {
    const game = this._matchGame(gameId)
    if (!game) return { ok: false, reason: 'unknown_game' }
    const card = String(cardId ?? '')
    const target = String(targetKey ?? '')
    const pair = (game.pairs || []).find((p) => String(p.cardId) === card && String(p.targetKey) === target)
    if (!pair) return { ok: false, reason: 'no_such_pair' }
    const prog = this._matchProg(game.id)
    if (!prog.pairsDone.includes(card)) prog.pairsDone.push(card)
    // 幂等重标：刷新恢复后 `_req` 被清空，靠这一步把「已经配好的卡」重新落成已满足
    if (pair.requireId && this._requireSpec(pair.requireId)) this._mark(pair.requireId)
    this._afterMutate()
    this.save()
    return {
      ok: true,
      gameId: game.id,
      cardId: card,
      targetKey: target,
      requirementId: pair.requireId || null,
      pairsDone: [...prog.pairsDone],
      pairCount: (game.pairs || []).length,
      complete: prog.pairsDone.length >= (game.pairs || []).length,
    }
  }

  /**
   * `flowWalk` 的流程走查：按**正确顺序**点出这笔交易走过的环节（`chapterFlowStep(walkId, stepId)`）。
   *
   * 顺序判定只有一条：`stepId` 必须等于 `order[index]`。
   *   - 不等 → `{ok:false, reason:'out_of_order'}`，**不改任何状态**：`index` 不动、`done` 不清，
   *     已走过的步骤一步都不会被重置（错序只让这一步不算）。
   *   - 相等 → `index += 1`；走完全部步骤时标记 `finishRequireId`（普通 `interact` 完成条件）。
   */
  chapterFlowStep(walkId, stepId) {
    const walk = this._flowWalk(walkId)
    if (!walk) return { ok: false, reason: 'unknown_walk' }
    const order = Array.isArray(walk.order) ? walk.order.map(String) : []
    const step = String(stepId ?? '')
    if (!order.length) return { ok: false, reason: 'empty_walk' }
    const prog = this._flowProg(walk.id)
    const expected = order[prog.index] ?? null
    if (step !== expected) return { ok: false, reason: 'out_of_order', expected }
    prog.done.push(step)
    prog.index = prog.done.length
    const complete = prog.index >= order.length
    if (complete && walk.finishRequireId && this._requireSpec(walk.finishRequireId)) {
      this._mark(walk.finishRequireId)
    }
    this._afterMutate()
    this.save()
    return {
      ok: true,
      walkId: walk.id,
      stepId: step,
      index: prog.index,
      total: order.length,
      done: [...prog.done],
      requirementId: complete ? walk.finishRequireId || null : null,
      complete,
    }
  }

  _matchGame(gameId) {
    const games = (this.chapter && this.chapter.matchGames) || null
    if (!games || !gameId) return null
    return games[gameId] || null
  }

  _flowWalk(walkId) {
    const walks = (this.chapter && this.chapter.flowWalks) || null
    if (!walks || !walkId) return null
    return walks[walkId] || null
  }

  /** 配对进度桶（只在配对成功时被读/写；错配路径不碰它）。 */
  _matchProg(gameId) {
    if (!this.matchProgress[gameId] || typeof this.matchProgress[gameId] !== 'object') {
      this.matchProgress[gameId] = { pairsDone: [] }
    }
    const prog = this.matchProgress[gameId]
    if (!Array.isArray(prog.pairsDone)) prog.pairsDone = []
    return prog
  }

  _flowProg(walkId) {
    if (!this.flowProgress[walkId] || typeof this.flowProgress[walkId] !== 'object') {
      this.flowProgress[walkId] = { index: 0, done: [] }
    }
    const prog = this.flowProgress[walkId]
    if (!Array.isArray(prog.done)) prog.done = []
    prog.index = Number.isFinite(Number(prog.index)) ? Number(prog.index) : prog.done.length
    return prog
  }

  /** 把 `pairs[].requireId` 反查回它所属的游戏与卡（走查恢复时用）。 */
  _pairByRequireId(requireId) {
    const games = (this.chapter && this.chapter.matchGames) || {}
    for (const gameId of Object.keys(games)) {
      const pair = ((games[gameId] || {}).pairs || []).find((p) => p && p.requireId === requireId)
      if (pair) return { gameId, pair }
    }
    return null
  }

  /**
   * 「这两个互动不需要玩家从零再做一遍」：进入一拍时，把 `matchProgress` / `flowProgress`
   * 里**已经完成**的那几条重新落成已满足的完成条件。
   *
   * 为什么必须有这一步：进度进存档、`_req` 不进存档（半完成节拍的完成条件一律恢复为未满足）。
   * 没有它，「配对到一半刷新」会让已配好的卡永远无法再点（面板上它们已经是配对态）→ 软锁。
   */
  _resyncGatedProgress() {
    const beat = this.beat
    for (const r of (beat && beat.require) || []) {
      if (!r || !r.gate) continue
      if (r.gate === 'matchGame') {
        const hit = this._pairByRequireId(r.id)
        if (!hit) continue
        const done = this._matchProg(hit.gameId).pairsDone
        if (done.includes(String(hit.pair.cardId))) this._mark(r.id)
      } else if (r.gate === 'flowWalk') {
        const walks = (this.chapter && this.chapter.flowWalks) || {}
        for (const walkId of Object.keys(walks)) {
          const walk = walks[walkId] || {}
          if (walk.finishRequireId !== r.id) continue
          const order = Array.isArray(walk.order) ? walk.order : []
          if (order.length && this._flowProg(walk.id).index >= order.length) this._mark(r.id)
        }
      }
    }
  }

  /** `advanceDay`：本拍发生过一次交易日推进（`simAction` 之外的推进路径也可用）。 */
  onMarketOpen({ changes = null, viaAdvance = false } = {}) {
    if (this.mode !== 'chapter') {
      // 章外（`freeDay` / `sandbox`）不进评级窗口、不推进任何节拍，但 NAV 必须在**每一次**
      // 交易日推进时照常采样 —— 否则 `lastNav` 会停在上一笔成交 / 补足 / 重置的时刻：
      //   ① 结业评定的 `NAV_final`（getter 优先读 `lastNav`）会与同一个面板由 `navHistory`
      //      画出来的曲线末点对不上；
      //   ② `_maybeRiskWarning()` 只有在下单之后才可能开口，纯行情下跌永远不响。
      // 采样仍然只走 `noteNav` → `_sample()` 那道门，而它在 `mode !== 'chapter'` 时直接跳过，
      // 故 Stage 0/1「自由模式 / 沙盒的盈亏不进评级窗口」的口径一字未动。
      this._syncFromWorld()
      return { ok: false, reason: 'outside_rating_window' }
    }
    const w = this.ratingWindow
    if (w && w.open) {
      w.marketDays += 1
      const values = changes || (typeof this.config.marketChanges === 'function' ? this.config.marketChanges() : null)
      if (Array.isArray(values) && values.length) w.marketMoveSeries.push(averageChangePct(values))
    }
    if (viaAdvance) this._satisfyKind('advanceDay')
    this._syncFromWorld()
    this._afterMutate()
    return { ok: true, marketDays: w ? w.marketDays : 0 }
  }

  /**
   * 「我暂时不想试」出口：系统代为演示一次该拒单，**本拍立即完成**（不卡死，PRD Edge Cases）。
   * 返回 `demo` 供宿主紧接着回放一次，作为该节拍的教学反馈（回放结果会自然满足同一条件，幂等）。
   */
  giveUp(beatId = null) {
    const beat = this.beat
    if (!beat || !beat.giveUp) return { ok: false, reason: 'no_give_up' }
    if (beatId && beatId !== beat.id) return { ok: false, reason: 'not_current_beat' }
    const gi = beat.giveUp
    for (const r of beat.require || []) {
      this._mark(r.id)
      if (r.kind === 'read') {
        this.readCounts[r.panelId] = Math.max(this.readCounts[r.panelId] || 0, Number(r.count || 1))
        this.closedPanels[r.panelId] = true
      }
    }
    this._afterMutate()
    return { ok: true, beatId: beat.id, demo: gi.demo || null, label: gi.label || this.copy.giveUpLabel }
  }

  /**
   * 玩家主动呼叫老周（不计入「最多主动讲 2 次」，静音也回应）。
   *
   * `question` = 数据 `copy.askBack` 里的一个键（`meaning` =「这是什么意思」/ `action` =「我该怎么办」）；
   * 缺省给 `copy.callReply`。**他给视角，不给答案**：回应一律取自数据声明的那组视角式文案，
   * 运行时**不生成**任何指令句 —— 全仓不含「你应该买 / 卖 / 加仓 / 减仓」这类字符串。
   */
  callMentor({ line = null, question = null } = {}) {
    const verdict = this.mentor.request({
      timing: MENTOR_TIMING.PLAYER_CALL,
      mode: this.mode,
      source: MENTOR_SOURCE.PLAYER_CALL,
    })
    if (!verdict.speak) return { ok: false, reason: verdict.reason }
    const askBack = this.copy.askBack || {}
    const entry = question ? askBack[question] : null
    const text = line || (entry && entry.reply) || this.copy.callReply || ''
    this._setMentorLine(text, 'face', null, {
      timing: MENTOR_TIMING.PLAYER_CALL,
      source: MENTOR_SOURCE.PLAYER_CALL,
    })
    return {
      ok: true,
      line: text,
      speaker: 'face',
      callable: true,
      question: entry ? question : null,
      prompt: askBack.prompt || '',
    }
  }

  // === 模式切换（三向自由，永不推进章节）===

  setMode(mode) {
    if (!MODES.includes(mode) || mode === this.mode) return this.mode
    const w = this.ratingWindow
    if (w && w.open) {
      if (this.mode === 'chapter') {
        // 离开章内：记下起点净值，这段盈亏之后整体剔除
        w.excursionNavStart = this.lastNav
      } else if (mode === 'chapter') {
        if (w.excursionNavStart !== null) {
          w.excludedPnl = round6(w.excludedPnl + (Number(this.lastNav) || 0) - w.excursionNavStart)
          w.excursionNavStart = null
        }
      }
    }
    this.mode = mode
    if (mode === 'chapter') {
      // 从自由模式回到主线：一句承接语把散掉的线接回来（PRD §3.2）。
      // 时机取「章（重新）开场」（承接语就是一次开场），于是它**不占概念计数**、
      // 且穷举时机会是唯一闸门；`source='resume'` 是诊断字段（进历史），不是第六类时机。
      const lines = Array.isArray(this.copy.resumeLines) ? this.copy.resumeLines : []
      const text = lines.length ? lines[Math.min(this.chapterIndex, lines.length - 1)] : ''
      if (text) {
        const verdict = this.mentor.request({
          timing: MENTOR_TIMING.CHAPTER_OPEN,
          mode,
          source: MENTOR_SOURCE.RESUME,
        })
        if (verdict.speak) {
          this._setMentorLine(text, 'face', null, { timing: MENTOR_TIMING.CHAPTER_OPEN, source: MENTOR_SOURCE.RESUME })
        }
      }
    } else {
      this.mentorLine = { line: null, speaker: null, conceptKey: null, source: null }
    }
    this.save()
    return this.mode
  }

  // === 面板层（DOM 只是投影；状态全在本类，故「面板打开时刷新」可恢复）===

  openPanel(panelId) {
    if (!panelId) return null
    this.panelId = panelId
    const spec = this._panel(panelId)
    const choiceBlock = ((spec && spec.blocks) || []).find((b) => b.type === 'choiceGroup' && b.choiceId)
    this.pendingChoiceId = choiceBlock ? choiceBlock.choiceId : null
    this.save()
    return spec
  }

  closePanel(panelId = null) {
    const closing = panelId || this.panelId
    if (!closing) return { ok: false }
    const spec = this._panel(closing)
    if (this.panelId === closing) this.panelId = null
    this.closedPanels[closing] = true
    this._notePanelRead(closing)
    this._ackPanelQuestion(closing, spec)
    this._afterMutate()
    return { ok: true, panelId: closing }
  }

  /**
   * 「题面就摆在面板里」的出口：本拍要求作答的这道题由面板 `blocks[].choiceGroup` 呈现，
   * 玩家把面板读满（该面板的 `read` 条件已满足）并点了面板自己的动作按钮关掉它 ——
   * 对这种**不判对错**的选择题（`correctKey` 为空，无正误之分）视作已作答。
   *
   * 两条边界，缺一不可：
   *   - 题在面板里（否则玩家根本没见过题面，不能算作答）；面板若挂 `read` 条件则必须先读满，
   *     没读满就关掉不算 —— 玩家还得作答；
   *   - 只放行 `correctKey` 为空的反思题。有正误的判断题（1.9 的 T+1、2.end 的理解确认）
   *     一律不走这条路，必须真的选。
   */
  _ackPanelQuestion(panelId, spec) {
    if (!spec) return []
    const groups = (spec.blocks || []).filter((b) => b.type === 'choiceGroup' && b.choiceId)
    if (!groups.length) return []
    const beat = this.beat
    const requires = (beat && beat.require) || []
    const readSpec = requires.find((r) => r.kind === 'read' && r.panelId === panelId)
    if (readSpec && !this._satisfied(readSpec)) return []
    const hits = []
    for (const r of requires) {
      if (r.kind !== 'choice' || this._satisfied(r)) continue
      if (!groups.some((g) => g.choiceId === r.choiceId)) continue
      const choice = this._choice(r.choiceId)
      if (!choice || choice.correctKey) continue
      this._mark(r.id)
      hits.push(r.id)
    }
    return hits
  }

  /** 面板读满 → 规则卡入 `ruleCardsSeen`、概念卡入 `conceptsIntroduced`（PRD §3.5 出场条件）。 */
  _notePanelRead(panelId) {
    const spec = this._panel(panelId)
    if (!spec || !Array.isArray(spec.blocks)) return
    const ids = spec.blocks.filter((b) => b.id).map((b) => b.id)
    if (!ids.length || (this.readCounts[panelId] || 0) < ids.length) return
    for (const b of spec.blocks) {
      if (b.type === 'ruleCard' && b.id && !this.ruleCardsSeen.includes(b.id)) this.ruleCardsSeen.push(b.id)
      if (b.type === 'conceptCard' && b.conceptKey && !this.conceptsIntroduced.includes(b.conceptKey)) {
        this.conceptsIntroduced.push(b.conceptKey)
      }
    }
  }

  /** 面板是否处于真暂停态（由 `ChapterOverlay` 回报；缺省按「有面板即暂停」）。 */
  notePanelPause(paused) {
    this._panelPause = paused === null || paused === undefined ? null : Boolean(paused)
    return this._panelPause
  }

  // === 评级窗口（三项输入全部由本类采样，绝不写回市场层）===

  _openWindow() {
    this.ratingWindow = {
      chapterId: this.chapter ? this.chapter.id : null,
      open: true,
      navStart: null,
      navSeries: [],
      adjustedNavSeries: [],
      injectionAtSample: [],
      cumInjection: 0,
      excludedPnl: 0,
      fees: 0,
      notional: 0,
      excursionNavStart: null,
      marketMoveSeries: [],
      marketDays: 0,
    }
    return this.ratingWindow
  }

  _closeWindow() {
    this._syncFromWorld()
    if (this.ratingWindow) this.ratingWindow.open = false
    return this.ratingWindow
  }

  _nav() {
    if (typeof this.config.navProvider === 'function') {
      const v = Number(this.config.navProvider())
      if (Number.isFinite(v)) return v
    }
    const snapshot = this.sim?.snapshot?.()
    if (snapshot && Number.isFinite(Number(snapshot.NAV))) return Number(snapshot.NAV)
    return this.lastNav
  }

  _syncFromWorld() {
    const nav = this._nav()
    if (Number.isFinite(nav)) return this.noteNav(nav)
    return this.moneyTier
  }

  /** NAV 变化的**唯一入口**：更新档位、采样、红线、黄档一次提醒与自由日的风险警示线。 */
  noteNav(nav) {
    const value = Number(nav)
    if (!Number.isFinite(value)) return this.moneyTier
    this.lastNav = value
    this.moneyTier = moneyTierOf(value)
    const w = this.ratingWindow
    if (this.mode === 'chapter' && w && w.open) this._sample(value)
    this._maybeRedLine()
    this._maybeYellowHint()
    this._maybeRiskWarning()
    return this.moneyTier
  }

  _sample(nav) {
    const w = this.ratingWindow
    if (w.navStart === null) w.navStart = nav
    const adjusted = round6(nav - w.cumInjection - w.excludedPnl)
    const lastAdjusted = w.adjustedNavSeries[w.adjustedNavSeries.length - 1]
    const lastNav = w.navSeries[w.navSeries.length - 1]
    if (w.navSeries.length && lastAdjusted === adjusted && lastNav === nav) return w
    w.navSeries.push(nav)
    w.adjustedNavSeries.push(adjusted)
    w.injectionAtSample.push(round6(w.cumInjection))
    return w
  }

  /** 章内成本（**只含已成交**，PRD §3.3 / Edge Case）。 */
  noteTrade({ fee = 0, notional = 0 } = {}) {
    const w = this.ratingWindow
    if (this.mode !== 'chapter' || !w || !w.open) return false
    const f = Number(fee)
    const n = Number(notional)
    if (Number.isFinite(f) && f > 0) w.fees = round6(w.fees + f)
    if (Number.isFinite(n) && n > 0) w.notional = round6(w.notional + n)
    return true
  }

  /**
   * 外来入金（补足本金 / 重置账户）。初始 ¥100,000 入金**不是**外来入金。
   *
   * 两个量、两套语义（plan 决策 11）：
   *   - `injectionsTotal`（**毕生**累计，进存档）：无论模式与评级窗口是否存在都累加 ——
   *     结业评定的调整后收益要把**全部**外来入金减掉，freeDay 里的补足同样算（Stage 1 完全不计）。
   *   - `ratingWindow.cumInjection`（窗口内）：Stage 0/1 冻结的语义，本方法**一字不改**。
   */
  noteInjection(amount) {
    const w = this.ratingWindow
    const value = Number(amount)
    if (!Number.isFinite(value) || value === 0) return 0
    this.injectionsTotal = round6(this.injectionsTotal + value)
    if (this.mode !== 'chapter' || !w || !w.open) return w ? w.cumInjection : 0
    w.cumInjection = round6(w.cumInjection + value)
    if (this.lastNav !== null) this._sample(this.lastNav)
    this.save()
    return w.cumInjection
  }

  /** 红线（NAV < ¥10,000）：暂停节拍推进 + 强制补救段；同一章最多一次。 */
  _maybeRedLine() {
    if (this.mode !== 'chapter') return false
    // 声明 `noRemedial` 的章（第四章 = 机构章）**空转**：这一章不设任何与余额相关的出口条件，
    // 也不要求任何交易 —— 亏到红线也不插入补救段（PRD Edge Case 明写）。
    if (this.chapter && this.chapter.noRemedial) return false
    if (this.lastNav === null || this.lastNav >= MONEY_TIERS.yellow) return false
    return this.triggerRedLine()
  }

  /**
   * 加演段 / 补救段的呈现面板（数据声明在 `chapterEnd.extraPanelId`，本类不自造面板）。
   */
  _extraPanelId() {
    const end = (this.chapter && this.chapter.chapterEnd) || {}
    return end.extraPanelId || null
  }

  /**
   * 红线补救段的呈现面板：缺席就补开，保证它**始终可读、可完成**
   * （面板缺席 + `_afterMutate()` 短路 = 玩家永久卡在被打断的节拍上）。
   * 已有面板在场时不抢（章末结算面板等由各自流程负责切换）。
   */
  _ensureRedLinePanel() {
    if (this.panelId) return this.panelId
    return this.openPanel(this._extraPanelId())
  }

  /**
   * 红线（NAV < ¥10,000）：暂停节拍推进 + 强制补救段；同一章最多一次
   * （与章末 D 级补救共用 `remedialUsedThisChapter` 配额）。
   * 段一建立就**立刻开场**（与章末补救段同一条面板路径：`openPanel(extraPanelId)`），
   * 于是它可读、可完成、可解除暂停。
   */
  triggerRedLine() {
    if (this.mode !== 'chapter') return false
    // `noRemedial` 的章（第四章）连**显式**触发也空转：补救段的入口在这一章整条关掉，
    // 而不是靠「数据里没声明 extraPanelId」间接不成立。
    if (this.chapter && this.chapter.noRemedial) return false
    // 章末已经有自己的补救/加演流程（D 级共用同一配额），此处不再另起一段
    if (this.chapterEndReached) return false
    if (this.extraSegment || this.remedialUsedThisChapter) return false
    const panelId = this._extraPanelId()
    const segment = this._buildExtra('remedial', 'redLine')
    // 数据里没有补救段 / 没有可呈现的面板 → 不建立段：
    // 「暂停推进」不能落在一个无法呈现、无法完成的段上（不得卡死是硬保证）
    if (!segment || !panelId) return false
    this.remedialUsedThisChapter = true
    this.redLineActive = true
    this.interruptedBeatId = this.beatId
    this.extraSegment = segment
    if (segment.mentorLine) {
      this._setMentorLine(segment.mentorLine, 'face', null, {
        timing: MENTOR_TIMING.REACTIVE,
        source: MENTOR_SOURCE.SEGMENT,
      })
    }
    this.openPanel(panelId) // 开场即存档（openPanel 内部 save）
    return true
  }

  /** 黄档：章目标卡常驻行 + 老周每章最多一次非侵入提示（PRD §3.6）。 */
  _maybeYellowHint() {
    if (this.mode !== 'chapter') return null
    if (this.goalCardState.yellowHinted) return null
    if (this.moneyTier !== 'yellow' && this.moneyTier !== 'red') return null
    this.goalCardState.yellowHinted = true
    const line = fillTemplate(this.copy.yellowLine || '', { amount: Math.round(Number(this.lastNav) || 0) })
    // 红线补救段自己的台词优先，不被这次黄档提示覆盖
    if (this.redLineActive || this.extraSegment) return line
    // 来源 = `proactiveHint`：它是「他主动补的提示」（非剧情发言），静音与「关闭非剧情发言」都该关掉它。
    const verdict = this.mentor.request({
      timing: MENTOR_TIMING.REACTIVE,
      mode: this.mode,
      source: MENTOR_SOURCE.PROACTIVE_HINT,
    })
    if (verdict.speak && line) {
      this._setMentorLine(line, 'face', null, { timing: MENTOR_TIMING.REACTIVE, source: MENTOR_SOURCE.PROACTIVE_HINT })
    }
    return line
  }

  /**
   * 自由交易日的**唯一例外**：NAV 触风险警示线时开口（GDD 275–288「自由交易日绝不主动弹窗，
   * 唯一例外＝风险警示线」）。这是 `MentorScheduler.request()` 的 `isRiskWarning` 逃生口的
   * **真实调用方** —— 否则那条例外就是死代码。
   *
   * 沙盒**不**开口（干净避风港，PRD §3.2）；章内仍走既有红线路径（`_maybeRedLine`）。
   * 同一段「未回血」期间只说一次；NAV 回到线上后重置，下次再触线可以再说一次（不刷屏、也不哑掉）。
   */
  _maybeRiskWarning() {
    if (this.mode !== 'freeDay') return null
    if (this.lastNav === null || this.lastNav >= MONEY_TIERS.yellow) {
      this._riskWarned = false
      return null
    }
    if (this._riskWarned) return null
    // 阈值只有一个来源：`MONEY_TIERS.yellow`（黄档 / 红线 / 风险警示是同一条线）。
    // 文案里的金额是占位符 → 改档位时这句话跟着变，两处不可能漂移。
    const line = fillTemplate(this.copy.riskLine || '', { amount: groupThousands(MONEY_TIERS.yellow) })
    if (!line) return null
    const verdict = this.mentor.request({
      timing: MENTOR_TIMING.REACTIVE,
      mode: this.mode,
      isRiskWarning: true,
      source: MENTOR_SOURCE.RISK_WARNING,
    })
    if (!verdict.speak) return null
    this._riskWarned = true
    this._setMentorLine(line, 'face', null, {
      timing: MENTOR_TIMING.REACTIVE,
      source: MENTOR_SOURCE.RISK_WARNING,
    })
    return line
  }

  /** 结算：评级只写本类自己的状态与结算面板数据（不侵入市场层）。 */
  settle() {
    const ch = this.chapter
    if (!ch) return null
    if (!ch.rated) {
      // 第一章不打分：账户仍在动，但不产生任何评级（公开口径，不静默丢弃）
      this.rating = null
      this.ratingInputs = {
        navStart: null,
        navNow: this.lastNav,
        feesInWindow: this.ratingWindow ? this.ratingWindow.fees : 0,
        notionalInWindow: this.ratingWindow ? this.ratingWindow.notional : 0,
        externalInjectionInWindow: this.ratingWindow ? this.ratingWindow.cumInjection : 0,
        excludedPnl: this.ratingWindow ? this.ratingWindow.excludedPnl : 0,
        costPenaltyHalf: false,
        adjustedNavSeries: this.ratingWindow ? [...this.ratingWindow.adjustedNavSeries] : [],
        graded: false,
      }
      return null
    }
    this._syncFromWorld()
    if (!this.ratingWindow) this._openWindow()
    const w = this.ratingWindow
    const navSeries = [...w.navSeries]
    if (!navSeries.length && Number.isFinite(this.lastNav)) navSeries.push(this.lastNav)
    const costPenaltyHalf = (navSeries[navSeries.length - 1] || 0) < MONEY_TIERS.green
    const raw = computeRating({
      navSeries,
      adjustedNavSeries: [...w.adjustedNavSeries],
      injections: [...w.injectionAtSample],
      fees: w.fees,
      notional: w.notional,
      costPenaltyHalf,
    })
    const marketMove = computeMarketMove(w.marketMoveSeries)
    const beatenMarket = raw.rar > marketMove
    const grade = this._forcedGrade || raw.grade
    const lines = (ch.settlement && ch.settlement.gradeLines) || {}
    const labels = (ch.settlement && ch.settlement.gradeLabels) || {}
    this.rating = {      rar: raw.rar,
      maxDD: raw.maxDD,
      costRatio: raw.costRatio,
      S: raw.S,
      grade,
      beatenMarket,
      marketMove,
      forced: Boolean(this._forcedGrade),
    }
    // 评级记录**只在这里**写入（且只在 `ch.rated` 时走到这行）：不打分的章（第四章）
    // 在方法开头就返回了，因此 `chapterGrades` 的条目数 = 真实评级次数。
    // 结业评定只数这张表里已有的条目，任何地方都不得写死「全剧共 N 次评级」。
    this.chapterGrades[ch.id] = grade
    this.ratingInputs = {
      navStart: raw.navStart,
      navNow: raw.navNow,
      feesInWindow: raw.fees,
      notionalInWindow: raw.notional,
      externalInjectionInWindow: raw.externalInjectionInWindow,
      excludedPnl: round6(w.excludedPnl),
      costPenaltyHalf,
      adjustedNavSeries: raw.adjustedNavSeries,
      baseScore: raw.baseScore,
      ddPenalty: raw.ddPenalty,
      costPenalty: raw.costPenalty,
      gradeLine: lines[grade] || '',
      gradeLabel: labels[grade] || '',
      marketMoveRowLabel: (ch.settlement && ch.settlement.marketMoveRowLabel) || '',
      beatenMarketLine: beatenMarket ? (ch.settlement && ch.settlement.beatenMarketLine) || '' : '',
      marketDays: w.marketDays,
      graded: true,
    }
    // 章末附加段：A 级加演 / D 级补救（同一章最多一次补救，红线与 D 级共用配额）
    if (grade === 'A') {
      this.extraSegment = this._buildExtra('advanced', 'grade')
      // A 级代价奖励（PRD §3 末组）：该章数据声明的进阶词条**并进持久集合**。
      // 不能只在「加演段存在期间」解锁 —— 段一结束就重新折叠，与「A 级解锁」不符。
      const unlock = (this.extraSegment && this.extraSegment.unlockConcepts) || []
      for (const key of unlock) {
        if (!this.advancedUnlocked.includes(key)) this.advancedUnlocked.push(key)
      }
    } else if (grade === 'D' && !this.remedialUsedThisChapter) {
      this.remedialUsedThisChapter = true
      this.extraSegment = this._buildExtra('remedial', 'grade')
    } else {
      this.extraSegment = null
    }
    if (lines[grade]) {
      this._setMentorLine(lines[grade], 'face', null, {
        timing: MENTOR_TIMING.CHAPTER_END,
        source: MENTOR_SOURCE.GRADE,
      })
    }
    this.save()
    return this.rating
  }

  _buildExtra(kind, origin) {
    const ch = this.chapter
    const spec = ch && ch.settlement && ch.settlement.extraSegments && ch.settlement.extraSegments[kind]
    if (!spec) return null
    const lowMarket =
      kind === 'remedial' && origin === 'grade' && this.rating && this.rating.grade === 'D' && this.rating.beatenMarket
    return {
      kind,
      origin,
      label: spec.label || '',
      steps: Array.isArray(spec.steps) ? spec.steps : [],
      stepIndex: 0,
      unlockConcepts: Array.isArray(spec.unlockConcepts) ? [...spec.unlockConcepts] : null,
      mentorLine: spec.mentorLine || null,
      toTopUpLabel: spec.toTopUpLabel || this.copy.topUpLabel || '',
      marketNote: lowMarket ? spec.lowMarketLine || null : null,
    }
  }

  // === 导师（状态面只有计数与静音，无任何隐藏层）===

  /**
   * 节拍数据声明的一句话（`beat.mentor[]`）。
   * 时机按数据里的 `timing` 字面映射到五类穷举时机；来源一律 `beat`。
   */
  _speak(entry) {
    if (!entry || !entry.line) return false
    const timing =
      entry.timing === 'rejected'
        ? MENTOR_TIMING.REACTIVE
        : entry.timing === 'chapterOpen'
          ? MENTOR_TIMING.CHAPTER_OPEN
          : entry.timing === 'chapterEnd'
            ? MENTOR_TIMING.CHAPTER_END
            : MENTOR_TIMING.FIRST_CONCEPT
    const verdict = this.mentor.request({
      timing,
      conceptKey: entry.conceptKey || null,
      mode: this.mode,
      source: MENTOR_SOURCE.BEAT,
    })
    if (!verdict.speak) {
      // 静音只是「不出声」，不改「已经讲过」的记账：否则取消静音会突然补讲一大堆
      // （PRD §3.9 Edge Case）。记账在**运行时**完成，不依赖对话层是否挂载。
      if (verdict.reason === 'muted' && timing === MENTOR_TIMING.FIRST_CONCEPT && entry.conceptKey) {
        this.mentor.note(entry.conceptKey)
      }
      return false
    }
    const spoke = this._setMentorLine(
      entry.line,
      entry.speaker === undefined ? 'face' : entry.speaker,
      entry.conceptKey || null,
      { timing, source: MENTOR_SOURCE.BEAT },
    )
    if (timing === MENTOR_TIMING.FIRST_CONCEPT && entry.conceptKey) this.mentor.note(entry.conceptKey)
    return Boolean(spoke.line)
  }

  /**
   * **唯一的写台词出口**：贴台词 + 记一条对话历史。
   *
   * 每条实际说出的台词都进 `mentorHistory`（含承接语与选项反馈），顺序即发言顺序，
   * 并带上所属章/拍与 `source`。历史存在章节快照里（导师调度器的状态面仍只有那三项）。
   */
  _setMentorLine(line, speaker = 'face', conceptKey = null, meta = {}) {
    const text = line || ''
    this.mentorLine = { line: text || null, speaker: text ? speaker : null, conceptKey, source: text ? meta.source || null : null }
    if (text) {
      const beat = this.beat
      this.mentorHistory.push({
        chapterId: this.chapter ? this.chapter.id : null,
        beatId: beat ? beat.id : null,
        timing: meta.timing || null,
        source: meta.source || null,
        speaker,
        conceptKey: conceptKey || null,
        line: text,
      })
    }
    return this.mentorLine
  }

  get muted() {
    return this.mentor.muted
  }

  setMuted(muted) {
    return this.mentor.setMuted(muted)
  }

  setProactiveEnabled(enabled) {
    return this.mentor.setProactiveEnabled(enabled)
  }

  // === 存档（节拍级；白名单 schema 之外的键一律进不去）===

  /** 原始章节快照（键名严格取自 `saveStore` 的 `SAVE_SCHEMA.chapter`）。 */
  _rawChapterSnapshot() {
    const seg = this.extraSegment
    return {
      chapterId: this.chapter ? this.chapter.id : null,
      beatId: this.beatId,
      beatIndex: this.beatIndex,
      completedBeats: [...this.completedBeats],
      mode: this.mode,
      shellMode: this.shellMode,
      sceneId: this.sceneId,
      panelId: this.panelId,
      pendingChoiceId: this.pendingChoiceId,
      answeredChoices: { ...this.answeredChoices },
      pendingChoiceSnapshots: this.pendingChoiceId
        ? { [this.pendingChoiceId]: { id: this.pendingChoiceId, answeredKey: this.answeredChoices[this.pendingChoiceId] ?? null } }
        : {},
      conceptsIntroduced: [...this.conceptsIntroduced],
      ruleCardsSeen: [...this.ruleCardsSeen],
      remedialUsedThisChapter: this.remedialUsedThisChapter,
      chapterRejectSeen: this._chapterRejectSeen,
      extraSegment: seg
        ? {
            kind: seg.kind,
            origin: seg.origin,
            label: seg.label,
            stepIndex: seg.stepIndex,
            stepCount: Array.isArray(seg.steps) ? seg.steps.length : 0,
            marketNote: seg.marketNote || null,
            mentorLine: seg.mentorLine || null,
            toTopUpLabel: seg.toTopUpLabel || null,
            redLineActive: this.redLineActive,
            interruptedBeatId: this.interruptedBeatId,
          }
        : null,
      rating: this.rating ? { ...this.rating } : null,
      ratingInputs: this.ratingInputs ? { ...this.ratingInputs } : null,
      ratingWindow: this.ratingWindow
        ? {
            chapterId: this.ratingWindow.chapterId,
            open: this.ratingWindow.open,
            navStart: this.ratingWindow.navStart,
            navSeries: [...this.ratingWindow.navSeries],
            adjustedNavSeries: [...this.ratingWindow.adjustedNavSeries],
            injectionAtSample: [...this.ratingWindow.injectionAtSample],
            cumInjection: this.ratingWindow.cumInjection,
            excludedPnl: this.ratingWindow.excludedPnl,
            fees: this.ratingWindow.fees,
            notional: this.ratingWindow.notional,
            excursionNavStart: this.ratingWindow.excursionNavStart,
            marketMoveSeries: [...this.ratingWindow.marketMoveSeries],
            marketDays: this.ratingWindow.marketDays,
          }
        : null,
      goalCardState: { ...this.goalCardState },
      mentor: this.mentor.toJSON(),
      hintCounts: { ...this.hintCounts },
      selectTouched: this.selectTouched,
      // —— Stage 2 新增（白名单见 `saveStore.SAVE_SCHEMA.chapter`）——
      unlockedChapters: [...this.unlockedChapters],
      advancedUnlocked: [...this.advancedUnlocked],
      mentorHistory: this.mentorHistory.map((e) => ({ ...e })),
      chapterGrades: { ...this.chapterGrades },
      injectionsTotal: round6(this.injectionsTotal),
      matchProgress: JSON.parse(JSON.stringify(this.matchProgress)),
      flowProgress: JSON.parse(JSON.stringify(this.flowProgress)),
    }
  }

  /**
   * 章节快照。**结构性保证**：返回值经 `saveStore.sanitizeBySchema(SAVE_SCHEMA.chapter, …)` 过一遍，
   * 于是「白名单之外的键」在物理上无法出现在存档里（导师无隐藏层的落地方式之一）。
   */
  toJSON() {
    return sanitizeBySchema(SAVE_SCHEMA.chapter, this._rawChapterSnapshot()) || {}
  }

  /**
   * 恢复到**节拍级**：落在「最后完成节拍之后」那个节拍的**起点**，半完成节拍的 `require[]` 全部未满足。
   * 面板与已作答的选项保留（「面板打开时刷新」→ 重新打开同一面板、`answeredKey` 不丢）。
   */
  loadFrom(data) {
    if (!data || typeof data !== 'object') return this
    const index = this._indexOfChapter(data.chapterId)
    this.chapterIndex = index
    this.mode = MODES.includes(data.mode) ? data.mode : 'chapter'
    this.completedBeats = Array.isArray(data.completedBeats) ? data.completedBeats.filter((v) => typeof v === 'string') : []
    this.beatIndex = Math.max(0, Math.min(Number(data.beatIndex) || this.completedBeats.length, Math.max(0, this.beats.length - 1)))
    this.conceptsIntroduced = Array.isArray(data.conceptsIntroduced) ? [...data.conceptsIntroduced] : []
    this.ruleCardsSeen = Array.isArray(data.ruleCardsSeen) ? [...data.ruleCardsSeen] : []
    this.answeredChoices = data.answeredChoices && typeof data.answeredChoices === 'object' ? { ...data.answeredChoices } : {}
    this.remedialUsedThisChapter = Boolean(data.remedialUsedThisChapter)
    // 本章出现过拒单 —— 跨节拍保留、章边界重置；必须随存档往返，
    // 否则「面板打开时刷新」会让 2.6 的 correctedLimit 条件重新变成未满足（该拍没有 giveUp）。
    this._chapterRejectSeen = Boolean(data.chapterRejectSeen)
    this.hintCounts = data.hintCounts && typeof data.hintCounts === 'object' ? { ...data.hintCounts } : {}
    this.selectTouched = Boolean(data.selectTouched)
    this.goalCardState = { yellowHinted: Boolean(data.goalCardState && data.goalCardState.yellowHinted) }
    // 解锁记账与对话历史随存档往返（历史顺序 = 发言顺序，不截断）
    this.unlockedChapters = Array.isArray(data.unlockedChapters) ? data.unlockedChapters.map(Number).filter(Number.isFinite) : []
    this.advancedUnlocked = Array.isArray(data.advancedUnlocked) ? data.advancedUnlocked.filter((k) => typeof k === 'string') : []
    this.mentorHistory = Array.isArray(data.mentorHistory)
      ? data.mentorHistory.filter((e) => e && typeof e === 'object' && typeof e.line === 'string').map((e) => ({ ...e }))
      : []
    // 评级记录与毕生外来入金（结业评定的两项输入）：刷新后必须还在，否则评定会凭空回档
    this.chapterGrades =
      data.chapterGrades && typeof data.chapterGrades === 'object' && !Array.isArray(data.chapterGrades)
        ? { ...data.chapterGrades }
        : {}
    this.injectionsTotal = Number.isFinite(Number(data.injectionsTotal)) ? Number(data.injectionsTotal) : 0
    // 两个新互动的进度（只含「已完成」的东西；恢复后由 `_enterBeat → _resyncGatedProgress`
    // 重新落成完成条件，否则配对到一半刷新会软锁）
    this.matchProgress = data.matchProgress && typeof data.matchProgress === 'object' && !Array.isArray(data.matchProgress)
      ? JSON.parse(JSON.stringify(data.matchProgress))
      : {}
    this.flowProgress = data.flowProgress && typeof data.flowProgress === 'object' && !Array.isArray(data.flowProgress)
      ? JSON.parse(JSON.stringify(data.flowProgress))
      : {}
    this.rating = data.rating && typeof data.rating === 'object' ? { ...data.rating } : null
    this.ratingInputs = data.ratingInputs && typeof data.ratingInputs === 'object' ? { ...data.ratingInputs } : null
    this.ratingWindow = data.ratingWindow && typeof data.ratingWindow === 'object' ? { ...data.ratingWindow } : null
    if (this.mentor && typeof this.mentor.loadFrom === 'function') this.mentor.loadFrom(data.mentor)
    this.panelId = null
    this.pendingChoiceId = null
    this.extraSegment = null
    this.redLineActive = false
    this.interruptedBeatId = null
    this.chapterEndReached = false
    this.endPhase = 'none'
    this._pinsClaimed = []
    this._req = {}
    this.readCounts = {}
    this.closedPanels = {}
    this._beatDone = false
    this.lastNav = null
    this.moneyTier = 'green'

    const seg = data.extraSegment
    if (seg && seg.kind) {
      const rebuilt = this._buildExtra(seg.kind, seg.origin || 'grade')
      if (rebuilt) {
        rebuilt.stepIndex = Number(seg.stepIndex) || 0
        rebuilt.marketNote = seg.marketNote || rebuilt.marketNote
        this.extraSegment = rebuilt
        this.redLineActive = Boolean(seg.redLineActive)
        this.interruptedBeatId = seg.interruptedBeatId || null
      }
    }
    const lastBeat = this.beats[this.beats.length - 1]
    if (lastBeat && this.completedBeats.includes(lastBeat.id)) this.chapterEndReached = true

    this._enterBeat({ restoring: true })
    if (this.beatIndex >= this.beats.length) this.beatIndex = Math.max(0, this.beats.length - 1)
    if (this.chapterEndReached) {
      if (this.extraSegment) this.endPhase = 'extra'
      else if (this.rating && this.chapter && this.chapter.chapterEnd && this.chapter.chapterEnd.settlementPanelId) {
        this.endPhase = 'settlement'
      } else {
        this.endPhase = 'confirm'
      }
    }
    // 面板打开时刷新：恢复后重新打开同一面板，且该面板之前的作答状态不丢
    if (typeof data.panelId === 'string' && data.panelId) {
      this.panelId = data.panelId
      if (typeof data.pendingChoiceId === 'string' && data.pendingChoiceId) this.pendingChoiceId = data.pendingChoiceId
    } else if (typeof data.pendingChoiceId === 'string' && data.pendingChoiceId) {
      this.pendingChoiceId = data.pendingChoiceId
    }
    // 补救段存在却没有面板 = 无法呈现、无法完成 → 恢复后立刻把面补上（不得卡死）
    if (this.extraSegment && this.extraSegment.origin === 'redLine' && !this.panelId) {
      this._ensureRedLinePanel()
    }
    this._syncFromWorld()
    return this
  }

  save() {
    if (!this.saveStore || typeof this.saveStore.write !== 'function') return false
    const ok = this.saveStore.write({
      beatId: this.beatId,
      chapterId: this.chapter ? this.chapter.id : null,
      mode: this.mode,
      chapter: this.toJSON(),
      world: this.sim && typeof this.sim.toJSON === 'function' ? this.sim.toJSON() : null,
    })
    this.refreshSaveMeta()
    return ok
  }

  refreshSaveMeta() {
    this._saveMeta =
      this.saveStore && typeof this.saveStore.meta === 'function'
        ? this.saveStore.meta()
        : { exists: false, version: null, beatId: null }
    return this._saveMeta
  }

  // === 派生展示量 ===

  get shellMode() {
    const beat = this.beat
    return (beat && beat.shell) || 'full'
  }

  get sceneId() {
    const beat = this.beat
    return (beat && beat.scene) || null
  }

  get paused() {
    if (this._panelPause !== null) return this._panelPause
    return Boolean(this.panelId)
  }

  get goalCard() {
    const ch = this.chapter
    if (!ch || !ch.goalCard) return null
    return {
      title: ch.goalCard.title,
      teach: [...(ch.goalCard.teach || [])],
      graded: ch.goalCard.graded !== false,
      noScoreLabel: ch.goalCard.graded === false ? ch.noScoreLabel || this.copy.noScoreLabel || '' : null,
      remainingBeats: Math.max(0, this.beats.length - this.completedBeats.length),
      yellowLine:
        this.moneyTier === 'yellow' || this.moneyTier === 'red'
          ? fillTemplate(this.copy.yellowLine || '', { amount: Math.round(Number(this.lastNav) || 0) })
          : null,
      topUpLabel: this.copy.topUpLabel || '',
    }
  }

  get pendingChoice() {
    const choiceId = this.pendingChoiceId
    if (!choiceId) return null
    const choice = this._choice(choiceId)
    if (!choice) return null
    const answeredKey = this.answeredChoices[choiceId] ?? null
    const feedbackByOption = {}
    for (const option of choice.options || []) feedbackByOption[option.key] = option.feedback || ''
    return {
      id: choice.id,
      question: choice.question,
      options: (choice.options || []).map((o) => ({ key: o.key, text: o.text })),
      answeredKey,
      feedbackByOption,
      correctKey: choice.correctKey || null,
    }
  }

  /** 定向事件队列的实到 / 未到（如实暴露，`owed` 可以非零且**不阻塞推进**，PRD §3.8）。 */
  get directedEvents() {
    const ch = this.chapter
    const required = (ch && ch.directedEvents) || []
    const drawn = required.filter((id) => this._isDrawn(id))
    const owed = required.filter((id) => !drawn.includes(id))
    return { required: [...required], drawn, owed }
  }

  /** 评级三项输入的可见展开（PRD §3.3「不得用综合评分掩盖算法」）。 */
  get ratingWindowInputs() {
    const w = this.ratingWindow
    if (!w) return null
    return {
      navStart: w.navStart,
      navNow: w.navSeries.length ? w.navSeries[w.navSeries.length - 1] : null,
      feesInWindow: w.fees,
      notionalInWindow: w.notional,
      externalInjectionInWindow: round6(w.cumInjection),
      excludedPnl: round6(w.excludedPnl),
      costPenaltyHalf: (w.navSeries[w.navSeries.length - 1] || 0) < MONEY_TIERS.green,
      adjustedNavSeries: [...w.adjustedNavSeries],
    }
  }

  // === Runtime 快照（`BrokerShell.runtimeState().chapter`）===

  snapshot() {
    const ch = this.chapter
    const beat = this.beat
    const moneyTier = this.moneyTier
    return {
      chapterId: ch ? ch.id : null,
      chapterName: ch ? ch.name : null,
      beatId: beat ? beat.id : null,
      beatTitle: beat ? beat.title : null,
      beatIndex: this.beatIndex,
      beatCount: this.beats.length,
      remainingBeats: Math.max(0, this.beats.length - this.completedBeats.length),
      completedBeats: [...this.completedBeats],
      mode: this.mode,
      shellMode: this.shellMode,
      sceneId: this.sceneId,
      panelId: this.panelId,
      paused: this.paused,
      goalCard: this.goalCard,
      moneyTier,
      beatRequirements: ((beat && beat.require) || []).map((r) => ({
        kind: r.kind,
        id: r.id,
        satisfied: this._satisfied(r),
        label: r.label || '',
      })),
      pendingChoice: this.pendingChoice,
      conceptsIntroduced: [...this.conceptsIntroduced],
      ruleCardsSeen: [...this.ruleCardsSeen],
      rating: this.rating ? { ...this.rating } : null,
      ratingInputs: this.ratingInputs ? { ...this.ratingInputs } : this.ratingWindowInputs,
      remedialUsedThisChapter: this.remedialUsedThisChapter,
      extraSegment: this.extraSegment
        ? {
            kind: this.extraSegment.kind,
            origin: this.extraSegment.origin,
            label: this.extraSegment.label,
            steps: this.extraSegment.steps,
            stepIndex: this.extraSegment.stepIndex,
            unlockConcepts: this.extraSegment.unlockConcepts,
            marketNote: this.extraSegment.marketNote,
            mentorLine: this.extraSegment.mentorLine,
            toTopUpLabel: this.extraSegment.toTopUpLabel,
          }
        : null,
      directedEvents: this.directedEvents,
      mentor: {
        muted: this.mentor.muted,
        proactiveEnabled: this.mentor.proactiveEnabled,
        explainCounts: { ...this.mentor.explainCounts },
        line: this.mentorLine.line,
        speaker: this.mentorLine.speaker,
        conceptKey: this.mentorLine.conceptKey,
        // 追加字段（既有键一字不改）：当前这句台词的来源，用于验证「全部发言走唯一闸门」。
        source: this.mentorLine.source,
        callable: true,
      },
      save: { ...this._saveMeta },
      // —— 以下为视图层直接取用的内容数据与流程状态（不属于 §2.2 必填集）——
      endPhase: this.endPhase,
      chapterEndReached: this.chapterEndReached,
      redLineActive: this.redLineActive,
      interruptedBeatId: this.interruptedBeatId,
      // 键名 = plan「Runtime State Contract」的 `chapterGrades`（与 `saveStore` 白名单、内部字段同名）
      chapterGrades: { ...this.chapterGrades },
      unlockedChapters: [...this.unlockedChapters],
      // 派生量：视图**只读**这两个，不自己推导任何解锁、不自己算评定
      unlockedInstruments: this.unlockedInstruments,
      graduationStanding: this.graduationStanding,
      advancedUnlocked: [...this.advancedUnlocked],
      injectionsTotal: round6(this.injectionsTotal),
      mentorHistory: this.mentorHistory.map((e) => ({ ...e })),
      nextChapter: this.nextChapter(),
      // 第四章两个新互动的进度投影（视图只读它，不自己推导任何进度）
      matchProgress: JSON.parse(JSON.stringify(this.matchProgress)),
      flowProgress: JSON.parse(JSON.stringify(this.flowProgress)),
      noRemedial: Boolean(ch && ch.noRemedial),
      beat,
      chapterEnd: ch ? ch.chapterEnd || null : null,
      settlement: ch && ch.settlement ? ch.settlement : null,
      copy: this.copy,
      requireKinds: REQUIRE_KINDS,
      ratingParams: RATING_PARAMS,
      ratingThresholds: RATING_THRESHOLDS,
      moneyTiers: MONEY_TIERS,
    }
  }

  // === 确定性测试钩子（普通公开方法，与玩家路径共用同一批回调）===

  /**
   * 跳转到指定章节 / 节拍（仅测试与 dev 用；玩家路径不得跳拍）。
   * 目标章 = 当前章时**不重入章节**（保留章内的补救配额等状态，便于造中途态）。
   */
  devGotoBeat(chapterId, beatId) {
    const index = this._indexOfChapter(chapterId)
    if (!this.chapter || index !== this.chapterIndex) this.enterChapter(index)
    const target = beatId ? this.beats.findIndex((b) => b.id === beatId) : 0
    this.beatIndex = Math.max(0, target)
    this._enterBeat({ restoring: true })
    return this.snapshot()
  }

  /**
   * 进入指定章（**仅测试与 dev 用**）：第四章在本任务里没有可走的第三章桥接，
   * 因此它的全部验证都从这一个钩子进场（plan 点名的确定性章入口）。
   * 目标章 = 当前章时**不重入**（与 `devGotoBeat` 同一约定，保留章内状态）。
   */
  devGotoChapter(chapterId) {
    const index = this._indexOfChapter(chapterId)
    if (!this.chapter || index !== this.chapterIndex) this.enterChapter(index)
    return this.snapshot()
  }

  /** 程序化满足一个完成条件（`read` 走读满路径）。 */
  devSatisfy(requireId) {
    const spec = this._requireSpec(requireId)
    if (!spec) return false
    if (spec.kind === 'read') {
      this.openPanel(spec.panelId)
      this.chapterRead(spec.panelId, Number(spec.count || 1))
      this.closePanel(spec.panelId)
      return this._satisfied(spec)
    }
    this._mark(requireId)
    this._afterMutate()
    return true
  }

  /** 直接注入评级三项输入（验证公式与五把锁）。 */
  devInjectRatingInputs({ navSeries = null, adjustedNavSeries = null, fees = null, notional = null, injections = null, marketMoveSeries = null } = {}) {
    if (!this.ratingWindow) this._openWindow()
    const w = this.ratingWindow
    if (Array.isArray(navSeries)) {
      w.navSeries = navSeries.map(Number).filter(Number.isFinite)
      w.navStart = w.navSeries.length ? w.navSeries[0] : null
    }
    if (Array.isArray(adjustedNavSeries)) w.adjustedNavSeries = adjustedNavSeries.map(Number).filter(Number.isFinite)
    else if (Array.isArray(navSeries)) w.adjustedNavSeries = w.navSeries.map((v) => round6(v - w.cumInjection - w.excludedPnl))
    if (Array.isArray(injections)) w.injectionAtSample = injections.map(Number)
    else if (w.navSeries.length) w.injectionAtSample = w.navSeries.map(() => round6(w.cumInjection))
    if (Number.isFinite(Number(fees))) w.fees = Number(fees)
    if (Number.isFinite(Number(notional))) w.notional = Number(notional)
    if (Array.isArray(marketMoveSeries)) w.marketMoveSeries = marketMoveSeries.map(Number)
    return this.settle()
  }

  /** 强制档次（只影响 `extraSegment` 的编排，不改任何市场量）。 */
  devForceGrade(grade) {
    this._forcedGrade = ['A', 'B', 'C', 'D'].includes(grade) ? grade : null
    return this._forcedGrade
  }

  /**
   * 直接写入评级记录（**只用于验证结业评定的三档与公式**）。
   *
   * 与真实路径的区别只有一个：真实路径由 `settle()` 写（且只在 `ch.rated` 时写）。
   * 本钩子不碰钱、不碰解锁、不碰任何市场量 —— 于是可以断言
   * 「改评级 → 解锁集合不变」与「评级达到阈值 → 档位变化」这两件事互不牵连。
   */
  devSetChapterGrades(grades = {}) {
    this.chapterGrades = {}
    if (grades && typeof grades === 'object' && !Array.isArray(grades)) {
      for (const [key, value] of Object.entries(grades)) {
        const id = Number(key)
        if (Number.isFinite(id) && ['A', 'B', 'C', 'D'].includes(value)) this.chapterGrades[id] = value
      }
    }
    this.save()
    return { ...this.chapterGrades }
  }

  /** 程序化推进一个开市日（等价于「进入下一交易日」）。 */
  devAdvanceDay({ changes = null, viaAdvance = true } = {}) {
    this.sim?.advanceDay?.()
    return this.onMarketOpen({ changes, viaAdvance })
  }

  /** 一键补足本金（外来入金，PRD §3.6）：`cash += ¥100,000 − NAV`，只恢复可操作性。 */
  devTopUpCapital() {
    const result = this.sim?.topUpCapital?.() || null
    if (result) {
      this.noteInjection(result.injection)
      this._syncFromWorld()
    }
    return result
  }
}

export default ChapterRuntime
