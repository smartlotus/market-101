/**
 * 视觉状态 03：跌（绿）K 线。同样的定向事件换成 BAD / magnitude 1.0，
 * 当根蜡烛应为「跌 = 绿」—— 与 02 一起构成红/绿方向色的对照证据。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

b.reset()
b.selectInstrument('601398')
b.devSetEvent({
  id: 'VIS_DOWN',
  type: 'COMPANY',
  targets: ['601398'],
  sentiment: 'BAD',
  magnitude: 1.0,
  fxTarget: null,
  headline: '视觉验证：工商银行资产质量恶化，股价重挫',
  mentorLine: '视觉验证用事件：这里的绿柱代表下跌。别把绿当好事，A 股不是美股。',
  conceptKeys: [],
})
b.advanceDay()
const s = b.runtimeState()
return {
  label: '03_down_event',
  dayIndex: s.dayIndex,
  inGameDate: s.inGameDate,
  selectedInstrumentId: s.selectedInstrumentId,
  currentEventId: s.currentEvent && s.currentEvent.id,
  quote: s.quotes['601398'],
}
