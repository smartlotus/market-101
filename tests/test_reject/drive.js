/**
 * 驱动脚本：拒单条件（PRD §3.4 表 + Edge Case）。每个场景先 reset，再驱动一笔注定被拒的委托。
 *
 * plan.md Verification Plan 行：
 *   #1 资金不足（买 1 手茅台） / #2 超涨跌停（限价 > 涨停）
 *   #4 T+1（当日买入后当日卖出） / #6 非整手 / #7 价格精度 / #8 可卖不足
 *   #3 休市（市场关闭时 submitOrder）+ canSubmitOrder == false
 *   数量 ≤ 0 → 独立 reasonCode='REJECT_10'、文案「委托数量必须大于 0」，且 ≠ 'REJECT_6'
 *   #2 卖出限价 < 跌停（另一侧）
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}
const ID = '601398' // 上交所主板，限价 ±10%，起始价 6.20
const MUOTAI = '600519' // 贵州茅台，起始价 1480 → 1 手 148000 > 100000 本金
const snap = () => b.runtimeState()
const put = (label, order, extra) => { out[label] = Object.assign({ order, state: snap() }, extra || {}) }

try {
  // ---- #1 可用资金不足：买 1 手茅台 ----
  b.reset()
  let s = snap()
  put('s01_funds', b.submitOrder({ side: 'buy', instrumentId: MUOTAI, type: 'limit', price: s.quotes[MUOTAI].limitUp, qty: 100 }), {
    context: { code: MUOTAI, limitUp: s.quotes[MUOTAI].limitUp, lastPrice: s.quotes[MUOTAI].lastPrice, cash: s.cash },
  })

  // ---- #2 委托价超涨跌停：买入限价 > 涨停价 ----
  b.reset()
  s = snap()
  put('s02_limit_over_up', b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp + 0.01, qty: 100 }), {
    context: { limitUp: s.quotes[ID].limitUp, limitDown: s.quotes[ID].limitDown },
  })

  // ---- #2 另一侧：卖出限价 < 跌停价（无需持仓，涨跌停校验先于持仓校验） ----
  b.reset()
  s = snap()
  put('s02_limit_under_down', b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitDown - 0.01, qty: 100 }), {
    context: { limitUp: s.quotes[ID].limitUp, limitDown: s.quotes[ID].limitDown },
  })

  // ---- #4 T+1：当日买入后当日卖出 ----
  b.reset()
  s = snap()
  const buyT1 = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 100 })
  const afterBuy = snap()
  put('s04_t1', b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: afterBuy.quotes[ID].limitDown, qty: 100 }), {
    context: { buyOrder: buyT1, lockedQty: afterBuy.positions[0] && afterBuy.positions[0].lockedQty, positions: afterBuy.positions },
  })

  // ---- #6 数量非整手 ----
  b.reset()
  s = snap()
  put('s06_lot', b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 150 }))

  // ---- #7 价格精度不符 ----
  b.reset()
  put('s07_tick', b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: 5.925, qty: 100 }))

  // ---- #8 可卖持仓不足（持仓够锁定量以外仍不足） ----
  b.reset()
  s = snap()
  b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 100 })
  b.advanceDay()
  const afterDay = snap()
  put('s08_shares', b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: afterDay.quotes[ID].limitDown, qty: 200 }), {
    context: { heldQty: afterDay.positions[0] && afterDay.positions[0].qty, lockedQty: afterDay.positions[0] && afterDay.positions[0].lockedQty },
  })

  // ---- #3 休市：推进到周六后下单 ----
  b.reset()
  for (let i = 0; i < 5; i++) b.advanceDay()
  s = snap()
  put('s03_closed', b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: 5, qty: 100 }), {
    context: { dayIndex: s.dayIndex, inGameDate: s.inGameDate, isMarketOpen: s.isMarketOpen, canSubmitOrder: s.canSubmitOrder },
  })

  // ---- 数量 ≤ 0（Edge Case，独立原因码 REJECT_10） ----
  b.reset()
  put('s10_qty_zero', b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: 5, qty: 0 }))
  put('s10_qty_negative', b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: 5, qty: -100 }))

  // 收尾：回到干净的可玩状态，便于后续人工检查
  b.reset()
  out.finalState = snap()
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
