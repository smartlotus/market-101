/**
 * 结业评定 —— **纯函数模块**（PRD §6，plan 关键技术决策 10）。
 *
 * 与 `rating.js` 同形：**0 import**、只吃数字与一张评级表、不碰 DOM、不碰 `scripts/sim/*`。
 * 依赖方向单向 `chapter → sim`；`scripts/sim/**` 不得 import 本文件。
 * 本模块**不写回任何东西**，也**不参与解锁** —— 解锁只由「走完一章」驱动
 * （`unlockedChapters`），与钱、与评级都无关。
 *
 * 三档（**三档都是结业**，全部解锁全部内容、都拿到证书）：
 *   优秀：已记录的章节评级里 `A ≥ 4` **且** 全程调整后累计收益 `> 0`
 *   良好：`A + B ≥ 4`
 *   结业：其余**全部**情形 —— 包括亏掉大部分本金，也包括反复补足本金
 *
 * 两个不可简化之处：
 *   1. **分母只数真实记录过的评级**（`chapterGrades` 里已有的条目），任何地方都不得写死
 *      「共 7 次」（第四章不评级，全剧实际 6 次；将来加章也不必改这里）。
 *      阈值 `A ≥ 4` / `A + B ≥ 4` 是**绝对次数**，不随分母缩放。
 *   2. **全程调整后累计收益必须剔除外来入金**：
 *        adjustedCumReturn = (NAV_final − Σ全部外来入金 − 初始本金) / 初始本金
 *      补足本金 / 重置账户都是外来入金（`ChapterRuntime.injectionsTotal` 毕生累计），
 *      初始本金由 `simAction:'fundInitial'` 产生、从不经过 `noteInjection`，故不算。
 *      抹掉这一项就同时打开「靠补钱刷成绩」的漏洞、并毁掉这份记录的可信度。
 *
 * 三档**只**在以下三处不同：证书上的一行字、导师的收场话、评级记录表的完整度。
 * 它们**不得**改变任何解锁、任何内容、任何后续可玩性（本模块因此不返回任何能力位，
 * 只返回可展示的判定结果）。
 */

/** 三档名称（PRD §6 的字面，唯一来源）。 */
export const STANDING_TIERS = { EXCELLENT: '优秀', GOOD: '良好', PASS: '结业' }

/** 参与统计的评级字面（其余值一律忽略，不猜测）。 */
export const STANDING_GRADES = ['A', 'B', 'C', 'D']

/** 两个阈值是**绝对次数**（PRD §6：不随「实际评了几次」缩放）。 */
export const STANDING_THRESHOLDS = { meritCountA: 4, goodCountAB: 4 }

/** 三档在「评级记录表完整度」上的差异（唯一允许的三处差异之一，纯展示）。 */
const RECORD_COMPLETENESS = {
  优秀: 'full',
  良好: 'full',
  结业: 'counts',
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round6(value) {
  return Math.round(toNumber(value) * 1e6) / 1e6
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100
}

/**
 * 把各种形状的评级表归一成 `[{chapterId, grade}]`（按章号升序、只含有记录的条目）。
 * 接受普通对象（`{'2':'A'}`）、`Map`、或 `[{chapterId, grade}]` 数组 ——
 * 存档往返后对象键会变成字符串，故键一律按数字章号排序。
 */
export function recordedGrades(grades = null) {
  const rows = []
  if (grades instanceof Map) {
    for (const [key, value] of grades) rows.push({ chapterId: toNumber(key, NaN), grade: value })
  } else if (Array.isArray(grades)) {
    for (const row of grades) {
      if (!row || typeof row !== 'object') continue
      rows.push({ chapterId: toNumber(row.chapterId, NaN), grade: row.grade })
    }
  } else if (grades && typeof grades === 'object') {
    for (const [key, value] of Object.entries(grades)) rows.push({ chapterId: toNumber(key, NaN), grade: value })
  }
  return rows
    .filter((row) => STANDING_GRADES.includes(row.grade))
    .map((row) => ({ chapterId: Number.isFinite(row.chapterId) ? row.chapterId : null, grade: row.grade }))
    .sort((a, b) => toNumber(a.chapterId, Infinity) - toNumber(b.chapterId, Infinity))
}

/** 全程调整后累计收益（PRD §6）：外来入金**必须**被减掉，初始本金不是外来入金。 */
export function adjustedCumulativeReturn({ finalNav = 0, injectionsTotal = 0, initialCapital = 0 } = {}) {
  const capital = toNumber(initialCapital)
  if (!(capital > 0)) return 0
  return round6((toNumber(finalNav) - toNumber(injectionsTotal) - capital) / capital)
}

/**
 * 结业评定主函数。
 *
 * @param {object} input
 * @param {object|Map|Array} [input.grades]          已记录的章末评级（`chapterGrades`）
 * @param {number} [input.finalNav]                  当前 / 最终 NAV
 * @param {number} [input.injectionsTotal]           毕生外来入金累计（补足本金 + 重置账户）
 * @param {number} [input.initialCapital]            初始本金（¥100,000，由配置注入，不写死）
 * @returns {{
 *   tier:string, adjustedCumReturn:number, formula:{navFinal:number,injectionsTotal:number,
 *   initialCapital:number}, finalNav:number, injectionsTotal:number, initialCapital:number,
 *   countA:number, countB:number, countC:number, countD:number, countAB:number,
 *   gradedCount:number, gradeRows:Array<{chapterId:number|null,grade:string}>,
 *   recordCompleteness:string, thresholds:{meritCountA:number,goodCountAB:number},
 *   qualified:{merit:boolean, good:boolean}}}
 */
export function computeStanding({
  grades = null,
  finalNav = 0,
  injectionsTotal = 0,
  initialCapital = 0,
} = {}) {
  const gradeRows = recordedGrades(grades)
  const countA = gradeRows.filter((row) => row.grade === 'A').length
  const countB = gradeRows.filter((row) => row.grade === 'B').length
  const countC = gradeRows.filter((row) => row.grade === 'C').length
  const countD = gradeRows.filter((row) => row.grade === 'D').length
  const countAB = countA + countB
  const navFinal = roundMoney(finalNav)
  const injections = roundMoney(injectionsTotal)
  const capital = roundMoney(initialCapital)
  const adjustedCumReturn = adjustedCumulativeReturn({
    finalNav: navFinal,
    injectionsTotal: injections,
    initialCapital: capital,
  })

  // 档次判定：阈值是绝对次数；分母 = `gradeRows.length`（只数记录过的），**从不写死**。
  const qualified = {
    merit: countA >= STANDING_THRESHOLDS.meritCountA && adjustedCumReturn > 0,
    good: countAB >= STANDING_THRESHOLDS.goodCountAB,
  }
  const tier = qualified.merit ? STANDING_TIERS.EXCELLENT : qualified.good ? STANDING_TIERS.GOOD : STANDING_TIERS.PASS

  return {
    tier,
    adjustedCumReturn,
    // 公式的逐项代入值（面板必须把这一行摊开，不得用结论掩盖算法）
    formula: { navFinal, injectionsTotal: injections, initialCapital: capital },
    finalNav: navFinal,
    injectionsTotal: injections,
    initialCapital: capital,
    countA,
    countB,
    countC,
    countD,
    countAB,
    gradedCount: gradeRows.length,
    gradeRows,
    recordCompleteness: RECORD_COMPLETENESS[tier] || 'counts',
    thresholds: { ...STANDING_THRESHOLDS },
    qualified,
  }
}

export default computeStanding
