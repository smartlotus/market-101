/**
 * 视觉状态 08：导师面板的长文案（事件池里最长的 mentorLine = B01，83 个汉字）。
 *
 * 直接把 B01 的真实内容（config/events.json 原文）钉给 devSetEvent，再 advanceDay，
 * 于是 currentEvent = B01 → 新闻卡与导师面板都应完整显示这条长点评而不撑破 400px 宽的底部面板。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

b.reset()
b.devSetEvent({
  id: 'B01',
  type: 'BLACK_SWAN',
  targets: ['ALL'],
  sentiment: 'BAD',
  magnitude: 0.6,
  fxTarget: null,
  headline: '突发：某大型机构爆雷，市场短暂恐慌',
  mentorLine:
    '罕见的大事件引发集体抛售，但监管迅速出手维稳，跌幅有限。就像小区突然停电，大家慌了一下，但很快来电、没真出大事——教你看懂"罕见、剧烈、难预测"，但市场长期仍会恢复。',
  conceptKeys: [],
})
b.advanceDay()
const s = b.runtimeState()
return {
  label: '08_mentor_long',
  dayIndex: s.dayIndex,
  currentEventId: s.currentEvent && s.currentEvent.id,
  mentorLine: s.currentEvent && s.currentEvent.mentorLine,
  mentorLineLen: s.currentEvent ? String(s.currentEvent.mentorLine).length : 0,
}
