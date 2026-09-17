/**
 * 视觉状态 01：开机默认态（重置后第 1 交易日，默认选中 601398 工商银行）。
 * 用于判断整体券商风布局是否可读、是否溢出。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

b.reset()
const s = b.runtimeState()
return {
  label: '01_default',
  dayIndex: s.dayIndex,
  inGameDate: s.inGameDate,
  isMarketOpen: s.isMarketOpen,
  selectedInstrumentId: s.selectedInstrumentId,
  NAV: s.NAV,
  cash: s.cash,
  currentEventId: s.currentEvent && s.currentEvent.id,
}
