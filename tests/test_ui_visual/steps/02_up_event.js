/**
 * 视觉状态 02：涨（红）K 线。固定一笔 GOOD / magnitude 1.0 的定向事件打在 601398 上，
 * 并把选中标的切到它 —— 当根蜡烛应为「涨 = 红」，新闻卡也应显示这条利好。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

b.reset()
b.devSetEvent({
  id: 'VIS_UP',
  type: 'COMPANY',
  targets: ['601398'],
  sentiment: 'GOOD',
  magnitude: 1.0,
  fxTarget: null,
  headline: '视觉验证：工商银行获大额注资，股价跳涨',
  mentorLine: '视觉验证用事件：这里的红柱代表上涨，A 股习惯与欧美相反。',
  conceptKeys: [],
})
b.advanceDay()
b.selectInstrument('601398')
const s = b.runtimeState()
return {
  label: '02_up_event',
  dayIndex: s.dayIndex,
  inGameDate: s.inGameDate,
  isMarketOpen: s.isMarketOpen,
  selectedInstrumentId: s.selectedInstrumentId,
  currentEventId: s.currentEvent && s.currentEvent.id,
  quote: s.quotes['601398'],
}
