/**
 * 驱动脚本：货币精度（PRD Edge Case「数值精度」）。
 *
 * plan.md Verification Plan 行：
 *   Edge Case 数值精度：连续买/卖后 cash / frozenCash / NAV / realizedPnL /
 *   positions[].avgCost / lastOrder.{fee,fillPrice,notional} / quotes.lastPrice
 *   均为 ¥0.01 整数倍（无 0.30000000000000004）
 *
 * 连续两轮「买入 → 结算一日 → 卖出 → 结算一日」，再补一笔市价买与一笔挂单冻结，
 * 覆盖成交、已实现盈亏、持仓成本、冻结资金、撤单退还等全部金额落点。
 * （两天一轮是 T+1 的硬约束；全程落在周一–周五，避免休市拒单干扰金额路径。）
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = { states: [], orders: [] }
const ID = '601398'

try {
  b.reset()
  const cap = () => out.states.push(b.runtimeState())
  const put = (o) => out.orders.push(o)
  cap()

  for (let i = 0; i < 2; i++) {
    let s = b.runtimeState()
    put(b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 100 }))
    cap()
    b.advanceDay()
    cap()
    s = b.runtimeState()
    put(b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitDown, qty: 100 }))
    cap()
    b.advanceDay()
    cap()
  }

  // 市价单（含 0.1% 滑点）—— 滑点后仍须落在 ¥0.01 上
  put(b.submitOrder({ side: 'buy', instrumentId: ID, type: 'market', price: null, qty: 100 }))
  cap()

  // 挂单冻结 → 次日撤销退还（frozenCash / cash 路径）
  const s2 = b.runtimeState()
  put(b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s2.quotes[ID].limitDown, qty: 100 }))
  cap()
  b.advanceDay()
  cap()

  out.rounds = 2
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
