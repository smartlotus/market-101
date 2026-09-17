/**
 * 驱动脚本：账户初始状态 + 默认选中标的 + 限价买入的 ΔNAV = −fee 恒等式。
 *
 * plan.md Verification Plan 行：
 *   §2.1 初始账户 cash=100000 / frozenCash=0 / positions=[] / realizedPnL=0 / NAV=100000
 *   §2.1 派生 NAV：必须用限价单且 fillPrice == lastPrice 时，买入后 ΔNAV = −fee
 *   §2.5 默认选中第一只标的
 *
 * 全部状态经 BrokerShell 测试钩子读取，不爬 DOM。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}

try {
  b.reset()
  out.init = b.runtimeState()

  // 限价买：限价取「涨停价」（≥ 最新价）→ 立即触发，fillPrice = min(限价, 最新价) = 最新价。
  // 此时 NAV = cash + frozenCash + lastPrice×qty，而 cash 减了 notional+fee、市值加了 notional，
  // 故 ΔNAV 恒等于 −fee。市价单另含 0.1% 滑点，不适用于该恒等式（产品规则，见 log.md 程序员说明）。
  const before = b.runtimeState()
  const id = '601398'
  const limitUp = before.quotes[id].limitUp
  const order = b.submitOrder({ side: 'buy', instrumentId: id, type: 'limit', price: limitUp, qty: 100 })
  const after = b.runtimeState()

  out.limitBuy = {
    instrumentId: id,
    limitUp,
    lastPrice: before.quotes[id].lastPrice,
    navBefore: before.NAV,
    cashBefore: before.cash,
    order,
    navAfter: after.NAV,
    cashAfter: after.cash,
    positions: after.positions,
  }

  // §2.5 默认选中第一只标的（config/instruments.json 首行 = 600519）
  out.defaultSelected = before.selectedInstrumentId
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
