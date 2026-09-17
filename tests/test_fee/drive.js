/**
 * 驱动脚本：A 股费用（PRD §3.4）。
 *
 * plan.md Verification Plan 行的主项：
 *   §3.4 费用买入：fee = max(notional×0.00025, 5) + notional×0.00001，cash 减 notional + fee
 *   （市场买 1 手工行 = 601398 × 100 股）
 *
 * 同 topic 追加卖出侧公式（PRD §3.4 卖出 = 佣金 + 印花税 + 过户费）：
 *   卖出费 = max(notional×0.00025, 5) + notional×0.0005 + notional×0.00001
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}
const ID = '601398'

const cap = (label) => { out[label] = b.runtimeState() }

try {
  b.reset()
  cap('reset')

  // 市价买 100 股（1 手）：fillPrice = lastPrice × 1.001（PRD §3.4 滑点 0.1%）
  const beforeBuy = b.runtimeState()
  out.buyOrder = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'market', price: null, qty: 100 })
  cap('afterBuy')
  out.buyContext = {
    lastPrice: beforeBuy.quotes[ID].lastPrice,
    cashBefore: beforeBuy.cash,
    navBefore: beforeBuy.NAV,
    marketValueBefore: beforeBuy.marketValue,
  }

  // 结算一日解除 T+1，再市价卖出 100 股
  b.advanceDay()
  const beforeSell = b.runtimeState()
  out.sellOrder = b.submitOrder({ side: 'sell', instrumentId: ID, type: 'market', price: null, qty: 100 })
  cap('afterSell')
  out.sellContext = {
    lastPrice: beforeSell.quotes[ID].lastPrice,
    cashBefore: beforeSell.cash,
    realizedBefore: beforeSell.realizedPnL,
    avgCost: beforeSell.positions[0].avgCost,
  }
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
