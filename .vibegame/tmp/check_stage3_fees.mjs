import { computeFee, feeBreakdown, marketRules, rulesFor, checkLot, isTickAligned, MARKETS } from '../../scripts/sim/fees.js'
import { FxBook } from '../../scripts/sim/fx.js'

let pass = 0
const fails = []
const ok = (name, cond, extra) => {
  if (cond) { pass += 1 } else { fails.push(name + '  <- ' + JSON.stringify(extra)) }
}
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want })

// ── A 股：必须与 Stage 0 完全一致 ───────────────────────────────
eq('A股 买 620 手续费+过户费', computeFee('A_SHARE', 'buy', 620), 5.01)
eq('A股 卖 620 佣金+印花+过户', computeFee('A_SHARE', 'sell', 620), 5.32)
eq('A股 买 100000 → 佣金25 + 过户1', computeFee('A_SHARE', 'buy', 100000), 26)
eq('A股 卖 100000 → 25 + 50 + 1', computeFee('A_SHARE', 'sell', 100000), 76)
{
  const b = feeBreakdown('A_SHARE', 'sell', 620)
  eq('A股明细 commission', b.commission, 5)
  eq('A股明细 stampDuty', b.stampDuty, 0.31)
  eq('A股明细 transferFee', b.transferFee, 0.01)
  eq('A股明细 total', b.total, 5.32)
  ok('A股明细自身相加 == total', Math.abs(b.commission + b.stampDuty + b.transferFee - b.total) < 1e-9, b)
}

// ── ETF：佣金同 A 股，免印花/过户 ──────────────────────────────
eq('ETF 买 620（免过户）', computeFee('ETF', 'buy', 620), 5)
eq('ETF 卖 100000（免印花免过户）', computeFee('ETF', 'sell', 100000), 25)
ok('ETF 卖出不含印花税', feeBreakdown('ETF', 'sell', 100000).stampDuty === 0, feeBreakdown('ETF', 'sell', 100000))

// ── 公募基金：申购费 / 赎回费按持有期 ──────────────────────────
eq('基金 申购 1000 → 1.5', computeFee('FUND', 'buy', 1000), 1.5)
eq('基金 赎回 1000（持有 3 天）→ 15', computeFee('FUND', 'sell', 1000, { holdingDays: 3 }), 15)
eq('基金 赎回 1000（持有 30 天）→ 5', computeFee('FUND', 'sell', 1000, { holdingDays: 30 }), 5)
eq('基金 赎回 1000（持有 400 天）→ 0', computeFee('FUND', 'sell', 1000, { holdingDays: 400 }), 0)
eq('基金 赎回 1000（持有 7 天整 → 第二档）', computeFee('FUND', 'sell', 1000, { holdingDays: 7 }), 5)

// ── 港股：佣金下限 50 + 印花 0.13% 双边 + 平台费 15 ────────────
eq('港股 买 40000 → 50+52+15', computeFee('HK', 'buy', 40000), 117)
eq('港股 卖 40000 → 50+52+15', computeFee('HK', 'sell', 40000), 117)
eq('港股 买 100000 → 50+130+15', computeFee('HK', 'buy', 100000), 195)

// ── 美股：零佣金 + 平台费 0.99 ────────────────────────────────
eq('美股 买 1000 → 0.99', computeFee('US', 'buy', 1000), 0.99)
eq('美股 卖 1000 → 0.99', computeFee('US', 'sell', 1000), 0.99)

// ── 加密：0.1% 双边 ──────────────────────────────────────────
eq('加密 买 1000 → 1', computeFee('CRYPTO', 'buy', 1000), 1)
eq('加密 卖 2500 → 2.5', computeFee('CRYPTO', 'sell', 2500), 2.5)

// ── 期权：佣金 max(0.02%,1.5) + 交易所费 1.6/张 ────────────────
eq('期权 权利金 10000 1张 → max(2,1.5)+1.6', computeFee('OPTION', 'buy', 10000, { lots: 1 }), 3.6)
eq('期权 权利金 10000 3张 → 2+4.8', computeFee('OPTION', 'buy', 10000, { lots: 3 }), 6.8)

// ── 最小单位 / tick ──────────────────────────────────────────
ok('A股 100 股合规', checkLot('A_SHARE', 100) === null, checkLot('A_SHARE', 100))
ok('A股 150 股不合规', checkLot('A_SHARE', 150) === 'lot', checkLot('A_SHARE', 150))
ok('港股 腾讯 100 股合规', checkLot('HK', 100, { lotSize: 100 }) === null, '')
ok('港股 小米 100 股不合规（每手 200）', checkLot('HK', 100, { lotSize: 200 }) === 'lot', '')
ok('港股 小米 200 股合规', checkLot('HK', 200, { lotSize: 200 }) === null, '')
ok('美股 1 股合规', checkLot('US', 1) === null, checkLot('US', 1))
ok('美股 0.5 股合规（碎股）', checkLot('US', 0.5) === null, checkLot('US', 0.5))
ok('美股 0.0005 股不合规', checkLot('US', 0.0005) === 'lot', checkLot('US', 0.0005))
ok('加密 0.5 个 BTC 合规（按金额）', checkLot('CRYPTO', 0.5) === null, checkLot('CRYPTO', 0.5))
eq('A股 tick 对齐', isTickAligned(6.21, 'A_SHARE'), true)
eq('A股 tick 不对齐', isTickAligned(6.215, 'A_SHARE'), false)
eq('加密 tick 对齐 0.0001', isTickAligned(42123.4567, 'CRYPTO'), true)
eq('加密 tick 不对齐', isTickAligned(42123.45678, 'CRYPTO'), false)

// ── 市场规则表 ───────────────────────────────────────────────
ok('七类市场齐备', MARKETS.length === 7, MARKETS)
eq('A股 T+1', marketRules('A_SHARE').tPlus, 1)
eq('港股 T+0', marketRules('HK').tPlus, 0)
eq('美股 T+0', marketRules('US').tPlus, 0)
eq('加密 T+0', marketRules('CRYPTO').tPlus, 0)
eq('基金 未知价', marketRules('FUND').tPlus, 'nav')
eq('美股 支持碎股', marketRules('US').fractionalMin, 0.001)
eq('基金 赎回 T+3', marketRules('FUND').redemptionSettleDays, 3)
eq('期权 每张 10000 份', marketRules('OPTION').multiplier, 10000)
eq('港股 lotSize 逐标的', rulesFor('HK', { lotSize: 200 }).lotSize, 200)
eq('A股 板块覆盖 limitPct', rulesFor('A_SHARE', { limitPct: 0.2 }).limitPct, 0.2)

// ── 汇率 ─────────────────────────────────────────────────────
{
  const fx = new FxBook()
  eq('初始 HKD→CNY', fx.rateOf('HKD'), 0.92)
  eq('初始 USD→CNY', fx.rateOf('USD'), 7.2)
  eq('USD 金额折算', fx.toCNY(100, 'USD'), 720)
  eq('HKD 金额折算', fx.toCNY(400, 'HKD'), 368)
  eq('CNY 恒为 1', fx.rateOf('CNY'), 1)
  eq('未知货币退化为 1', fx.rateOf('XYZ'), 1)

  // 非 MACRO/POLICY 不动汇率
  const before = fx.rateOf('USD')
  const r1 = fx.applyEvent({ id: 'C01', type: 'COMPANY', sentiment: 'BAD', magnitude: 0.3, fxTarget: 'USD' })
  eq('COMPANY 事件不动汇率', fx.rateOf('USD'), before)
  eq('COMPANY 事件返回 null', r1, null)

  // MACRO 带 fxTarget 才动
  const ev = { id: 'M03', type: 'MACRO', sentiment: 'BAD', magnitude: 0.3, fxTarget: 'USD', headline: '美联储鹰派' }
  const mv = fx.applyEvent(ev)
  ok('MACRO+fxTarget 产生变动记录', mv && mv.currency === 'USD', mv)
  ok('变动幅度落在 ±3% + ±0.2% 内',
    Math.abs(mv.after / mv.before - 1) <= 0.03 + 0.002 + 1e-9,
    { before: mv.before, after: mv.after })
  ok('汇率保留 4 位', Math.abs(mv.after * 10000 - Math.round(mv.after * 10000)) < 1e-9, mv.after)

  // 无事件日不变
  const r2 = fx.applyEvent(null)
  eq('无事件返回 null', r2, null)

  // 存档往返
  const snap = fx.snapshot()
  const fx2 = new FxBook()
  fx2.loadFrom(JSON.parse(JSON.stringify(fx.toJSON())))
  eq('存档往返 USD', fx2.rateOf('USD'), fx.rateOf('USD'))
  eq('snapshot 带 movePct', typeof snap.movePct.USD, 'number')
}

console.log(`${pass}/${pass + fails.length} 断言通过`)
if (fails.length) {
  console.log('\n失败项：')
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
