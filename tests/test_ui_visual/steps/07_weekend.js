/**
 * 视觉状态 07：休市（周末）。
 *
 * 从周一推进 5 次落到周六：顶栏应显示「今日休市」徽标、主按钮变「下一日（休市）」、
 * 下单区禁用并主动给出 #3 文案、新闻卡切到休市说明、导师文案切到周末语境。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

b.reset()
b.selectInstrument('601398')
for (let i = 0; i < 5; i++) b.advanceDay()
const s = b.runtimeState()
return {
  label: '07_weekend',
  dayIndex: s.dayIndex,
  inGameDate: s.inGameDate,
  weekdayLabel: s.weekdayLabel,
  isMarketOpen: s.isMarketOpen,
  calendarClosedReason: s.calendarClosedReason,
  canSubmitOrder: s.canSubmitOrder,
  dayReturnPct: s.dayReturnPct,
  currentEvent: s.currentEvent,
  NAV: s.NAV,
}
