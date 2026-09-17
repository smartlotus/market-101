/**
 * 导师调度 —— 纯逻辑模块（PRD §3.9 / plan 关键技术决策 10）。
 *
 * 职责只有三件：**开口时机的穷举判定**、**每概念主动讲解计数**、**静音与「主动提示」开关**。
 * 台词正文来自 `config/chapters.json`（数据），本模块只决定「这次该不该开口」。
 *
 * 结构性约束（「导师不得携带任何隐藏层」，PRD §3.9）：
 * 本模块持有的状态**只有** `explainCounts` / `muted` / `proactiveEnabled` 三项，
 * 全部是玩家可见的设置或计数。**不存在**任何伏笔容器（碎片 / 道具 / 身份 / 延迟台词），
 * 因此「空的伏笔容器」在物理上也无法进入存档 —— `saveStore` 的白名单只放行这三项。
 *
 * 开口时机穷举（不多不少，PRD §3.9）：
 *   ① MENTOR_TIMING.CHAPTER_OPEN   章开场一次
 *   ② MENTOR_TIMING.FIRST_CONCEPT  节拍推进时首次遇某概念 / 该概念被本拍点名
 *   ③ MENTOR_TIMING.REACTIVE       被拒单 / 亏损 / 触风险警示线（先安慰、再解释、最后提问）
 *   ④ MENTOR_TIMING.CHAPTER_END    章末一次
 *   ⑤ MENTOR_TIMING.PLAYER_CALL    玩家主动呼叫（任何时候都响，不计上限）
 * 不得新增第六类。
 */

export const MENTOR_TIMING = {
  CHAPTER_OPEN: 'chapterOpen',
  FIRST_CONCEPT: 'firstConcept',
  REACTIVE: 'rejected',
  CHAPTER_END: 'chapterEnd',
  PLAYER_CALL: 'playerCall',
}

/** 同一概念最多**主动**讲 2 次：第 1 次给比喻，第 2 次给机制；第 3 次起只在玩家呼叫时出现。 */
export const MENTOR_MAX_PROACTIVE = 2

/** 自由交易日 / 沙盒里绝不主动弹窗 —— 唯一例外是风险警示线。 */
const NON_INTRUSIVE_MODES = ['freeDay', 'sandbox']

/** 剧情发言：即使「主动提示」被关掉也照常出现（它不是「提示」，是章节对白）。 */
const STORY_TIMINGS = [MENTOR_TIMING.CHAPTER_OPEN, MENTOR_TIMING.CHAPTER_END, MENTOR_TIMING.PLAYER_CALL]

/**
 * 台词的**来源**（诊断字段，进对话历史；**不是**第六类开口时机 —— 时机仍是上面那五类）。
 * `PROACTIVE_HINT` = 黄档那句「本金不足」提醒：它是「他主动补的提示」，属**非剧情发言**。
 */
export const MENTOR_SOURCE = {
  BEAT: 'beat',
  RESUME: 'resume',
  CHOICE_FEEDBACK: 'choiceFeedback',
  RISK_WARNING: 'riskWarning',
  GRADE: 'grade',
  SEGMENT: 'segment',
  PLAYER_CALL: 'playerCall',
  PROACTIVE_HINT: 'proactiveHint',
}

/**
 * 「剧情 / 功能性发言」的来源 —— 静音**不**吞这些来源的台词。
 * 判据只有这一处（lead 裁决：静音只抑制他主动补的提示、讲解、点评）。
 */
const FUNCTIONAL_SOURCES = [
  MENTOR_SOURCE.BEAT,
  MENTOR_SOURCE.RESUME,
  MENTOR_SOURCE.CHOICE_FEEDBACK,
  MENTOR_SOURCE.RISK_WARNING,
  MENTOR_SOURCE.GRADE,
  MENTOR_SOURCE.SEGMENT,
]

/**
 * **静音判定用的唯一判据**：这次发言是剧情/功能性发言吗？
 *
 * 静音只该抑制「非剧情发言」（他主动补的提示、讲解、点评）。剧情与功能性台词必须照常出现，
 * 否则玩家在静音下读不到章末交代、选项后果与安慰解释 —— 那不是「少刷屏」，是「断了反馈」。
 * 于是把它们集中在这里判断，而不是在每个调用点逐个特判：
 *   - **剧情时机**：章开场 / 章末 / 玩家主动呼叫（`STORY_TIMINGS`）→ 照常；
 *   - **概念讲解**（`FIRST_CONCEPT`）→ 他主动补的讲解，静音时不出声（无论来源是什么）；
 *   - **功能性来源**：被拒单的安慰与解释 / 承接语 / 选项反馈 / 风险警示线 / 评级台词 /
 *     补救段台词（`FUNCTIONAL_SOURCES`）→ 照常；
 *   - 其余（黄档那句主动提醒 `PROACTIVE_HINT`）都是非剧情发言，静音时不出声。
 */
export function isStoryOrFunctionalSpeech({ timing, source = null, isRiskWarning = false } = {}) {
  if (isRiskWarning) return true
  if (STORY_TIMINGS.includes(timing)) return true
  // 首遇概念的讲解是他主动补的「讲解」：即使它写在节拍数据里（source=beat），也属非剧情发言。
  if (timing === MENTOR_TIMING.FIRST_CONCEPT) return false
  return FUNCTIONAL_SOURCES.includes(source)
}

export class MentorScheduler {
  constructor({ explainCounts = {}, muted = false, proactiveEnabled = true } = {}) {
    this.explainCounts = { ...explainCounts }
    this.muted = Boolean(muted)
    this.proactiveEnabled = proactiveEnabled !== false
  }

  // === 设置（两项都是玩家可见开关，无隐藏语义）===

  setMuted(muted) {
    this.muted = Boolean(muted)
    return this.muted
  }

  setProactiveEnabled(enabled) {
    this.proactiveEnabled = enabled !== false
    return this.proactiveEnabled
  }

  countOf(conceptKey) {
    return Number(this.explainCounts[conceptKey]) || 0
  }

  /**
   * 判定本次时机是否允许开口。
   * @param {object} input
   * @param {string} input.timing     五类开口时机之一（穷举，不得新增）
   * @param {string} [input.source]   诊断字段（`MENTOR_SOURCE`），只用于静音判据与历史归类
   * @returns {{speak:boolean, reason:string, timing:string, source:string|null, conceptKey:string|null, count:number}}
   */
  request({ timing, conceptKey = null, mode = 'chapter', isRiskWarning = false, source = null } = {}) {
    const base = { timing, source: source || null, conceptKey, count: conceptKey ? this.countOf(conceptKey) : 0 }

    if (timing === MENTOR_TIMING.PLAYER_CALL) {
      // 玩家主动呼叫：不受静音、不受计数限制（他点了就该有回应）。
      return { ...base, speak: true, reason: 'player_call' }
    }

    if (!STORY_TIMINGS.includes(timing) && !isRiskWarning) {
      if (NON_INTRUSIVE_MODES.includes(mode)) {
        return { ...base, speak: false, reason: 'non_intrusive_mode' }
      }
      if (!this.proactiveEnabled) {
        return { ...base, speak: false, reason: 'proactive_disabled' }
      }
    }

    // 静音：只吞**非剧情发言**；剧情与功能性台词照常出现（lead 裁决，勿搞反）。
    // 风险警示线是 GDD 明文的唯一例外，但它是功能性发言，故也不再被静音吞掉。
    if (this.muted && !isStoryOrFunctionalSpeech({ timing, source, isRiskWarning })) {
      return { ...base, speak: false, reason: 'muted' }
    }

    if (timing === MENTOR_TIMING.FIRST_CONCEPT && conceptKey) {
      // 上限按「已经讲过几次」判定；本次讲解后计数由 note() 累加。
      if (this.countOf(conceptKey) >= MENTOR_MAX_PROACTIVE) {
        return { ...base, speak: false, reason: 'concept_quota_reached' }
      }
    }

    return { ...base, speak: true, reason: timing === MENTOR_TIMING.REACTIVE ? 'reactive' : 'allowed' }
  }

  /**
   * 记一次**主动**讲解（请在真正把台词贴到对话层之后调用）。
   * 静音状态下也照常累加 —— 否则取消静音后会突然补讲一大堆（PRD §3.9 Edge Case）。
   * 玩家主动呼叫**不**计入本上限，故本方法不由 PLAYER_CALL 调用。
   */
  note(conceptKey) {
    if (!conceptKey) return 0
    const next = this.countOf(conceptKey) + 1
    this.explainCounts[conceptKey] = next
    return next
  }

  /** 完全静音（含剧情对白）时的展示：对话层仍可折叠，这里只报告状态。 */
  isSilent() {
    return this.muted
  }

  // === 存档（只有这三项，白名单会强制这一点）===

  toJSON() {
    return {
      explainCounts: { ...this.explainCounts },
      muted: this.muted,
      proactiveEnabled: this.proactiveEnabled,
    }
  }

  loadFrom(data) {
    if (!data) return this
    this.explainCounts = { ...(data.explainCounts || {}) }
    this.muted = Boolean(data.muted)
    this.proactiveEnabled = data.proactiveEnabled !== false
    return this
  }
}

export default MentorScheduler
