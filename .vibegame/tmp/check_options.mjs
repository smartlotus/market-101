import { OptionChain, priceOption, roundStrike, OPTION_MULTIPLIER, SERIES_D0 } from '../../scripts/sim/options.js'

let pass = 0
const fails = []
const ok = (n, c, e) => { if (c) pass += 1; else fails.push(n + ' <- ' + JSON.stringify(e)) }
const eq = (n, g, w) => ok(n, Math.abs(Number(g) - Number(w)) < 0.005, { got: g, want: w })
const eqs = (n, g, w) => ok(n, String(g) === String(w), { got: g, want: w })

// ── 取整规则（GDD：<3 取 0.05、3–10 取 0.1、>10 取 0.5）──
eq('取整 <3', roundStrike(2.61 * 0.9), 2.35)
eq('取整 3–10', roundStrike(5.03), 5)
eq('取整 >10', roundStrike(21.4), 21.5)

// ── 定价公式（逐项验算）──
{
  // S=10 K=10 D=30 D0=30 vf=1 → 平值：atm=1, tv = 10*0.02*1*1*1 = 0.2
  const p = priceOption({ spot: 10, strike: 10, daysLeft: 30, d0: 30, volFactor: 1, type: 'CALL' })
  eq('平值 CALL 内在价值 0', p.intrinsic, 0)
  eq('平值 CALL 时间价值 0.2', p.timeValue, 0.2)
  eq('平值 CALL 每股权利金 0.2', p.premiumPerShare, 0.2)
  eq('平值 CALL 总权利金 = 0.2×10000', p.premiumTotal, 2000)
  eq('平值 CALL 名义价值 = 10×10000', p.notional, 100000)
  eq('平值 CALL 杠杆 = 50', p.leverage, 50)
  eqs('平值 状态', p.moneyStatus, '平值')

  // 时间衰减：D 减半 → 时间价值减半
  const half = priceOption({ spot: 10, strike: 10, daysLeft: 15, d0: 30, volFactor: 1, type: 'CALL' })
  eq('D 减半 → 时间价值减半', half.timeValue, 0.1)

  // 虚值：S=9 K=10 → moneyness=0.1 → atm=0.5；tv=10*0.02*1*0.5=0.1
  const otm = priceOption({ spot: 9, strike: 10, daysLeft: 30, d0: 30, volFactor: 1, type: 'CALL' })
  eq('虚值 CALL 内在 0', otm.intrinsic, 0)
  eq('虚值 CALL 时间价值 0.1', otm.timeValue, 0.1)
  eqs('虚值 状态', otm.moneyStatus, '虚值')

  // 实值 CALL：S=11 K=10 → 内在 1 + tv(atm=0.5→0.1) = 1.1
  const itm = priceOption({ spot: 11, strike: 10, daysLeft: 30, d0: 30, volFactor: 1, type: 'CALL' })
  eq('实值 CALL 内在 1', itm.intrinsic, 1)
  eq('实值 CALL 时间价值 0.1', itm.timeValue, 0.1)
  eqs('实值 状态', itm.moneyStatus, '实值')

  // 实值 PUT：S=9 K=10 → 内在 1
  const put = priceOption({ spot: 9, strike: 10, daysLeft: 30, d0: 30, volFactor: 1, type: 'PUT' })
  eq('实值 PUT 内在 1', put.intrinsic, 1)
  eq('PUT 虚值端', priceOption({ spot: 11, strike: 10, daysLeft: 30, d0: 30, type: 'PUT' }).intrinsic, 0)

  // 偏离 20% 以外时间价值归零
  eq('偏离 20% 时间价值归零', priceOption({ spot: 8, strike: 10, daysLeft: 30, d0: 30, type: 'CALL' }).timeValue, 0)
  // volFactor 放大
  eq('volFactor=2 → 时间价值翻倍', priceOption({ spot: 10, strike: 10, daysLeft: 30, d0: 30, volFactor: 2 }).timeValue, 0.4)
  // 到期日时间价值必为 0
  eq('D=0 时间价值归零', priceOption({ spot: 10, strike: 10, daysLeft: 0, d0: 30 }).timeValue, 0)
}

// ── 期权链 ──
{
  const chain = new OptionChain({ underlyingId: '510050', spotOf: () => 2.6 })
  const snap = chain.snapshot()
  eq('3 个到期序列', snap.series.length, 3)
  eq('近月 D0=30', snap.series[0].d0, 30)
  eq('季月 D0=90', snap.series[2].d0, 90)
  eq('每序列 5 档 × 2 = 10 张', snap.series[0].contracts.length, 10)
  eq('总合约 30 张', snap.series.reduce((a, s) => a + s.contracts.length, 0), 30)
  ok('行权价已按价位取整', snap.series[0].contracts.every((c) => Math.abs(c.strike * 100 - Math.round(c.strike * 100)) < 1e-6), snap.series[0].contracts[0])
  const atm = chain.atmContracts()
  ok('能找出平值档（每序列 CALL+PUT 成对）', atm.length >= 2 && atm.length % 2 === 0, atm.map((c) => c.strike + c.type))
  ok('平值档与现价最接近', atm.every((c) => Math.abs(c.strike - 2.6) <= 0.3), atm.map((c) => c.strike))
}

// ── 时间衰减（标的没动，权利金缩水）──
{
  const chain = new OptionChain({ spotOf: () => 2.6 })
  const atm = chain.atmContracts().find((c) => c.type === 'CALL')
  const before = atm.premiumPerShare
  const lots = 1
  let t = before
  for (let d = 0; d < 5; d += 1) {
    chain.advanceDay()
    const now = chain.contractById(atm.id)
    if (now) t = chain.contractList().find((c) => c.id === atm.id).premiumPerShare
  }
  ok('标的没动，权利金随时间缩水', t < before, { before, after5d: t })
}

// ── 归零：虚值到期，损失全部权利金 ──
{
  const chain = new OptionChain({ spotOf: () => 2.6 })
  // 取最高行权价的 CALL（虚值）
  const list = chain.contractList()
  const near = list.filter((c) => c.seriesName === '近月')
  const otmCall = near.sort((a, b) => b.strike - a.strike)[0]
  const r = chain.buy({ contractId: otmCall.id, lots: 1, cash: 100000 })
  ok('买入虚值 CALL 成功', r.ok, r)
  const paid = r.premiumPaid
  let settled = []
  for (let d = 0; d < SERIES_D0[0]; d += 1) settled = chain.advanceDay({ dayIndex: d + 2 })
  const hit = settled.find((s) => s.contractId === otmCall.id)
  ok('合约到期结算', !!hit, settled.map((s) => s.contractId))
  eq('虚值 → 不行权', hit.exercised, false)
  eq('归零 → 亏损 = 全部权利金', hit.pnl, -paid)
  eq('归零 → 收入 0', hit.proceeds, 0)
}

// ── 实值到期：现金行权 ──
{
  let spot = 2.6
  const chain = new OptionChain({ spotOf: () => spot })
  const list = chain.contractList()
  const near = list.filter((c) => c.seriesName === '近月')
  const lowCall = near.sort((a, b) => a.strike - b.strike)[0]   // 最低行权价 CALL
  const r = chain.buy({ contractId: lowCall.id, lots: 1, cash: 100000 })
  ok('买入低行权价 CALL 成功', r.ok, r)
  const paid = r.premiumPaid
  const K = r.contract.strike
  spot = K * 1.5   // 到期前标的涨上去 → 实值
  let settled = []
  for (let d = 0; d < SERIES_D0[0]; d += 1) settled = chain.advanceDay({ dayIndex: d + 2 })
  const hit = settled.find((s) => s.contractId === lowCall.id)
  ok('实值合约到期结算', !!hit, settled.map((s) => s.contractId))
  eq('实值 → 现金行权', hit.exercised, true)
  eq('行权收入 = 内在价值 × 10000', hit.proceeds, Math.round((spot - K) * OPTION_MULTIPLIER * 100) / 100)
  eq('已实现 = 收入 − 已付权利金', hit.pnl, Math.round((hit.proceeds - paid) * 100) / 100)
  ok('实值盈利为正', hit.pnl > 0, hit.pnl)
}

// ── 资金不足 / 张数非法 ──
{
  const chain = new OptionChain({ spotOf: () => 2.6 })
  const c = chain.contractList()[0]
  eqs('资金不足被拒', chain.buy({ contractId: c.id, lots: 1, cash: 1 }).reason, 'funds')
  eqs('张数 0 被拒', chain.buy({ contractId: c.id, lots: 0, cash: 100000 }).reason, 'lots')
  eqs('未知合约被拒', chain.buy({ contractId: 'NOPE', lots: 1, cash: 100000 }).reason, 'unknown_contract')
}

// ── 存档往返 ──
{
  const chain = new OptionChain({ spotOf: () => 2.6 })
  const c = chain.contractList().find((x) => x.type === 'CALL')
  chain.buy({ contractId: c.id, lots: 2, cash: 100000 })
  chain.advanceDay()
  const c2 = new OptionChain({ spotOf: () => 2.6 })
  c2.loadFrom(JSON.parse(JSON.stringify(chain.toJSON())))
  eq('存档往返：序列数', c2.series.length, 3)
  eq('存档往返：持仓数', c2.openPositions().length, 1)
  eq('存档往返：张数', c2.openPositions()[0].lots, 2)
}

// ── 序列轮换：近月结算后立即补新，场上恒 3 个序列 ──
{
  const chain = new OptionChain({ spotOf: () => 2.6 })
  for (let d = 0; d < SERIES_D0[0]; d += 1) chain.advanceDay()
  eq('近月结算后仍是 3 个序列', chain.series.length, 3)
  ok('新近月 D0=30 且 D=30', chain.series[0].d0 === 30 && chain.series[0].daysLeft === 30, chain.series.map((s) => s.daysLeft))
  ok('季月已前移到 60', chain.series.some((s) => s.daysLeft === 59 || s.daysLeft === 60), chain.series.map((s) => s.daysLeft))
}

console.log(`${pass}/${pass + fails.length} 断言通过`)
if (fails.length) {
  console.log('\n失败项：')
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
