/**
 * 节拍级存档 —— `localStorage` 读写 + **schema 白名单校验**（plan 关键技术决策 6 / 架构硬规则 3）。
 *
 * 铁律：**未知键直接丢弃**。这是「导师不得携带任何隐藏层」在物理层的落地方式 ——
 * 碎片 / 道具 / 身份 / 延迟台词这类伏笔容器，即使有人写进 `document`，
 * 也无法通过本模块进入存档，因为它们没有白名单条目。
 *
 * 因此：**新增可持久化字段必须同时登记进 `SAVE_SCHEMA`**（章节编写约定「新增一章的自检清单」第 5 条）。
 *
 * storage 可注入（测试用内存实现），缺省用 `window.localStorage`。
 */

export const SAVE_VERSION = 1
export const DEFAULT_SAVE_KEY = 'market-101.save.v1'

/**
 * 白名单 schema。取值：
 *   'int' | 'number' | 'money' | 'bool' | 'string' | 'string[]' | 'int[]'
 *   'flat[]'   —— 数组，元素只允许标量，或「标量叶子 + 标量数组」的浅对象
 *   'deep'     —— 受控深拷贝：标量 / 标量数组 / 浅对象 / 浅对象数组（最深 3 层）
 *   'quote-states' —— 行情状态映射（键 = 动态 `instId`）：标量字段 + K 线数组。
 *       K 线单根是纯标量对象（OHLC + eventMove + noise），比 `deep` 的 3 层上限正好多一层
 *       （states → state → klines → bar），故在这一条路径上单独放行；
 *       **不抬 `deep` 自身的深度上限**，其余 `deep` 字段的安全边界一字未动。
 *   'nullable-deep' —— 同上，但允许 null
 *   {…}        —— 嵌套对象，其键同样受白名单约束
 */
export const SAVE_SCHEMA = {
  version: 'int',
  beatId: 'string',
  chapterId: 'int',
  mode: 'string',
  // 世界快照 = MarketSim.toJSON()
  world: {
    market: 'string',
    selectedInstrumentId: 'string',
    dayOpen: 'bool',
    navStartOfDay: 'money',
    navHistory: 'number[]',
    nextOrderId: 'int',
    lastOrder: 'nullable-deep',
    pendingOrders: 'deep',
    currentEvent: 'nullable-deep',
    nextEventQueue: 'string[]',
    directedDrawn: 'string[]',
    account: {
      cash: 'money',
      frozenCash: 'money',
      realizedPnL: 'money',
      feesPaid: 'money',
      totalNotional: 'money',
      opened: 'bool',
      funded: 'bool',
      positions: 'deep',
    },
    calendar: { dayIndex: 'int', ms: 'number' },
    deck: { cycle: 'int', usedIds: 'string[]', drawnThisCycle: 'int' },
    quotes: { states: 'quote-states' },
  },
  // 章节快照 = ChapterRuntime.toJSON()
  chapter: {
    chapterId: 'int',
    beatId: 'string',
    beatIndex: 'int',
    completedBeats: 'string[]',
    mode: 'string',
    shellMode: 'string',
    sceneId: 'nullable-string',
    panelId: 'nullable-string',
    pendingChoiceId: 'nullable-string',
    answeredChoices: 'deep',
    pendingChoiceSnapshots: 'deep',
    conceptsIntroduced: 'string[]',
    ruleCardsSeen: 'string[]',
    remedialUsedThisChapter: 'bool',
    chapterRejectSeen: 'bool',
    extraSegment: 'nullable-deep',
    rating: 'nullable-deep',
    ratingInputs: 'nullable-deep',
    ratingWindow: 'nullable-deep',
    goalCardState: 'nullable-deep',
    mentor: {
      explainCounts: 'deep',
      muted: 'bool',
      proactiveEnabled: 'bool',
    },
    hintCounts: 'deep',
    selectTouched: 'bool',
    // —— Stage 2 新增（plan「Runtime State Contract」）——
    // 「导师无隐藏层」的结构性证明：`mentor` 子树**仍然只有那三个键**，
    // 对话历史存在章节快照自己的字段里（它是玩家可回看的台词，不是伏笔容器）。
    unlockedChapters: 'int[]',
    advancedUnlocked: 'string[]',
    mentorHistory: 'deep',
    // 章末评级记录（键 = 章号）与**毕生**外来入金：结业评定的两项输入，刷新后必须还在
    chapterGrades: 'deep',
    injectionsTotal: 'money',
    // 第四章两个新互动的进度（配对 / 流程走查）
    matchProgress: 'deep',
    flowProgress: 'deep',
    // 注：**没有** `suspendedPanelId` —— 四块「参考资料」面板（词典 / 导师历史 / 进度解锁 /
    // 净值评定）按 lead 裁决豁免真暂停，作为挂在 `#chapter-root` 上的独立浮层实现，
    // 不经过 `openPanel()`，也就不存在「顶掉节拍面板 → 挂起 → 恢复」这条路径。
    // 没有任何运行时代码写它，故不留这个死 schema 键。
  },
}

/** 白名单键集合（供 `eval` 断言「存档里不存在伏笔容器」）。 */
export function saveWhitelistKeys() {
  const collect = (schema, prefix = '') => {
    const out = []
    for (const [key, type] of Object.entries(schema)) {
      const path = prefix ? `${prefix}.${key}` : key
      out.push(path)
      if (type && typeof type === 'object') out.push(...collect(type, path))
    }
    return out
  }
  return collect(SAVE_SCHEMA)
}

const NULLABLE_STRING = 'nullable-string'

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** 受控深拷贝：只保留标量 / 标量数组 / 浅对象 / 浅对象数组，最深 3 层。 */
function cloneDeep(value, depth = 0, maxDepth = 3) {
  if (value === null) return null
  const t = typeof value
  if (t === 'string' || t === 'boolean') return value
  if (t === 'number') return Number.isFinite(value) ? value : 0
  if (t !== 'object' || depth >= maxDepth) return undefined
  if (Array.isArray(value)) {
    const out = []
    for (const item of value) {
      const cloned = cloneDeep(item, depth + 1, maxDepth)
      if (cloned !== undefined) out.push(cloned)
    }
    return out
  }
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    const cloned = cloneDeep(item, depth + 1, maxDepth)
    if (cloned !== undefined) out[key] = cloned
  }
  return out
}

/** 行情状态里逐字段放行的标量（字段名即 `QuoteEngine.stateOf()` 的形状）。 */
const QUOTE_STATE_KEYS = ['id', 'prevClose', 'lastPrice', 'open', 'high', 'low', 'close']
/** 单根 K 线的字段（纯标量，无嵌套容器）。 */
const QUOTE_BAR_KEYS = ['prevClose', 'open', 'high', 'low', 'close', 'eventMove', 'noise']

function cloneNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function cloneQuoteBar(bar) {
  const out = {}
  for (const key of QUOTE_BAR_KEYS) {
    if (Object.prototype.hasOwnProperty.call(bar, key)) out[key] = cloneNumber(bar[key])
  }
  return out
}

/**
 * 行情状态深拷贝：标量照抄、`klines` 逐根按 `QUOTE_BAR_KEYS` 白名单放行。
 * 存档必须带 K 线历史（plan「Runtime State Contract」的 `quotes` 契约），
 * 否则刷新后 `QuoteView` 的 K 线图无数据可画。
 */
function cloneQuoteStates(value) {
  if (!isPlainObject(value)) return undefined
  const out = {}
  for (const [id, st] of Object.entries(value)) {
    if (!isPlainObject(st)) continue
    const state = {}
    for (const key of QUOTE_STATE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(st, key)) continue
      state[key] = typeof st[key] === 'string' ? st[key] : cloneNumber(st[key])
    }
    state.klines = Array.isArray(st.klines) ? st.klines.filter(isPlainObject).map(cloneQuoteBar) : []
    out[id] = state
  }
  return out
}

function coerce(type, value) {
  switch (type) {
    case 'int': {
      const n = Number(value)
      return Number.isFinite(n) ? Math.trunc(n) : 0
    }
    case 'number':
    case 'money': {
      const n = Number(value)
      return Number.isFinite(n) ? n : 0
    }
    case 'bool':
      return Boolean(value)
    case 'string':
      return typeof value === 'string' ? value : String(value ?? '')
    case NULLABLE_STRING:
      return value === null || value === undefined ? null : String(value)
    case 'string[]':
      return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []
    case 'number[]':
      return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : []
    case 'int[]':
      return Array.isArray(value) ? value.map((v) => Math.trunc(Number(v) || 0)) : []
    case 'deep':
      return cloneDeep(value, 0) ?? null
    case 'quote-states':
      return cloneQuoteStates(value) ?? null
    case 'nullable-deep':
      return value === null || value === undefined ? null : cloneDeep(value, 0) ?? null
    default:
      return undefined
  }
}

/**
 * 白名单校验：**未知键丢弃**。返回净化后的文档；无法识别为对象时返回 null。
 * 该函数是纯函数，可被 `eval` 直接调用断言。
 */
export function sanitizeBySchema(schema, value) {
  if (!isPlainObject(schema)) return undefined
  if (!isPlainObject(value)) return undefined
  const out = {}
  for (const [key, type] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue
    if (type && typeof type === 'object') {
      const nested = sanitizeBySchema(type, value[key])
      if (nested !== undefined) out[key] = nested
      continue
    }
    const coerced = coerce(type, value[key])
    if (coerced !== undefined) out[key] = coerced
  }
  return out
}

export class SaveStore {
  constructor({ key = DEFAULT_SAVE_KEY, storage = null, version = SAVE_VERSION } = {}) {
    this.key = key
    this.version = version
    this._injected = storage
  }

  /** 注入式 storage 优先；否则回退 `window.localStorage`（不可用时整体静默降级）。 */
  get storage() {
    if (this._injected) return this._injected
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
    } catch {
      /* 隐私模式 / 沙箱：按「无存档」处理 */
    }
    return null
  }

  get available() {
    return !!this.storage
  }

  /**
   * 读存档。任何异常、版本不符、schema 不符一律当作「没有存档」（返回 null），
   * 绝不让一个坏存档把游戏卡在启动阶段。
   */
  read() {
    const storage = this.storage
    if (!storage) return null
    let raw = null
    try {
      raw = storage.getItem(this.key)
    } catch {
      return null
    }
    if (!raw) return null
    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
    const doc = sanitizeBySchema(SAVE_SCHEMA, parsed)
    if (!doc || Number(doc.version) !== this.version) return null
    if (!doc.beatId) return null
    return doc
  }

  /** 写存档。返回是否写入成功（写入失败不抛，游戏照常继续）。 */
  write({ beatId, chapterId, mode, chapter, world }) {
    const storage = this.storage
    if (!storage) return false
    const doc = sanitizeBySchema(SAVE_SCHEMA, {
      version: this.version,
      beatId,
      chapterId,
      mode,
      chapter,
      world,
    })
    if (!doc || !doc.beatId) return false
    try {
      storage.setItem(this.key, JSON.stringify(doc))
      return true
    } catch {
      return false
    }
  }

  clear() {
    const storage = this.storage
    if (!storage) return false
    try {
      storage.removeItem(this.key)
      return true
    } catch {
      return false
    }
  }

  /** `chapter.save` 契约字段：`{exists, version, beatId}`。 */
  meta() {
    const doc = this.read()
    if (!doc) return { exists: false, version: this.version, beatId: null }
    return { exists: true, version: this.version, beatId: doc.beatId }
  }
}

export default SaveStore
