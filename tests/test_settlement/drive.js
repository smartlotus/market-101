/**
 * 驱动脚本：每日结算（PRD §3.5）+ 挂单冻结/锁定 Edge Case。
 *
 * plan.md Verification Plan 行：
 *   §3.5 第3步 T+1 解禁：advanceDay 后 positions.lockedQty = 0、次日可卖
 *   §3.5 第4步 挂单撤销：限价买不成交 → advanceDay 后 pendingOrders = [] 且 frozenCash 释放
 *   §3.5 第5步 净值记录：每推进一日（含休市日）navHistory 长度 +1、末项 === NAV；
 *                        navHistory[0] === 100000；reset() 后 navHistory === [100000]
 *   Edge Case 卖出后持仓归零：sell 全部 qty 后 positions 不再含该 instrumentId
 *   Edge Case 限价买挂起冻结：pendingOrders[].frozenCash == fillPrice×Q + fee 且 cash 同步减少
 *   Edge Case 限价卖挂起持仓占用：positions[].lockedQty 增加、可卖相应减少
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}
const ID = '601398'
const snap = () => b.runtimeState()
const cap = (label) => { out[label] = snap() }

try {
  // ============ A. T+1 解禁 + 卖出归零 ============
  b.reset()
  let s = snap()
  out.a_buyOrder = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 100 })
  cap('a_afterBuy') // lockedQty 应为 100（当日买入）
  b.advanceDay()
  cap('a_afterAdvance') // lockedQty 应为 0（结算第 3 步）
  const day2 = snap()
  out.a_sellOrder = b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: day2.quotes[ID].limitDown, qty: 100 })
  cap('a_afterSell') // positions 不应再含 601398

  // ============ B. 限价买挂起：冻结资金 + 跨日撤销 ============
  b.reset()
  cap('b_reset')
  s = snap()
  const pendPrice = s.quotes[ID].limitDown // < 最新价 → 买单不触发 → 挂起
  const cashBeforePending = s.cash
  out.b_pendingOrder = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: pendPrice, qty: 100 })
  cap('b_afterPending') // frozenCash == fillPrice×Q + fee，cash 同步减少
  out.b_context = { limitDown: pendPrice, lastPrice: s.quotes[ID].lastPrice, cashBeforePending }
  b.advanceDay()
  cap('b_afterAdvance') // 结算第 4 步：pendingOrders 清空、frozenCash 释放

  // ============ C. 限价卖挂起：持仓占用 ============
  b.reset()
  s = snap()
  b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 200 })
  b.advanceDay() // 解 T+1
  const c0 = snap()
  out.c_pendingOrder = b.submitOrder({
    side: 'sell',
    instrumentId: ID,
    type: 'limit',
    price: c0.quotes[ID].limitUp, // > 最新价 → 卖单不触发 → 挂起
    qty: 100,
  })
  cap('c_afterPending') // lockedQty == 100，可卖 = qty − lockedQty == 100
  // 再挂一笔：仅被挂单占用的部分无法再卖 → REJECT_8（而非 REJECT_4，因 t1LockedQty == 0）
  const c1 = snap()
  out.c_secondSell = b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: c1.quotes[ID].limitDown, qty: 200 })
  cap('c_afterSecondSell')

  // ============ D. 净值记录（结算第 5 步）============
  b.reset()
  cap('d_reset')
  s = snap()
  b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 100 })
  cap('d_afterBuy')
  for (let i = 0; i < 5; i++) {
    b.advanceDay()
    cap('d_advance' + (i + 1)) // d_advance5 落在周六（休市日），同样应记一笔
  }
  b.reset()
  cap('d_afterReset')
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
