/**
 * PanelHost —— 互动容器：把面板 spec（`blocks[] + actions[]`）渲染进 `ChapterOverlay` 的内容宿主。
 *
 * 数据结构（`config/chapters.json` 的 `chapters[i].panels[panelId]`，本视图**不自造 schema**）：
 *
 *   {
 *     id, kind, title,
 *     blocks: [
 *       { type:'text',       id, label?, text?, source? },
 *       { type:'kvRows',     id, rows:[{ key, label, source }] },
 *       { type:'list',       id, label?, items?|source? },
 *       { type:'bigNumber',  id, label, value?|source? },
 *       { type:'choiceGroup',id, choiceId },
 *       { type:'formula',    id, label?, expression, notes[] },
 *       { type:'steps',      id, source },                       // 加演 / 补救段正文
 *       { type:'conceptCard',id, conceptKey },                   // 概念卡（查 concepts.json）
 *       { type:'ruleCard',   id, title, conceptKey, text },      // 第二章四张规则卡
 *       { type:'eventCard',  id, source }                        // 当日事件卡
 *       { type:'tower',      id, name, tagline, lines[], mentorLine },   // 第四章：三栋楼（代码绘制门脸）
 *       { type:'orderBook',  id, label, bids[], asks[], last, spread, notes[] }, // 第四章：挂单簿 / 撮合
 *       { type:'matchGame',  id, gameId },                       // 第四章：配对游戏（查 chapter.matchGames）
 *       { type:'flowWalk',   id, walkId }                        // 第四章：流程图走查（查 chapter.flowWalks）
 *     ],
 *     actions: [ { id, label } ]
 *   }
 *
 * 第四章的两个新互动块（`matchGame` / `flowWalk`）**不产生任何读条目**、也不自判对错：
 * 卡片点击只调 `runtime.chapterMatch / chapterFlowStep`，进度只从快照的
 * `chapter.matchProgress / flowProgress` 投影回来 —— 视图不持有进度、不记录错误次数、
 * 不显示任何「错」字样（错配 / 错序只让这一步不算，从不锁任何控件）。
 * 上一击的结果以 `block.dataset.lastResult` 如实暴露（机器可读，不生成用户文案）。
 *
 * 两条结构性硬保证：
 *   1. **「互动不被打成段落」**：`blocks[]` 非空而 `actions[]` 为空的面板**不允许打开** ——
 *      本视图在这样的 spec 上拒绝渲染并同步关闭面板（读一段文字不可能满足任何 `require`）。
 *   2. **`read` 计数只能由玩家读出来**：面板参与 `read` 完成条件时，每个「可读条目」
 *      （`kvRows` 逐行、其余整块）需要玩家逐个点开才算读过，点一个上报一次
 *      `runtime.chapterRead(panelId, 1)`（累加口径）。没有读交互就没有计数。
 *
 * 动作路由（`actions[].id` 是数据里的字符串，本视图按**声明后缀**分派，不新增 schema）：
 *   `.closePanel` → `runtime.closePanel(panelId)`
 *   `.continue`   → `runtime.advanceEndPhase()`          （章末：结算 → 加演/补救 → 确认）
 *   `.finish`     → 确认面板 `runtime.confirmChapter()`；加演/补救段先 `advanceExtraStep()`
 *   `.topUp`      → `runtime.devTopUpCapital()`          （「一键补足本金」，与 eval 钩子同一路径）
 * 若 id 恰好等于本拍某个 `interact` / `advanceDay` 完成条件的 id，则优先走
 * `runtime.chapterAck(id)` —— 于是 DOM 点击与测试钩子完全同路。
 *
 * 数值格式与配色：金额 `¥`、比率 `%`、分数为纯数；**盈亏与涨跌幅**用 `--up` / `--down`（涨红跌绿），
 * **成交价与费用**这类「委托结果」用 `--ok` 蓝青，**拒单**用 `--reject` 琥珀 —— 两套色永不互换。
 */

import { clear, dirClass, el, fmtMoney, fmtNum, fmtPct, fmtSignedMoney } from '../kit.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

function toArray(doc, key) {
  if (Array.isArray(doc)) return doc
  if (doc && Array.isArray(doc[key])) return doc[key]
  return []
}

/** 成交价 / 费用 = 「委托结果」，用蓝青；不复用涨跌色。 */
const ORDER_RESULT_SOURCES = new Set(['lastBuy.fillPrice', 'lastSell.fillPrice', 'trade.fee'])
/** 盈亏 = 涨跌方向，用红绿。 */
const DIRECTION_SOURCES = new Set(['trade.realizedPnL'])
/** 比率口径的来源（按百分比展示）。 */
const PERCENT_SOURCES = new Set(['rating.rar', 'rating.maxDD', 'rating.costRatio', 'rating.marketMove'])
/** 金额口径的来源。 */
const MONEY_SOURCES = new Set(['lastBuy.fillPrice', 'lastSell.fillPrice', 'trade.fee', 'trade.realizedPnL'])

const DASH = '—'

/** 导师的展示名（与对话层同一处约定，见 `DialogueLayerView.SPEAKER_FACE`）。 */
const SPEAKER_FACE = '老周'

export default class PanelHost {
  constructor(ui, cfg = {}) {
    this.ui = ui
    this.runtime = cfg.runtime || null
    this.overlay = cfg.overlay || null
    this.chapters = toArray(cfg.chapters, 'chapters')
    this.concepts = toArray(cfg.concepts, 'concepts')
    this.conceptByKey = new Map(this.concepts.map((c) => [c.key, c]))
    this.instruments = toArray(cfg.instruments, 'instruments')
    this._instrumentName = new Map(this.instruments.map((i) => [i.id, i.name]))

    this._state = null
    this._rendered = new Map() // panelId -> 内容签名
    this._read = new Set() // `${panelId}::${unitKey}`
    this._reported = new Map() // panelId -> 已上报的读条目数
    this._lastBuy = null
    this._lastSell = null
    /** 配对游戏中**已被选中**的那张卡（纯视图状态；进度只读快照）。 */
    this._pickedCard = null
  }

  // ============================================================ 入口

  update(state) {
    if (state && typeof state === 'object') this._state = { ...state, chapter: state.chapter }
    this._observeOrders(state)

    const ch = chapterOf(this._state)
    const panelId = ch.panelId || null
    if (!panelId) {
      this._closeActive()
      return
    }
    const spec = this.panelSpec(ch.chapterId, panelId)
    const blocks = (spec && spec.blocks) || []
    const actions = (spec && spec.actions) || []

    // 结构性保证 1：blocks[] 无 actions[] 的面板不得打开（「互动不被打成段落」）
    if (blocks.length > 0 && actions.length === 0) {
      console.warn(
        `PanelHost: refusing to open "${panelId}" — blocks[] present but actions[] empty ` +
          '(a beat must never be satisfiable by merely displaying text)',
      )
      this._closeActive()
      return
    }
    if (!this.overlay) return

    this.overlay.showPanel(panelId) // 真暂停 + 互斥（切换在同一次同步调用内完成）
    if (spec && spec.title) this.overlay.setPanelTitle(panelId, spec.title)

    const body = this.overlay.getPanelBody(panelId)
    const foot = this.overlay.getPanelFoot(panelId)
    if (!body || !foot) return

    const signature = this._signature(panelId, spec, ch)
    if (this._rendered.get(panelId) === signature) {
      this._syncPause()
      return
    }
    this._rendered.set(panelId, signature)

    const scrollTop = body.scrollTop
    clear(body)
    clear(foot)
    this._renderBody(panelId, spec, blocks, ch, body)
    this._renderActions(panelId, actions, ch, foot)
    body.scrollTop = scrollTop
    this._syncPause()
  }

  /** 面板 spec 的唯一来源：`config/chapters.json`。 */
  panelSpec(chapterId, panelId) {
    const chapter = this.chapters.find((c) => Number(c.id) === Number(chapterId))
    if (!chapter || !chapter.panels) return null
    return chapter.panels[panelId] || null
  }

  // ============================================================ 关闭与暂停同步

  _closeActive() {
    this._rendered.clear()
    if (this.overlay) this.overlay.hidePanel()
    this._syncPause()
  }

  _syncPause() {
    const paused = this.overlay ? this.overlay.isPaused() : false
    this.runtime?.notePanelPause?.(paused)
    return paused
  }

  /**
   * 控件回调后刷新自己：先向运行时取最新章节快照，再重渲染。
   * 宿主 Node 若自己有 refresh 循环，调用 `update()` 同样有效（本方法是幂等的）。
   */
  refresh() {
    const runtime = this.runtime
    if (this._state && runtime && typeof runtime.snapshot === 'function') {
      const chapter = runtime.snapshot()
      if (this._state.chapter) this._state.chapter = chapter
      else Object.assign(this._state, chapter)
    }
    if (this._state) this.update(this._state)
    return this
  }

  // ============================================================ 读交互

  /** 面板是否在某个 `read` 完成条件里（不在的话不做「逐条点开」的读交互）。 */
  _readSpec(ch, panelId) {
    const requires = (ch.beat && ch.beat.require) || []
    return requires.find((r) => r && r.kind === 'read' && r.panelId === panelId) || null
  }

  _unitKey(block, row) {
    return row ? `${block.id || block.type}:${row.key}` : String(block.id || block.type)
  }

  _isRead(panelId, unitKey) {
    return this._read.has(`${panelId}::${unitKey}`)
  }

  _readCount(panelId) {
    let n = 0
    for (const key of this._read) if (key.startsWith(`${panelId}::`)) n += 1
    return n
  }

  _markRead(panelId, unitKey) {
    const key = `${panelId}::${unitKey}`
    if (this._read.has(key)) return false
    this._read.add(key)
    const total = this._readCount(panelId)
    const reported = this._reported.get(panelId) || 0
    if (total > reported) {
      this._reported.set(panelId, total)
      this.runtime?.chapterRead?.(panelId, total - reported)
    }
    this.refresh()
    return true
  }

  /**
   * 每个块贡献几个「可读条目」：`kvRows` 逐行、`list` 逐项、`steps` 逐步，其余整块算一条。
   * 单条目的块由 `_raw()` 统一挂读标记；多条目的块各自在行/项/步上挂。
   */
  _unitsOf(block, ch) {
    if (block.type === 'choiceGroup') return []
    if (block.type === 'kvRows') {
      const rows = block.rows || []
      if (rows.length) return rows.map((row) => ({ row, unitKey: this._unitKey(block, row) }))
    }
    if (block.type === 'list') {
      const items = this._listItems(block, ch)
      if (items.length) return items.map((item, i) => ({ item, index: i, unitKey: `${block.id || 'list'}:${i}` }))
    }
    if (block.type === 'steps') {
      const steps = this._stepsOf(block, ch)
      if (steps.length) return steps.map((step, i) => ({ step, index: i, unitKey: `${block.id || 'steps'}:${i}` }))
    }
    return [{ unitKey: this._unitKey(block) }]
  }

  /** 由块自己渲染行标记的块型（其余块型由 `_raw()` 在整块上挂标记）。 */
  _selfMarking(type) {
    return (
      type === 'kvRows' ||
      type === 'list' ||
      type === 'steps' ||
      type === 'conceptCard' ||
      type === 'ruleCard' ||
      type === 'eventCard' ||
      // 第四章的互动块型：信息全部由代码绘制，**不是可读条目**
      // （配对 / 走查的进度由玩家亲手做出来，不是「读过」）
      type === 'tower' ||
      type === 'orderBook' ||
      type === 'matchGame' ||
      type === 'flowWalk' ||
      // 第三章的产品对比与招募说明书：**都是可读条目**，逐行 / 逐字段点开才计数
      type === 'compare' ||
      type === 'docCard'
    )
  }

  // ============================================================ 内容签名

  _signature(panelId, spec, ch) {
    const choice = ch.pendingChoice
    const seg = ch.extraSegment
    return [
      panelId,
      ch.beatId,
      spec ? spec.kind : '',
      choice ? `${choice.id}:${choice.answeredKey || ''}` : '',
      this._readCount(panelId),
      ch.moneyTier,
      ch.rating ? `S${ch.rating.S}:${ch.rating.grade}` : '',
      ch.endPhase,
      seg ? `${seg.kind}:${seg.stepIndex}` : '',
      this._lastBuy ? 'B' : '',
      this._lastSell ? 'S' : '',
      // 配对 / 走查的进度也是内容：进度变了必须重绘（进度只来自快照，视图不自己存）
      JSON.stringify(ch.matchProgress || {}),
      JSON.stringify(ch.flowProgress || {}),
    ].join('|')
  }

  // ============================================================ 渲染：内容

  _renderBody(panelId, spec, blocks, ch, body) {
    const readSpec = this._readSpec(ch, panelId)
    const ctx = {
      panelId,
      spec,
      ch,
      state: this._state || {},
      readable: Boolean(readSpec),
      concepts: this.conceptByKey,
      namespace: spec && spec.id ? spec.id : panelId,
    }
    for (const block of blocks) {
      const node = this._renderBlock(block, ctx)
      if (node) body.appendChild(node)
    }
    if (readSpec && this._readCount(panelId) < Number(readSpec.count || 1)) {
      el('div', 'ch-mark-hint', body, readSpec.label || '')
    }
  }

  _renderBlock(block, ctx) {
    if (!block || !block.type) return null
    switch (block.type) {
      case 'text':
        return this._blockText(block, ctx)
      case 'bigNumber':
        return this._blockBigNumber(block, ctx)
      case 'kvRows':
        return this._blockKvRows(block, ctx)
      case 'list':
        return this._blockList(block, ctx)
      case 'formula':
        return this._blockFormula(block, ctx)
      case 'choiceGroup':
        return this._blockChoiceGroup(block, ctx)
      case 'steps':
        return this._blockSteps(block, ctx)
      case 'conceptCard':
        return this._blockConceptCard(block, ctx)
      case 'ruleCard':
        return this._blockRuleCard(block, ctx)
      case 'eventCard':
        return this._blockEventCard(block, ctx)
      case 'tower':
        return this._blockTower(block, ctx)
      case 'orderBook':
        return this._blockOrderBook(block, ctx)
      case 'matchGame':
        return this._blockMatchGame(block, ctx)
      case 'flowWalk':
        return this._blockFlowWalk(block, ctx)
      case 'compare':
        return this._blockCompare(block, ctx)
      case 'docCard':
        return this._blockDocCard(block, ctx)
      default:
        // 未知块型：渲染可读的原始标签而不是占位矩形（数据驱动，视图不吞掉信息）
        console.warn(`PanelHost: unknown block type "${block.type}"`)
        return this._blockText({ type: 'text', id: block.id, label: block.type, text: String(block.text || '') }, ctx)
    }
  }

  _readable(node, block, ctx, unitKey) {
    if (!ctx.readable) return node
    const on = this._isRead(ctx.panelId, unitKey)
    node.classList.add('readable')
    node.dataset.readKey = unitKey
    node.classList.toggle('on', on)
    node.setAttribute('role', 'button')
    node.setAttribute('aria-pressed', on ? 'true' : 'false')
    const mark = el('span', 'mk', null)
    mark.innerHTML = on
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7FD3E8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.4l2.7 2.6L16 9.6"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A5568" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>'
    node.appendChild(mark)
    node.addEventListener('click', () => this._markRead(ctx.panelId, unitKey))
    return node
  }

  // ---- text ----

  _blockText(block, ctx) {
    const box = el('div', 'ch-text')
    const resolved = block.text !== undefined ? { value: block.text, found: true } : this._resolve(block.source, ctx)
    box.textContent = resolved.found ? String(resolved.value ?? '') : DASH
    if (!resolved.found && block.source) box.dataset.chUnresolved = String(block.source)
    return this._raw(block, ctx, box)
  }

  /**
   * 块外壳。`block.label` 是数据给的字段名，默认渲染（`bigNumber` 自己在卡内渲染，故传 `false`）。
   * 单条目的块（text / bigNumber / formula / 各类卡片）在这里统一挂「点开才算读过」的读标记。
   */
  _raw(block, ctx, node, { label = true } = {}) {
    const box = el('div', 'ch-blk')
    box.dataset.blockId = String(block.id || block.type)
    box.dataset.blockType = block.type
    if (label && block.label) el('div', 'ch-blk-label', box, block.label)
    box.appendChild(node)
    if (ctx.readable && !this._selfMarking(block.type)) {
      const units = this._unitsOf(block, ctx.ch)
      if (units.length === 1) this._readable(box, block, ctx, units[0].unitKey)
    }
    return box
  }

  // ---- bigNumber ----

  _blockBigNumber(block, ctx) {
    const box = el('div', 'ch-big')
    if (block.label) el('div', 'lab', box, block.label)
    const resolved =
      block.value !== undefined ? { value: block.value, found: true } : this._resolve(block.source, ctx)
    const formatted = this._format(block.source, resolved.value, resolved.found)
    const valueEl = el('div', `v num${formatted.cls ? ` ${formatted.cls}` : ''}`, box, formatted.text)
    valueEl.dataset.source = String(block.source || '')
    if (!resolved.found && block.source) box.dataset.chUnresolved = String(block.source)
    else if (String(formatted.text).length > 9) valueEl.classList.add('sm')
    return this._raw(block, ctx, box, { label: false })
  }

  // ---- kvRows ----

  _blockKvRows(block, ctx) {
    const box = el('div', 'ch-kv')
    for (const row of block.rows || []) {
      const unitKey = this._unitKey(block, row)
      const rowEl = el('div', 'ch-kvr')
      rowEl.dataset.rowKey = String(row.key || '')
      rowEl.dataset.source = String(row.source || '')
      el('div', 'k', rowEl, row.label || row.key || '')
      const resolved = this._resolve(row.source, ctx)
      const formatted = this._format(row.source, resolved.value, resolved.found)
      const valueEl = el('div', `v num${formatted.cls ? ` ${formatted.cls}` : ''}`, rowEl, formatted.text)
      valueEl.dataset.source = String(row.source || '')
      if (!resolved.found) {
        rowEl.classList.add('unresolved')
        rowEl.dataset.chUnresolved = String(row.source || '')
      }
      this._readable(rowEl, block, ctx, unitKey)
      box.appendChild(rowEl)
    }
    return this._raw(block, ctx, box)
  }

  // ---- compare（产品并排对照，第三章 3.2）----
  //
  // 全游戏唯一一次「把两个产品放在同一张桌上看」。左列 / 右列逐项对齐，
  // 每一行是一个**可读条目**（点开才算读过），与 `kvRows` 同一套 read 计数口径。
  // 行内 `note` 是老周的补充话，不占读数。

  _blockCompare(block, ctx) {
    const box = el('div', 'ch-cmp')
    box.dataset.leftLabel = String(block.leftLabel || '')
    box.dataset.rightLabel = String(block.rightLabel || '')
    const head = el('div', 'ch-cmp-h', box)
    el('div', 'k', head, '')
    el('div', 'lt', head, block.leftLabel || '左')
    el('div', 'rt', head, block.rightLabel || '右')
    for (const row of block.rows || []) {
      const unitKey = this._unitKey(block, row)
      const rowEl = el('div', 'ch-cmp-r', box)
      rowEl.dataset.rowKey = String(row.key || '')
      el('div', 'k', rowEl, row.label || row.key || '')
      el('div', 'lt', rowEl, row.left || '')
      el('div', 'rt', rowEl, row.right || '')
      if (row.note) el('div', 'nt', rowEl, row.note)
      this._readable(rowEl, block, ctx, unitKey)
    }
    return this._raw(block, ctx, box)
  }

  // ---- docCard（码排版的文档，第三章的基金招募说明书）----
  //
  // **由代码排版，不是图片**：字段逐条列出，每条可点开（计入 read）。
  // `fields[] = { key, label, value, note? }`。

  _blockDocCard(block, ctx) {
    const box = el('div', 'ch-doc')
    if (block.title) el('div', 'ch-doc-t', box, block.title)
    if (block.subtitle) el('div', 'ch-doc-s', box, block.subtitle)
    const body = el('div', 'ch-doc-b', box)
    for (const f of block.fields || []) {
      const unitKey = this._unitKey(block, f)
      const rowEl = el('div', 'ch-kvr ch-doc-f', body)
      rowEl.dataset.rowKey = String(f.key || '')
      el('div', 'k', rowEl, f.label || f.key || '')
      el('div', 'v', rowEl, f.value || '')
      if (f.note) el('div', 'nt', rowEl, f.note)
      this._readable(rowEl, block, ctx, unitKey)
    }
    return this._raw(block, ctx, box)
  }

  // ---- list ----

  _listItems(block, ch) {
    if (Array.isArray(block.items)) return block.items
    const resolved = this._resolve(block.source, { ch })
    return Array.isArray(resolved.value) ? resolved.value : []
  }

  _blockList(block, ctx) {
    const items = this._listItems(block, ctx.ch)
    const box = el('div', 'ch-list')
    if (!items.length) {
      const empty = el('div', 'ch-li', box)
      el('div', 'idx', empty, DASH)
      el('div', '', empty, '')
      return this._raw(block, ctx, box)
    }
    items.forEach((item, index) => {
      const unitKey = `${block.id || 'list'}:${index}`
      const rowEl = el('div', 'ch-li')
      el('div', 'idx', rowEl, String(index + 1))
      const text = typeof item === 'string' ? item : item && (item.text || item.label || item.title) || ''
      el('div', '', rowEl, String(text))
      if (ctx.readable) {
        rowEl.dataset.readKey = unitKey
        rowEl.classList.add('readable')
        rowEl.setAttribute('role', 'button')
        rowEl.addEventListener('click', () => this._markRead(ctx.panelId, unitKey))
      }
      box.appendChild(rowEl)
    })
    return this._raw(block, ctx, box)
  }

  // ---- formula（公式可见：表达式 + 口径说明 + 本次的逐项代入值）----

  _blockFormula(block, ctx) {
    const box = el('div', 'ch-formula')
    if (block.expression) el('div', 'expr', box, String(block.expression))
    if (Array.isArray(block.notes) && block.notes.length) {
      const list = el('ul', 'notes', box)
      for (const note of block.notes) el('li', '', list, String(note))
    }
    const live = this._formulaLiveValues(ctx.ch)
    if (live.length) {
      const meta = el('div', 'meta', box)
      for (const entry of live) {
        const chip = el('span', 'ch-chip', meta)
        chip.textContent = `${entry.key} ${entry.text}`
        chip.dataset.key = entry.key
      }
    }
    return this._raw(block, ctx, box)
  }

  /**
   * 「不得用综合评分掩盖算法」：把 `ratingParams` 的常量与 `ratingInputs` 的本次代入值
   * 逐项摊开。键名直接取自运行时快照的字段名（数据，不是新文案）。
   */
  _formulaLiveValues(ch) {
    const out = []
    const inputs = ch.ratingInputs || {}
    const params = ch.ratingParams || {}
    const num = (key, value) => {
      if (value === null || value === undefined || value === '') return null
      const n = Number(value)
      if (!Number.isFinite(n)) return null
      if (key === 'rar' || key === 'maxDD' || key === 'costRatio' || key === 'marketMove') {
        return { key, text: fmtPct(n) }
      }
      if (/nav|fees|notional|injection|pnl/i.test(key)) return { key, text: fmtMoney(n) }
      return { key, text: fmtNum(n, key === 'S' ? 2 : 4) }
    }
    for (const key of [
      'navStart',
      'navNow',
      'feesInWindow',
      'notionalInWindow',
      'externalInjectionInWindow',
      'excludedPnl',
      'rar',
      'maxDD',
      'costRatio',
      'baseScore',
      'ddPenalty',
      'costPenalty',
      'S',
    ]) {
      const entry = num(key, inputs[key])
      if (entry) out.push(entry)
    }
    for (const key of Object.keys(params)) {
      const entry = num(key, params[key])
      if (entry) out.push(entry)
    }
    return out
  }

  // ---- choiceGroup（作答由玩家点选项完成；从不判对错）----

  _blockChoiceGroup(block, ctx) {
    const choice = ctx.ch.pendingChoice
    const box = el('div', 'ch-choice')
    if (!choice || (block.choiceId && choice.id !== block.choiceId)) {
      box.dataset.chUnresolved = String(block.choiceId || '')
      return this._raw(block, ctx, box)
    }
    el('div', 'ch-question', box, choice.question || '')
    for (const option of choice.options || []) {
      const btn = el('button', 'ch-opt', box)
      btn.type = 'button'
      btn.dataset.choiceId = choice.id
      btn.dataset.key = option.key
      el('span', 'mk', btn)
      el('span', '', btn, option.text || '')
      btn.classList.toggle('picked', choice.answeredKey === option.key)
      btn.addEventListener('click', () => {
        this.runtime?.chapterAnswer?.(choice.id, option.key)
        this.refresh()
      })
    }
    const feedback = choice.answeredKey ? (choice.feedbackByOption || {})[choice.answeredKey] : ''
    if (feedback) el('div', 'ch-feedback', box, feedback)
    return this._raw(block, ctx, box)
  }

  // ---- steps（加演 / 补救段正文；不增加 beatCount）----

  _stepsOf(block, ch) {
    const seg = ch.extraSegment
    if (seg && Array.isArray(seg.steps) && seg.steps.length) return seg.steps
    const resolved = this._resolve(block.source, { ch })
    return Array.isArray(resolved.value) ? resolved.value : []
  }

  _blockSteps(block, ctx) {
    const seg = ctx.ch.extraSegment
    const steps = this._stepsOf(block, ctx.ch)
    const box = el('div', 'ch-steps')
    if (seg) {
      const head = el('div', 'ch-card-blk', box)
      const hd = el('div', 'hd', head)
      el('div', 't', hd, seg.label || '')
      el('div', 'tag', hd, seg.kind || '')
      if (seg.marketNote) el('div', 'def', head, seg.marketNote)
      else if (seg.mentorLine) el('div', 'exp', head, seg.mentorLine)
    }
    steps.forEach((step, index) => {
      const unitKey = `${block.id || 'steps'}:${index}`
      const node = el('div', 'ch-step')
      node.dataset.stepIndex = String(index)
      node.classList.toggle('on', Number(seg && seg.stepIndex) === index)
      const hd = el('div', 'hd', node)
      el('div', 't', hd, (step && step.title) || '')
      el('div', 'n', hd, `${index + 1}/${steps.length}`)
      el('div', 'x', node, (step && step.text) || '')
      if (ctx.readable) {
        node.classList.add('readable')
        node.dataset.readKey = unitKey
        node.setAttribute('role', 'button')
        node.addEventListener('click', () => this._markRead(ctx.panelId, unitKey))
      }
      box.appendChild(node)
    })
    return this._raw(block, ctx, box)
  }

  // ---- conceptCard / ruleCard / eventCard ----

  _blockConceptCard(block, ctx) {
    const concept = ctx.concepts.get(block.conceptKey) || null
    const card = el('div', 'ch-card-blk')
    card.dataset.conceptKey = String(block.conceptKey || '')
    if (!concept) card.dataset.chMissing = String(block.conceptKey || '')
    const hd = el('div', 'hd', card)
    el('div', 't', hd, concept ? concept.name : String(block.conceptKey || ''))
    if (concept && concept.advanced) el('div', 'tag', hd, String(concept.chapter || ''))
    if (concept && concept.def) el('div', 'def', card, concept.def)
    if (concept && concept.explain) el('div', 'exp', card, concept.explain)
    if (concept && concept.metaphor) el('div', 'exp', card, concept.metaphor)
    if (concept && Array.isArray(concept.related) && concept.related.length) {
      const meta = el('div', 'meta', card)
      for (const key of concept.related) {
        const chip = el('span', 'ch-chip', meta)
        chip.textContent = key
      }
    }
    this._readable(card, block, ctx, this._unitKey(block))
    return this._raw(block, ctx, card)
  }

  _blockRuleCard(block, ctx) {
    const card = el('div', 'ch-card-blk')
    card.dataset.ruleId = String(block.id || '')
    card.dataset.conceptKey = String(block.conceptKey || '')
    const hd = el('div', 'hd', card)
    el('div', 't', hd, String(block.title || ''))
    if (block.conceptKey) el('div', 'tag', hd, String(block.conceptKey))
    if (block.text) el('div', 'ch-rule-text', card, String(block.text))
    const concept = block.conceptKey ? ctx.concepts.get(block.conceptKey) : null
    if (concept && concept.explain) el('div', 'exp', card, concept.explain)
    this._readable(card, block, ctx, this._unitKey(block))
    return this._raw(block, ctx, card)
  }

  _blockEventCard(block, ctx) {
    const resolved = this._resolve(block.source || 'currentEvent', ctx)
    const event = resolved.value || null
    const box = el('div', 'ch-ev')
    if (!event) {
      // 没有当日事件时也要留下可读条目，否则这一拍的 read 完成条件永远无法满足
      box.dataset.chUnresolved = String(block.source || 'currentEvent')
      this._readable(box, block, ctx, this._unitKey(block))
      return this._raw(block, ctx, box)
    }
    if (event.headline) el('div', 'headline', box, String(event.headline))
    if (event.mentorLine) el('div', 'mentor', box, String(event.mentorLine))
    const meta = el('div', 'sent', box)
    for (const value of [event.id, event.type, event.sentiment]) {
      if (!value) continue
      const chip = el('span', 'ch-chip', meta)
      chip.textContent = String(value)
    }
    for (const target of event.targets || []) {
      const chip = el('span', 'ch-chip', meta)
      chip.textContent = this._instrumentName.get(target) || String(target)
    }
    this._readable(box, block, ctx, this._unitKey(block))
    return this._raw(block, ctx, box)
  }

  // ============================================================ 第四章：代码绘制块型
  //
  // 三栋楼 / 挂单簿 / 配对卡 / 流程图**全部由 DOM + CSS 绘制**：不依赖任何位图素材
  // （项目注册的素材只有 `mentor_portrait` 与 `scene_bank`），也没有 `<canvas>` 与 `Phaser.Text`。
  // 配色：挂单本身既不是涨跌也不是委托结果 → 一律中性色；**成交价 / 费用**才用 `--ok`（委托结果族色）。

  /** 第四章的配对游戏定义（数据源 = 本章 `matchGames`；视图不自造 schema）。 */
  _matchGameOf(chapterId, gameId) {
    const chapter = this.chapters.find((c) => Number(c.id) === Number(chapterId))
    if (!chapter || !chapter.matchGames || !gameId) return null
    return chapter.matchGames[gameId] || null
  }

  /** 第四章的流程走查定义（数据源 = 本章 `flowWalks`）。 */
  _flowWalkOf(chapterId, walkId) {
    const chapter = this.chapters.find((c) => Number(c.id) === Number(chapterId))
    if (!chapter || !chapter.flowWalks || !walkId) return null
    return chapter.flowWalks[walkId] || null
  }

  // ---- tower：三栋楼的门脸（屋顶 / 招牌 / 窗格 / 门，纯 CSS 画）----

  _blockTower(block, ctx) {
    const box = el('div', 'ch-tower')
    box.dataset.tower = String(block.name || '')
    const facade = el('div', 'facade', box)
    el('div', 'roof', facade)
    el('div', 'sign', facade, String(block.name || ''))
    const grid = el('div', 'win', facade)
    for (let i = 0; i < 20; i += 1) el('i', '', grid)
    el('div', 'door', facade)
    el('div', 'base', facade)

    const body = el('div', 'bd', box)
    el('div', 'nm', body, String(block.name || ''))
    if (block.tagline) el('div', 'tg', body, String(block.tagline))
    const lines = Array.isArray(block.lines) ? block.lines : []
    if (lines.length) {
      const ul = el('ul', 'lines', body)
      for (const line of lines) el('li', '', ul, String(line))
    }
    if (block.mentorLine) {
      const say = el('div', 'say', body)
      el('div', 'who', say, SPEAKER_FACE)
      el('div', 'x', say, String(block.mentorLine))
    }
    return this._raw(block, ctx, box)
  }

  // ---- orderBook：挂单簿（买卖两侧的价 / 量，量用条宽表示）----

  _blockOrderBook(block, ctx) {
    const box = el('div', 'ch-book')
    if (block.label) el('div', 'bk-lab', box, String(block.label))
    const asks = Array.isArray(block.asks) ? block.asks : []
    const bids = Array.isArray(block.bids) ? block.bids : []
    const maxQty = Math.max(1, ...[...asks, ...bids].map((r) => Number(r.qty) || 0))

    const grid = el('div', 'bk-grid', box)
    const renderSide = (cls, title, rows) => {
      const side = el('div', `bk-col ${cls}`, grid)
      el('div', 'hd', side, title)
      // 挂单簿的阅读顺序：卖盘价从高到低、买盘价从高到低（离成交最近的排在最下）
      for (const row of [...rows].reverse()) {
        const line = el('div', 'bk-row', side)
        el('div', 'p num', line, fmtMoney(Number(row.price)))
        el('div', 'q num', line, String(Number(row.qty) || 0))
        const bar = el('i', 'bar', line)
        bar.style.width = `${Math.round(((Number(row.qty) || 0) / maxQty) * 100)}%`
      }
    }
    renderSide('asks', '卖出挂单', asks)
    renderSide('bids', '买入挂单', bids)

    const deal = el('div', 'bk-deal', box)
    if (block.last && Number.isFinite(Number(block.last.price))) {
      // 成交价属于「委托结果」族色（`--ok`），绝不用涨跌方向色
      const chip = el('span', 'ch-chip ok', deal)
      chip.dataset.role = 'last'
      chip.textContent = `这一笔成交 ${fmtMoney(Number(block.last.price))} × ${Number(block.last.qty) || 0}`
    }
    if (block.spread !== undefined && block.spread !== null) {
      const chip = el('span', 'ch-chip', deal)
      chip.dataset.role = 'spread'
      chip.textContent = `买卖价差 ${fmtMoney(Number(block.spread))}`
    }
    for (const note of Array.isArray(block.notes) ? block.notes : []) {
      el('div', 'bk-note', box, String(note))
    }
    return this._raw(block, ctx, box)
  }

  // ---- matchGame：把机构卡配到职责上（第四章核心互动）----

  _blockMatchGame(block, ctx) {
    const box = el('div', 'ch-mg')
    const gameId = String(block.gameId || '')
    box.dataset.gameId = gameId
    const game = this._matchGameOf(ctx.ch.chapterId, gameId)
    if (!game) {
      box.dataset.chUnresolved = gameId
      return this._raw(block, ctx, box)
    }
    const pairs = game.pairs || []
    const prog = ((ctx.ch.matchProgress || {})[gameId]) || { pairsDone: [] }
    const done = new Set((prog.pairsDone || []).map(String))
    const pairOfCard = (cardId) => pairs.find((p) => String(p.cardId) === String(cardId)) || null
    const targetText = (key) => {
      const hit = (game.targets || []).find((t) => String(t.key) === String(key))
      return hit ? String(hit.text || hit.label || key) : ''
    }

    el('div', 'mg-prompt', box, String(game.prompt || ''))
    el('div', 'mg-prog', box, `已配对 ${done.size}/${pairs.length}`)

    const cardsWrap = el('div', 'mg-cards', box)
    for (const card of game.cards || []) {
      const id = String(card.id)
      const isDone = done.has(id)
      const btn = el('button', `mg-card${isDone ? ' done' : ''}`, cardsWrap)
      btn.type = 'button'
      btn.dataset.cardId = id
      el('span', 'nm', btn, String(card.name || ''))
      if (card.sub) el('span', 'sub', btn, String(card.sub))
      if (isDone) {
        const pair = pairOfCard(id)
        el('span', 'mk', btn, pair ? targetText(pair.targetKey) : '已配对')
      }
      btn.setAttribute('aria-pressed', this._pickedCard === id ? 'true' : 'false')
      btn.classList.toggle('picked', this._pickedCard === id)
      btn.addEventListener('click', () => {
        // 选中只是**视图**的视觉状态：配对成立与否只由运行时判定
        this._pickedCard = this._pickedCard === id ? null : id
        this._syncPicked(box)
        box.dataset.lastResult = JSON.stringify({ ok: true, picked: this._pickedCard })
      })
    }

    const targetsWrap = el('div', 'mg-targets', box)
    for (const target of game.targets || []) {
      const key = String(target.key)
      const btn = el('button', 'mg-target', targetsWrap)
      btn.type = 'button'
      btn.dataset.targetKey = key
      el('span', 't', btn, String(target.text || target.label || key))
      btn.addEventListener('click', () => {
        const card = this._pickedCard
        // 没选卡就不发动作（不是「错」—— 什么都没发生，也什么都没记）
        if (!card) {
          box.dataset.lastResult = JSON.stringify({ ok: false, reason: 'no_card_picked' })
          return
        }
        const result = this.runtime?.chapterMatch?.(gameId, card, key) || null
        // 上一击的结果如实暴露（机器可读），**不生成任何用户可见的「错」文案**
        box.dataset.lastResult = JSON.stringify(result)
        if (result && result.ok) this._pickedCard = null
        this.refresh()
      })
    }
    this._syncPicked(box)
    return this._raw(block, ctx, box)
  }

  /** 选中态是纯视觉的：只切类名，不改任何数据。 */
  _syncPicked(box) {
    for (const node of box.querySelectorAll('.mg-card')) {
      const on = node.dataset.cardId === this._pickedCard
      node.classList.toggle('picked', on)
      node.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    box.dataset.pickedCard = this._pickedCard || ''
  }

  // ---- flowWalk：这笔钱走过的环节（按正确顺序点出来）----

  _blockFlowWalk(block, ctx) {
    const box = el('div', 'ch-fw')
    const walkId = String(block.walkId || '')
    box.dataset.walkId = walkId
    const walk = this._flowWalkOf(ctx.ch.chapterId, walkId)
    if (!walk) {
      box.dataset.chUnresolved = walkId
      return this._raw(block, ctx, box)
    }
    const order = Array.isArray(walk.order) ? walk.order.map(String) : []
    const cards = Array.isArray(walk.cards) ? walk.cards : []
    const labelOf = (id) => {
      const hit = cards.find((c) => String(c.id) === id)
      return hit ? String(hit.label || hit.id) : id
    }
    const prog = ((ctx.ch.flowProgress || {})[walkId]) || { index: 0, done: [] }
    const done = (prog.done || []).map(String)

    el('div', 'fw-prompt', box, String(walk.prompt || ''))
    el('div', 'fw-prog', box, `已按顺序走完 ${done.length}/${order.length}`)

    const rail = el('div', 'fw-rail', box)
    if (!done.length) {
      el('div', 'fw-empty', rail, '还没走出第一步。')
    }
    done.forEach((id, index) => {
      const step = el('div', 'fw-step on', rail)
      el('div', 'n', step, String(index + 1))
      el('div', 'lb', step, labelOf(id))
    })

    const pool = el('div', 'fw-pool', box)
    for (const card of cards) {
      const id = String(card.id)
      const btn = el('button', `fw-card${done.includes(id) ? ' done' : ''}`, pool)
      btn.type = 'button'
      btn.dataset.stepId = id
      el('span', 'lb', btn, String(card.label || id))
      btn.addEventListener('click', () => {
        const result = this.runtime?.chapterFlowStep?.(walkId, id) || null
        box.dataset.lastResult = JSON.stringify(result)
        this.refresh()
      })
    }
    return this._raw(block, ctx, box)
  }

  // ============================================================ 渲染：动作

  _renderActions(panelId, actions, ch, foot) {
    foot.dataset.panelId = panelId
    actions.forEach((action, index) => {
      const isLast = index === actions.length - 1
      const kind = this._actionKind(action.id)
      const cls = kind === 'topUp' ? 'ch-btn gold' : isLast && actions.length > 1 ? 'ch-btn' : actions.length === 1 ? 'ch-btn' : 'ch-btn ghost'
      const btn = el('button', cls, foot, action.label || '')
      btn.type = 'button'
      btn.dataset.actionId = String(action.id || '')
      btn.addEventListener('click', () => this._runAction(action, panelId, ch))
    })
  }

  _actionKind(id) {
    const text = String(id || '')
    const dot = text.lastIndexOf('.')
    return dot >= 0 ? text.slice(dot + 1) : text
  }

  /** 动作分派。返回值写入 `foot.dataset.lastResult`，便于断言（不产生任何用户文案）。 */
  _runAction(action, panelId, ch) {
    const id = String(action.id || '')
    const foot = this.overlay ? this.overlay.getPanelFoot(panelId) : null
    let result = null

    // 与完成条件同 id → 走 chapterAck（DOM 点击与 eval 钩子完全同路）
    const requireSpec = ((ch.beat && ch.beat.require) || []).find((r) => r && r.id === id)
    if (requireSpec && (requireSpec.kind === 'interact' || requireSpec.kind === 'advanceDay')) {
      result = this.runtime?.chapterAck?.(id) || null
    } else {
      switch (this._actionKind(id)) {
        case 'closePanel':
          result = this.runtime?.closePanel?.(panelId) || null
          break
        case 'continue':
          result = { endPhase: this.runtime?.advanceEndPhase?.() }
          break
        case 'topUp':
          result = this.runtime?.devTopUpCapital?.() || null
          break
        case 'finish':
          result = this._finish(panelId, ch)
          break
        default:
          console.warn(`PanelHost: unknown action "${id}" — no runtime call made`)
          result = { ok: false, reason: 'unknown_action' }
      }
    }
    if (foot) foot.dataset.lastResult = JSON.stringify(result && result.reason ? result : { ok: true })
    this.refresh()
    return result
  }

  /**
   * `finish`：确认面板 → `confirmChapter()`（未答完时运行时会拒绝，这里只如实回报）；
   * 加演 / 补救段内的「继续」→ 先逐步走完 `advanceExtraStep()`，最后一步才结束段。
   */
  _finish(panelId, ch) {
    const end = ch.chapterEnd || {}
    if (end.extraPanelId && panelId === end.extraPanelId) {
      const seg = ch.extraSegment
      const total = seg && Array.isArray(seg.steps) ? seg.steps.length : 0
      if (seg && Number(seg.stepIndex) < total - 1) {
        return { ok: true, stepIndex: this.runtime?.advanceExtraStep?.() }
      }
      return { ok: true, segment: this.runtime?.completeExtraSegment?.() }
    }
    return this.runtime?.confirmChapter?.() || null
  }

  // ============================================================ 取数与格式化

  /** 复盘面板的三项来源没有直接快照字段，从 `lastOrder` 的成交记录里记下来（见交付说明的缺口）。 */
  _observeOrders(state) {
    const order = state && state.lastOrder
    if (!order || order.accepted !== true || order.status !== 'filled') return
    if (order.side === 'buy') this._lastBuy = { ...order }
    else if (order.side === 'sell') this._lastSell = { ...order }
  }

  _trade() {
    const buy = this._lastBuy
    const sell = this._lastSell
    const state = this._state || {}
    if (!buy && !sell) return null
    return {
      fee: (buy ? Number(buy.fee) || 0 : 0) + (sell ? Number(sell.fee) || 0 : 0),
      // 单笔往返时账户累计已实现盈亏 = 这笔的结果；无成交记录时退回账户口径
      realizedPnL: sell && Number.isFinite(Number(sell.realizedPnL)) ? sell.realizedPnL : Number(state.realizedPnL) || 0,
      notional: (buy ? Number(buy.notional) || 0 : 0) + (sell ? Number(sell.notional) || 0 : 0),
    }
  }

  /** `source` 路径解析：`rating.rar` / `lastBuy.fillPrice` / `currentEvent` / `extraSegment.steps` … */
  _resolve(source, ctx) {
    if (!source) return { value: null, found: false }
    const scope = this._scope(ctx)
    const parts = String(source).split('.')
    let cursor = scope
    for (const part of parts) {
      if (cursor === null || cursor === undefined || typeof cursor !== 'object') return { value: null, found: false }
      cursor = cursor[part]
    }
    return cursor === undefined ? { value: null, found: false } : { value: cursor, found: true }
  }

  _scope(ctx) {
    const state = ctx.state || this._state || {}
    const ch = ctx.ch || chapterOf(state)
    return {
      ...state,
      ...ch,
      state,
      chapter: ch,
      lastBuy: this._lastBuy,
      lastSell: this._lastSell,
      trade: this._trade(),
      event: state.currentEvent || ch.currentEvent || null,
      currentEvent: state.currentEvent || ch.currentEvent || null,
      gradeLine: (ch.ratingInputs && ch.ratingInputs.gradeLine) || '',
      beatenMarketLine: (ch.ratingInputs && ch.ratingInputs.beatenMarketLine) || '',
    }
  }

  /**
   * 数值格式 + 配色。
   * 盈亏 / 涨跌幅 → 涨红跌绿（`--up` / `--down`）；成交价与费用 → `--ok` 蓝青；
   * 拒单类 → `--reject` 琥珀。两套色永不互换（PRD §2.3）。
   */
  _format(source, value, found) {
    if (!found) return { text: DASH, cls: '' }
    const key = String(source || '')
    if (value === null || value === undefined || value === '') return { text: DASH, cls: '' }
    if (typeof value === 'string' && !MONEY_SOURCES.has(key) && !PERCENT_SOURCES.has(key)) {
      if (key === 'rating.S' || key === 'settlement.score') return { text: fmtNum(Number(value), 2), cls: '' }
      return { text: value, cls: '' }
    }
    if (PERCENT_SOURCES.has(key)) return { text: fmtPct(Number(value)), cls: dirClass(Number(value)) }
    if (key === 'rating.S') return { text: fmtNum(Number(value), 2), cls: '' }
    if (ORDER_RESULT_SOURCES.has(key)) return { text: fmtMoney(Number(value)), cls: 'ok' }
    if (DIRECTION_SOURCES.has(key)) return { text: fmtSignedMoney(Number(value)), cls: dirClass(Number(value)) }
    if (MONEY_SOURCES.has(key)) return { text: fmtMoney(Number(value)), cls: '' }
    const n = Number(value)
    if (Number.isFinite(n)) return { text: fmtNum(n, 2), cls: '' }
    return { text: String(value), cls: '' }
  }

  destroy() {
    this._rendered.clear()
    this._read.clear()
    this._reported.clear()
    this._pickedCard = null
    this._state = null
  }
}
