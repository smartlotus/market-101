/**
 * 视觉状态 04：买入成交后 —— 下单面板回执（已成交）、持仓表出现一行、
 * 顶栏可用资金减少、导师文案随状态更新。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

b.reset()
b.selectInstrument('601398')
const s0 = b.runtimeState()
const order = b.submitOrder({
  side: 'buy',
  instrumentId: '601398',
  type: 'limit',
  price: s0.quotes['601398'].limitUp,
  qty: 200,
})
const s = b.runtimeState()
return {
  label: '04_after_buy',
  order,
  dayIndex: s.dayIndex,
  NAV: s.NAV,
  cash: s.cash,
  positions: s.positions,
  unrealizedPnL: s.unrealizedPnL,
  dayReturnPct: s.dayReturnPct,
}
