/**
 * 章末评级 —— **纯函数模块**（PRD §3.3）。
 *
 * 结构性强约束（plan 关键技术决策 4）：本文件**不 import `scripts/sim/*`**，只吃数字。
 * 依赖方向单向 `chapter → sim`；`scripts/sim/**` 不得 import 本文件，也不得存在
 * 任何接收评级结果的 setter。这是「评级不侵入市场层」（锁 L2/L3）的落地方式。
 *
 * 三项输入（全部是钱，全部对玩家可见）：
 *   rar       = (NAV₁ − I − NAV₀) / NAV₀          —— 剔除本章内「补足本金 / 重置账户」的净增额 I
 *   maxDD     = max_t ((峰值调整NAV − 调整NAV_t) / 峰值调整NAV)，调整NAV_t = NAV_t − 截至 t 的累计外来入金
 *   costRatio = 章内累计交易费用 / 章内累计成交金额   —— 分母是成交金额，不是本金
 *
 * 公式（照 PRD §3.3，不得自行调参）：
 *   S = clamp(50 + rar × 833, 0, 100)
 *     − 40 × clamp((maxDD     − 0.05) / 0.15, 0, 1)
 *     − 15 × clamp((costRatio − 0.002) / 0.010, 0, 1)
 *   S = clamp(S, 0, 100)
 *   黄档（NAV < ¥50,000）时成本罚分项 ×0.5
 */

/** PRD §3.3 的五个数值常量（唯一定义处，任何地方不得再写一遍字面量）。 */
export const RATING_PARAMS = {
  baseScore: 50,
  rarSlope: 833,
  ddFree: 0.05,
  ddFull: 0.15,
  ddMaxPenalty: 40,
  costFree: 0.002,
  costFull: 0.010,
  costMaxPenalty: 15,
  yellowCostPenaltyScale: 0.5,
}

/** 门槛（PRD §3.3）：S ≥ 80 → A；60–80 → B；40–60 → C；< 40 → D。 */
export const RATING_THRESHOLDS = { A: 80, B: 60, C: 40 }

/** 三级资金阶梯阈值（PRD §3.6）。 */
export const MONEY_TIERS = { green: 50000, yellow: 10000 }

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

/** 分数 → 档次。纯查表，不做任何四舍五入（边界值 79.99/80 必须落在不同档）。 */
export function gradeOf(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return 'D'
  if (s >= RATING_THRESHOLDS.A) return 'A'
  if (s >= RATING_THRESHOLDS.B) return 'B'
  if (s >= RATING_THRESHOLDS.C) return 'C'
  return 'D'
}

/** NAV 档位：`green` ≥ ¥50,000 / `yellow` [¥10,000, ¥50,000) / `red` < ¥10,000（PRD §3.6）。 */
export function moneyTierOf(nav) {
  const n = Number(nav) || 0
  if (n >= MONEY_TIERS.green) return 'green'
  if (n >= MONEY_TIERS.yellow) return 'yellow'
  return 'red'
}

/**
 * 「本章大盘同期涨跌」（PRD §3.3 对照行，永不进入 S）：
 * 章内每个交易日取 A 股 7 只标的当日收盘涨跌幅的等权算术平均，再把这些均值复利累乘。
 * 休市日按 0 计入（等价于不乘）。
 */
export function computeMarketMove(dailyAvgChangePct = []) {
  let factor = 1
  for (const pct of dailyAvgChangePct) {
    const v = Number(pct)
    if (Number.isFinite(v)) factor *= 1 + v
  }
  // 保留 1e-6 精度（与 sim 侧比率口径一致，避免浮点尾数外泄到面板）
  return Math.round((factor - 1) * 1e6) / 1e6
}

/** 把等权算术平均（不是几何平均）算好，供 `computeMarketMove` 消费。 */
export function averageChangePct(values = []) {
  const nums = values.map(Number).filter(Number.isFinite)
  if (nums.length === 0) return 0
  return nums.reduce((sum, v) => sum + v, 0) / nums.length
}

/**
 * 评级主函数。
 *
 * @param {object}   input
 * @param {number[]} input.navSeries          窗口内原始 NAV 路径（首个采样 = NAV₀，末个 = NAV₁）
 * @param {number[]} [input.adjustedNavSeries] 可选：直接给定「调整后 NAV」路径；缺省时按 injections 派生
 * @param {number[]|number} [input.injections] 截至每个采样点的累计外来入金（数组），或全程净增额（数字）
 * @param {number}   [input.fees]             窗口内累计交易费用（**只含已成交**）
 * @param {number}   [input.notional]         窗口内累计成交金额（**只含已成交**）
 * @param {boolean}  [input.costPenaltyHalf]  黄档：成本罚分 ×0.5
 * @returns {{rar:number,maxDD:number,costRatio:number,S:number,grade:string,
 *            navStart:number,navNow:number,externalInjectionInWindow:number,
 *            navSeries:number[],adjustedNavSeries:number[],baseScore:number,
 *            ddPenalty:number,costPenalty:number,costTerm:number,costPenaltyHalf:boolean,
 *            marketMove:number,beatenMarket:boolean}}
 */
export function computeRating(input = {}) {
  const raw = (Array.isArray(input.navSeries) ? input.navSeries : []).map(Number).filter(Number.isFinite)
  const navSeries = raw.length ? raw : [0]

  let cumInjections
  if (Array.isArray(input.injections)) {
    cumInjections = navSeries.map((_, i) => Number(input.injections[i]) || 0)
  } else {
    const flat = Number(input.injections) || 0
    // 单个数字视为「窗口全期内均匀计入的净增额」：起点前不计、末点起计入，
    // 于是 rar 的分子 `NAV₁ − I − NAV₀` 与 PRD 的公式逐字一致。
    cumInjections = navSeries.map((_, i) => (i === navSeries.length - 1 ? flat : 0))
  }

  const externalInjectionInWindow = round6(cumInjections[cumInjections.length - 1] - cumInjections[0])

  // 调整后 NAV 路径：nav_t − 截至 t 的累计外来入金（− 窗口外盈亏，由 ChapterRuntime 预先并入）
  const adjusted = Array.isArray(input.adjustedNavSeries) && input.adjustedNavSeries.length
    ? input.adjustedNavSeries.map(Number)
    : navSeries.map((nav, i) => nav - cumInjections[i])

  const navStart = navSeries[0]
  const navNow = navSeries[navSeries.length - 1]

  // PRD §3.3：rar = (NAV₁ − I − NAV₀) / NAV₀。
  // 调整路径的端点差恰好等于它（adj₀ = NAV₀ − 0，adj₁ = NAV₁ − I − 窗口外盈亏），
  // 于是「外来入金剔除」与「窗口外盈亏剔除」由同一条式子承载，不可能被漏掉。
  const adjStart = adjusted[0]
  const adjNow = adjusted[adjusted.length - 1]
  const rar = adjStart !== 0 ? (adjNow - adjStart) / adjStart : 0

  const maxDD = maxDrawdown(adjusted)

  const fees = Math.max(0, Number(input.fees) || 0)
  const notional = Math.max(0, Number(input.notional) || 0)
  // 分母是**成交金额**；一笔未成交过的新账户 costRatio 记为 0（不惩罚没交易的人）。
  const costRatio = notional > 0 ? fees / notional : 0

  const P = RATING_PARAMS
  const costPenaltyHalf = Boolean(input.costPenaltyHalf)
  const baseScore = clamp(P.baseScore + rar * P.rarSlope, 0, 100)
  const ddPenalty = P.ddMaxPenalty * clamp((maxDD - P.ddFree) / P.ddFull, 0, 1)
  const costTerm = P.costMaxPenalty * clamp((costRatio - P.costFree) / P.costFull, 0, 1)
  const costPenalty = costTerm * (costPenaltyHalf ? P.yellowCostPenaltyScale : 1)
  const S = clamp(baseScore - ddPenalty - costPenalty, 0, 100)

  return {
    rar: round6(rar),
    maxDD: round6(maxDD),
    costRatio: round6(costRatio),
    S: round6(S),
    grade: gradeOf(S),
    // —— 可见展开（结算面板逐项展示计算过程，PRD §3.3「不得用综合评分掩盖算法」）——
    navStart,
    navNow,
    externalInjectionInWindow,
    navSeries: [...navSeries],
    adjustedNavSeries: adjusted.map(round6),
    baseScore: round6(baseScore),
    ddPenalty: round6(ddPenalty),
    costTerm: round6(costTerm),
    costPenalty: round6(costPenalty),
    costPenaltyHalf,
    fees: roundMoneyLocal(fees),
    notional: roundMoneyLocal(notional),
    // 大盘对照行（永不进入 S）；marketMove 由 ChapterRuntime 用 computeMarketMove 填，
    // 这里保留字段以便结算面板只读一处。
    marketMove: 0,
    beatenMarket: false,
  }
}

/** 最大回撤（PRD §3.3）：对调整后 NAV 路径取「峰值回落」最大值。 */
export function maxDrawdown(adjustedSeries = []) {
  let peak = -Infinity
  let worst = 0
  for (const value of adjustedSeries) {
    const v = Number(value)
    if (!Number.isFinite(v)) continue
    if (v > peak) peak = v
    if (peak > 0) {
      const dd = (peak - v) / peak
      if (dd > worst) worst = dd
    }
  }
  return worst
}

function round6(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1e6) / 1e6
}

function roundMoneyLocal(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}
