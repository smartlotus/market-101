/**
 * 视觉状态 05：推进一日后 —— P&L 明显移动。
 *
 * 承接 04 的持仓（200 股 601398），先钉一笔 BAD / magnitude 1.0 的定向事件再 advanceDay，
 * 于是持仓浮亏与顶栏「当日涨跌幅」都有肉眼可见的变化，同时 T+1 锁定解除
 * （持仓表里「锁定(T+1)」标记应消失）。
 */
const b = sceneTree.nodes.get('broker')
const before = b.runtimeState()
b.devSetEvent({
  id: 'VIS_AFTER',
  type: 'COMPANY',
  targets: ['601398'],
  sentiment: 'BAD',
  magnitude: 1.0,
  fxTarget: null,
  headline: '视觉验证：工商银行遭下调评级，持仓账面转亏',
  mentorLine: '视觉验证用事件：账面浮亏不等于真的亏 —— 卖出那一刻才结算。',
  conceptKeys: [],
})
b.advanceDay()
const s = b.runtimeState()
return {
  label: '05_after_advance',
  dayIndex: s.dayIndex,
  inGameDate: s.inGameDate,
  NAV: s.NAV,
  cash: s.cash,
  positions: s.positions,
  unrealizedPnL: s.unrealizedPnL,
  dayReturnPct: s.dayReturnPct,
  navHistory: s.navHistory,
  before: {
    NAV: before.NAV,
    unrealizedPnL: before.unrealizedPnL,
    positions: before.positions,
  },
}
