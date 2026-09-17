/**
 * test_rating_formula —— PRD §3.3 评级公式与门槛。
 *
 * 覆盖 plan.md Verification Plan 中 test_rating_formula 的 7 行：
 *   ① 公式手算（rar / maxDD / costRatio / S）+ S clamp [0,100] + 回撤罚分上限 40 + 成本罚分上限 15
 *   ② 门槛四档与边界（80 / 60 / 40 的两侧）
 *   ③ 黄档成本罚分 ×0.5（同形路径、只差资金档）
 *   ④ L1 同章相对口径（同一 NAV 路径整体平移 → 同一 rar/maxDD/S）
 *   ⑤ 外来入金剔除（adjustedNavSeries 端点差 = rar 分子）
 *   ⑥ 大盘对照行（复利累乘、休市按 0 不计、beatenMarket）
 *
 * 依赖 `steps/lib.js`（test.sh 用 cat 前置拼接）。
 */

const R = {};

/** 每条探针都记录「注入的输入」与「读回的输出」，断言脚本在 Python 侧按 PRD 公式手算复核。 */
const cases = {}
R.formula = (() => {
  // ① 综合：baseScore 触顶 100 + 回撤罚分（非 0）+ 成本罚分（非 0）
  cases.mixed = probe({ navSeries: [100000, 105000, 98000, 108000], fees: 123.45, notional: 50000 })
  // ② 回撤罚分触顶（maxDD = 0.2 ≥ 0.15 → 40）且 baseScore 触底 0 → S 触底 0
  cases.ddMax = probe({ navSeries: [100000, 80000, 90000] })
  // ③ 回撤在免费区（0.0096 < 0.05 → 罚分 0）
  cases.ddFree = probe({ navSeries: [100000, 104000, 103000, 105000] })
  // ④ 成本比在免费区（0.001 < 0.002 → 罚分 0）
  cases.costFree = probe({ navSeries: [100000, 105000], fees: 100, notional: 100000 })
  // ⑤ 成本罚分触顶（0.02 ≥ 0.010 → 15）
  cases.costMax = probe({ navSeries: [100000, 105000], fees: 2000, notional: 100000 })
  // ⑥ 成本免费区边界：恰好 0.002 → 0；0.0021 → 15×0.01 = 0.15
  cases.costEdge0 = probe({ navSeries: [100000, 105000], fees: 200, notional: 100000 })
  cases.costEdge1 = probe({ navSeries: [100000, 105000], fees: 210, notional: 100000 })
  // ⑦ 未交易的人不因「没交易」被罚：notional = 0 → costRatio 记 0
  cases.noTrade = probe({ navSeries: [100000, 105000], fees: 0, notional: 0 })
  // ⑧ baseScore 上 clamp：rar = +0.5 → 466.5 → clamp 100
  cases.baseClampHigh = probe({ navSeries: [100000, 150000] })
  // ⑨ baseScore 下 clamp 且 S 下 clamp：rar = −0.5、maxDD = 0.5
  cases.baseClampLow = probe({ navSeries: [100000, 50000] })
  return cases
})()

/** ④ 门槛与边界：目标 S 反解 rar，取边界两侧（±0.01 与 ±1e-6）。 */
R.thresholds = (() => {
  const out = {}
  const targets = [80, 60, 40]
  const offsets = [-0.01, -0.000001, 0.000001, 0.01]
  for (const T of targets) {
    for (const d of offsets) {
      const S = T + d
      const key = `${T}${d > 0 ? 'p' : 'm'}${Math.abs(d)}`
      const rar = rarFor(S)
      out[key] = Object.assign(
        { target: S },
        probe({ navSeries: [100000, 100000 * (1 + rar)], fees: 0, notional: 0 }),
      )
    }
  }
  return out
})()

/**
 * 观测项（不判失败）：让 S 恰好落在门槛 ¥80 上。
 * 「判档用的 S」与「面板显示的 S（round6）」取整口径不同，若两者在门槛处给出不一致的观感，
 * 属显示口径问题而非公式错误 —— 记下来交给 reviewer 判读，不作为本测试的失败条件。
 */
R.exactBoundary = (() => {
  const p = probe({ navSeries: [100000, 100000 * (1 + rarFor(80))], fees: 0, notional: 0 })
  return { target: 80, rating: p.rating, inputs: { baseScore: p.inputs.baseScore } }
})()

/** ⑤ 黄档成本罚分 ×0.5：adjusted 路径完全相同，只有 navSeries 的绝对水平（=资金档）不同。 */
R.yellow = (() => {
  const ADJ = [100000, 99000, 101000]      // 前两个探针共用的调整后路径（rar/DD 由它决定）
  const shared = { adjustedNavSeries: ADJ, injections: [0, 0, 0], fees: 300, notional: 100000 }
  const yellowTier = probe({ ...shared, navSeries: [20000, 19800, 20200] })   // 末值 < ¥50,000 → costPenaltyHalf
  const greenTier = probe({ ...shared, navSeries: [100000, 99000, 101000] })  // 末值 ≥ ¥50,000
  // 成本比落在免费区时，×0.5 不产生任何差异
  const sharedFree = { adjustedNavSeries: ADJ, injections: [0, 0, 0], fees: 100, notional: 100000 }
  const yellowFree = probe({ ...sharedFree, navSeries: [20000, 19800, 20200] })
  const greenFree = probe({ ...sharedFree, navSeries: [100000, 99000, 101000] })
  return { yellowTier, greenTier, yellowFree, greenFree }
})()

/** ⑥ L1 同章相对口径：同一条 NAV 路径整体平移（×5/3），rar/maxDD/S 必须逐一相同。 */
R.l1 = (() => {
  const A = [60000, 63000, 57000, 66000]
  const B = A.map((v) => (v * 5) / 3)          // 起点 ¥60,000 → ¥100,000，形状完全一致
  return { A, B, probeA: probe({ navSeries: A, fees: 0, notional: 0 }), probeB: probe({ navSeries: B, fees: 0, notional: 0 }) }
})()

/** ⑦ 外来入金剔除：同样的 NAV 路径，一笔「补足本金」只改 adjusted 路径。 */
R.injection = (() => {
  const noInj = probe({ navSeries: [100000, 120000], adjustedNavSeries: [100000, 120000], injections: [0, 0], fees: 0, notional: 0 })
  const withInj = probe({ navSeries: [100000, 120000], adjustedNavSeries: [100000, 100000], injections: [0, 20000], fees: 0, notional: 0 })
  const midInj = probe({ navSeries: [100000, 110000, 130000], adjustedNavSeries: [100000, 110000, 110000], injections: [0, 0, 20000], fees: 0, notional: 0 })
  return { noInj, withInj, midInj }
})()

/** ⑧ 大盘对照行：等权日均值复利累乘；休市日按 0 计入（等价不乘）；beatenMarket = rar > marketMove。 */
R.market = (() => {
  const base = { navSeries: [100000, 105000], fees: 0, notional: 0 }
  return {
    compound: probe({ ...base, marketMoveSeries: [0.01, -0.005] }),
    withClosedDay: probe({ ...base, marketMoveSeries: [0.01, 0, -0.005] }),   // 中间插入休市日（0）
    allClosed: probe({ ...base, marketMoveSeries: [0, 0] }),
    // rar = 0.05；marketMove 取 0.06 → 跑输；取 0.04 → 跑赢
    behind: probe({ ...base, marketMoveSeries: [0.06] }),
    ahead: probe({ ...base, marketMoveSeries: [0.04] }),
  }
})()

// 记录探针落点的结构性事实，供断言脚本核对「确实落在第二章」
R.sanity = { chapterId: C().chapterId, beatCount: C().beatCount, moneyTiers: C().moneyTiers, ratingThresholds: C().ratingThresholds }
return R
