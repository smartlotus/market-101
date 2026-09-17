/**
 * 视觉状态 06：拒单反馈。
 *
 * 用 1 手茅台（¥1480×100 = ¥148,000 > ¥100,000 本金）触发拒单 #1 ——
 * 下单面板应显示「委托被拒：可用资金不足…」，导师面板应同步给出一句温和解释。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

b.reset()
b.selectInstrument('600519')
const s0 = b.runtimeState()
const order = b.submitOrder({
  side: 'buy',
  instrumentId: '600519',
  type: 'limit',
  price: s0.quotes['600519'].limitUp,
  qty: 100,
})
const s = b.runtimeState()
return {
  label: '06_rejected',
  order,
  selectedInstrumentId: s.selectedInstrumentId,
  cash: s.cash,
  lastOrder: s.lastOrder,
}
