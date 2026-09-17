import fs from 'node:fs'
import { MarketSim, REJECT } from '../../scripts/sim/market.js'

const inst = JSON.parse(fs.readFileSync('config/instruments.json', 'utf8')).instruments
const events = JSON.parse(fs.readFileSync('config/events.json', 'utf8'))
const evList = events.events || events

let pass = 0
const fails = []
const ok = (n, c, e) => { if (c) pass += 1; else fails.push(n + ' <- ' + JSON.stringify(e)) }
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), { got: g, want: w })

function sim(chapterUnlocked = 1) {
  const s = new MarketSim({
    instruments: inst, events: evList,
    config: { autoEnterFirstDay: false, defaultInstrumentId: '601398', initialCash: 100000 },
  })
  s.unlockForChapter(chapterUnlocked)
  return s
}

// ── 1) 第一章：默认选中仍必须是 601398（不能被场外基金抢走）─────────
{
  const s = sim(1)
  eq('第一章只解锁 A 股', [...s.unlockedMarkets], ['A_SHARE'])
  s.openAccount(); s.fundInitial(); s.beginFirstDay()
  s.selectCheapestAffordable()
  eq('第一章默认选中 601398', s.selectedInstrumentId, '601398')
  eq('第一章最便宜可买 = 601398', s.cheapestAffordableId(), '601398')
}

// ── 2) 第一章买未解锁品种 → REJECT_11 ────────────────────────────
{
  const s = sim(1)
  s.openAccount(); s.fundInitial(); s.beginFirstDay()
  const r1 = s.submitOrder({ side: 'buy', instrumentId: '00700', type: 'limit', price: 412.6, qty: 100 })
  eq('第一章买港股被锁', r1.reasonCode, REJECT.LOCKED)
  const r2 = s.submitOrder({ side: 'buy', instrumentId: '110020', type: 'limit', price: 1.5, qty: 100 })
  eq('第一章买基金被锁', r2.reasonCode, REJECT.LOCKED)
  const r3 = s.submitOrder({ side: 'buy', instrumentId: 'BTC', type: 'limit', price: 68000, qty: 0.01 })
  eq('第一章买加密被锁', r3.reasonCode, REJECT.LOCKED)
}

// ── 3) A 股行为必须与 Stage 0 完全一致 ────────────────────────────
{
  const s = sim(1)
  s.openAccount(); s.fundInitial(); s.beginFirstDay()
  s.selectInstrument('601398')
  const px = s.quotes.snapshot()['601398'].lastPrice
  const r = s.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', price: px, qty: 100 })
  eq('A股首单必成交', r.accepted, true)
  eq('A股成交手续费', r.fee, 5.01)
  const rBad = s.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', price: px, qty: 150 })
  eq('A股非整手被拒', rBad.reasonCode, REJECT.LOT)
  const rTick = s.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', price: px + 0.005, qty: 100 })
  eq('A股价格精度被拒', rTick.reasonCode, REJECT.TICK)
}

// ── 4) 第五章解锁后：港股 T+0、每手不固定、无涨跌停、汇率折算 ──────
{
  const s = sim(5)
  ok('第五章解锁港股', s.isUnlocked('HK'), [...s.unlockedMarkets])
  s.openAccount(); s.fundInitial(); s.beginFirstDay()
  s.selectInstrument('00700')
  const px = s.quotes.snapshot()['00700'].lastPrice
  const r = s.submitOrder({ side: 'buy', instrumentId: '00700', type: 'limit', price: px, qty: 100 })
  eq('港股买入成交', r.accepted, true)
  if (r.accepted) {
    // T+0：当日即可卖
    eq('港股 T+0 当日可卖', s.account.availableQty('00700'), 100)
    const r2 = s.submitOrder({ side: 'sell', instrumentId: '00700', type: 'limit', price: px, qty: 100 })
    eq('港股当日卖出成功（T+0）', r2.accepted, true)
  }
  // 小米每手 200 股
  const rXm = s.submitOrder({ side: 'buy', instrumentId: '01810', type: 'limit', price: 18.62, qty: 100 })
  eq('港股小米 100 股被拒（每手 200）', rXm.reasonCode, REJECT.LOT)
  // 港股无涨跌停：远高于现价也不触发 #2
  const q = s.quotes.snapshot()['00700']
  eq('港股无涨跌停', q.limitUp, null)
}

// ── 5) 场外基金：按金额、100 元起、T+1 确认 ───────────────────────
{
  const s = sim(3)
  ok('第三章解锁 ETF 与基金', s.isUnlocked('FUND') && s.isUnlocked('ETF'), [...s.unlockedMarkets])
  s.openAccount(); s.fundInitial(); s.beginFirstDay()
  const r = s.submitOrder({ side: 'buy', instrumentId: '110020', type: 'limit', price: 1.5, qty: 50 })
  eq('基金低于 100 元被拒', r.reasonCode, REJECT.MIN_AMOUNT)
  const r2 = s.submitOrder({ side: 'buy', instrumentId: '110020', type: 'limit', price: 1.5, qty: 100 })
  eq('基金 150 元可申购', r2.accepted, true)
}

// ── 6) 加密 7×24：周末也能下单 ───────────────────────────────────
{
  const s = sim(7)
  s.openAccount(); s.fundInitial(); s.beginFirstDay()
  // 推进到周六
  let guard = 0
  while (s.calendar.isMarketOpen && guard < 10) { s.advanceDay(); guard += 1 }
  ok('已推进到休市日', !s.calendar.isMarketOpen, s.calendar.inGameDate)
  ok('加密 7x24 仍开市', s.calendar.isOpenFor('CRYPTO'), s.calendar.inGameDate)
  const r = s.submitOrder({ side: 'buy', instrumentId: 'BTC', type: 'limit', price: 68000, qty: 0.01 })
  ok('休市日仍可买加密', r.accepted, r)
}

// ── 7) 快照追加字段存在 ──────────────────────────────────────────
{
  const s = sim(5)
  const st = s.snapshot()
  ok('snapshot 含 fx', st.fx && typeof st.fx.rates === 'object', st.fx)
  ok('snapshot 含 unlockedMarkets', Array.isArray(st.unlockedMarkets), st.unlockedMarkets)
  ok('snapshot 含 marketOpenFor', st.marketOpenFor && 'CRYPTO' in st.marketOpenFor, st.marketOpenFor)
  eq('加密永不休市', st.marketOpenFor.CRYPTO, true)
}

// ── 8) 存档往返保留汇率与解锁 ────────────────────────────────────
{
  const s = sim(5)
  s.unlockForChapter(7)
  const s2 = new MarketSim({ instruments: inst, events: evList, config: { autoEnterFirstDay: false } })
  s2.loadFrom(JSON.parse(JSON.stringify(s.toJSON())))
  ok('存档往返解锁集合', s2.isUnlocked('CRYPTO') && s2.isUnlocked('HK'), [...s2.unlockedMarkets])
  eq('存档往返 USD 汇率', s2.fx.rateOf('USD'), 7.2)
}

console.log(`${pass}/${pass + fails.length} 断言通过`)
if (fails.length) {
  console.log('\n失败项：')
  for (const f of fails) console.log('  - ' + f)
  process.exit(1)
}
