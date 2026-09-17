/**
 * 驱动脚本：限价撮合的价格改善（PRD §3.4）。
 *
 * plan.md Verification Plan 行：
 *   §3.4 限价价格改善：买限价 ≥ 最新价 → fillPrice = lastPrice；卖限价 ≤ 最新价 → fillPrice = limit（= min）
 *
 * 买侧：限价取涨停价（≥ 最新价）→ 成交价 = min(限价, 最新价) = 最新价。
 * 卖侧：先买入建仓、结算一日解除 T+1，再挂限价卖（限价取跌停价，≤ 最新价）
 *       → 成交价 = min(限价, 最新价) = 限价本身，即「不低于限价」的价格改善。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}
const ID = '601398'

try {
  b.reset()

  // 买侧：限价 = 涨停价
  const s0 = b.runtimeState()
  const limitUp = s0.quotes[ID].limitUp
  const buyOrder = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: limitUp, qty: 100 })
  out.buy = {
    limitPrice: limitUp,
    lastPrice: s0.quotes[ID].lastPrice,
    order: buyOrder,
  }

  // 次日（T+1 解禁）后取新的跌停价作为卖限价
  b.advanceDay()
  const s1 = b.runtimeState()
  const limitDown = s1.quotes[ID].limitDown
  const sellOrder = b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: limitDown, qty: 100 })
  out.sell = {
    limitPrice: limitDown,
    lastPrice: s1.quotes[ID].lastPrice,
    limitUp: s1.quotes[ID].limitUp,
    order: sellOrder,
  }
  out.sellState = s1
  out.afterSell = b.runtimeState()
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
