import { Account } from '../../scripts/sim/account.js'
import { FxBook } from '../../scripts/sim/fx.js'

let pass = 0
const fails = []
const ok = (n, c, e) => { if (c) pass += 1; else fails.push(n + ' <- ' + JSON.stringify(e)) }
const eq = (n, got, want) => ok(n, Math.abs(Number(got) - Number(want)) < 0.005, { got, want })
const eqs = (n, got, want) => ok(n, String(got) === String(want), { got, want })

const Q = (id, lastPrice, market = 'A_SHARE', currency = 'CNY') => ({ [id]: { lastPrice, market, currency } })

// ── 1) A 股：有汇率账本时也必须和 Stage 0 完全一致 ──────────────────
{
  const fx = new FxBook()
  const a = new Account({ fx })
  a.open(); a.fund(100000)
  a.buy('601398', 100, 6.20, { market: 'A_SHARE', currency: 'CNY', tPlus: 1 })
  eq('A股买入后现金 = 100000 - 620 - 5.01', a.cash, 99374.99)
  eq('A股 T+1 锁 100', a.getPosition('601398').t1LockedQty, 100)
  eq('A股可卖 = 0', a.availableQty('601398'), 0)
  a.clearT1Locks()
  eq('解禁后可卖 100', a.availableQty('601398'), 100)
  eq('A股 NAV（汇率=1）', a.nav(Q('601398', 6.20)), 99994.99)
  const r = a.sell('601398', 100, 6.30, { market: 'A_SHARE', currency: 'CNY' })
  eq('A股卖出入账', r.creditCNY, 624.68)
  eq('A股已实现盈亏', a.realizedPnL, 4.68)
  eq('A股卖出后无持仓', a.getPosition('601398'), null)
  eq('A股 NAV 最终', a.nav(Q('601398', 6.30)), 99999.67)
}

// ── 2) 港股：T+0 不锁仓，费用按 HKD 算，折算入 CNY ────────────────
{
  const fx = new FxBook()
  const a = new Account({ fx })
  a.open(); a.fund(100000)
  // 买 100 股腾讯 @ 412.60 HKD → 成交额 41260 HKD，汇率 0.92
  a.buy('00700', 100, 412.60, { market: 'HK', currency: 'HKD', tPlus: 0 })
  eq('港股 T+0 不锁仓', a.getPosition('00700').t1LockedQty, 0)
  eq('港股立即可卖 100', a.availableQty('00700'), 100)
  // 费用 = 佣金 max(41260*0.0005,50)=50 + 印花 41260*0.0013=53.638 + 平台费 15 = 118.64 HKD
  const pos = a.getPosition('00700')
  eq('港股买入汇率记录', pos.buyRate, 0.92)
  // 扣款 CNY = (41260 + 118.64) * 0.92 = 41378.64 * 0.92 = 38068.35
  eq('港股扣款折算 CNY', a.cash, 100000 - 38068.35)
  eq('港股持仓市值折 CNY', a.marketValueOf('00700', Q('00700', 412.60, 'HK', 'HKD')), 37959.2)

  // 汇率不变时卖出：无汇率贡献
  a.sell('00700', 100, 412.60, { market: 'HK', currency: 'HKD' })
  eq('汇率不变 → 已实现为负（只有费用）', a.realizedPnL, -109.15)
}

// ── 3) 汇率变动 → 汇率贡献被拆出来 ────────────────────────────────
{
  const fx = new FxBook()
  const a = new Account({ fx })
  a.open(); a.fund(100000)
  a.buy('00700', 100, 412.60, { market: 'HK', currency: 'HKD', tPlus: 0 })
  // 港币升值：0.92 → 0.95（USD 不影响 HKD，这里直接改 rates 模拟事件结果）
  fx.prevRates.HKD = 0.92
  fx.rates.HKD = 0.95
  const p = a.positions(Q('00700', 412.60, 'HK', 'HKD'))[0]
  // 股价贡献 = 0（价格未变）；汇率贡献 = 412.6*100*(0.95-0.92) = 1237.8
  eq('股价贡献 = 0', p.priceContribution, 0)
  eq('汇率贡献 = 1237.8', p.fxContribution, 1237.8)
  eq('浮盈 = 汇率贡献', p.unrealizedPnL, 1237.8)
  eq('市值按新汇率折算', p.marketValue, 41260 * 0.95)
  ok('持仓带 market/currency', p.market === 'HK' && p.currency === 'HKD', p)
}

// ── 4) 美股碎股 + 零佣金 ─────────────────────────────────────────
{
  const fx = new FxBook()
  const a = new Account({ fx })
  a.open(); a.fund(100000)
  a.buy('AAPL', 0.5, 232.50, { market: 'US', currency: 'USD', tPlus: 0 })
  // 成交额 116.25 USD，零佣金 + 平台费 0.99 → 117.24 USD × 7.2 = 844.13 CNY
  eq('美股碎股买入扣款', a.cash, 100000 - 844.13)
  eq('美股 T+0 可卖', a.availableQty('AAPL'), 0.5)
  eq('美股持仓市值折 CNY', a.marketValueOf('AAPL', Q('AAPL', 232.5, 'US', 'USD')), 837)
}

// ── 5) 存档往返保留货币与买入汇率 ────────────────────────────────
{
  const fx = new FxBook()
  const a = new Account({ fx })
  a.open(); a.fund(100000)
  a.buy('00700', 100, 412.60, { market: 'HK', currency: 'HKD', tPlus: 0 })
  const b = new Account({ fx })
  b.loadFrom(JSON.parse(JSON.stringify(a.toJSON())))
  const p = b.getPosition('00700')
  eqs('存档往返 currency', p.currency, 'HKD')
  eq('存档往返 buyRate', p.buyRate, 0.92)
  eq('存档往返 qty', p.qty, 100)
  eq('存档往返 avgCost', p.avgCost, 412.6)
}

// ── 6) 无汇率账本（Stage 0/1/2 场景）必须退化为 1，不崩 ────────────
{
  const a = new Account({})
  a.open(); a.fund(100000)
  a.buy('601398', 100, 6.20, { market: 'A_SHARE', currency: 'CNY', tPlus: 1 })
  eq('无 fx 时 A 股不受影响', a.cash, 99374.99)
  eq('无 fx 时 rateFor 退化 1', a.rateFor('HKD'), 1)
}

console.log(`${pass}/${pass + fails.length} 断言通过`)
if (fails.length) {
  console.log('\n失败项：')
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
