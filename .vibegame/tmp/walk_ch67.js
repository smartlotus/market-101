/* 第六、七章端到端驱动。 */
const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const out = [];
const step = (name) => out.push([name, {
  beat: C().beatId,
  req: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
}]);

function enter(chapterId) {
  try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
  b.resetChapterProgress();
  b.sim.reset();
  b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
  b.devGotoChapter(chapterId);
}

// ══════════════ 第六章 ══════════════
enter(6);
step('c6.go');
b.chapterRead('panel.timezone', 5); b.chapterClosePanel('panel.timezone');
b.chapterAnswer('6.1.session', 'beijingNight');
step('6.1');

b.selectInstrument('AAPL');
{
  const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: 'AAPL',
                            price: S().quotes['AAPL'].lastPrice, qty: 0.5 });
  out.push(['6.2.buy', { qty: 0.5, ok: r.accepted, code: r.reasonCode, fillPrice: r.fillPrice }]);
}
step('6.2');

b.chapterRead('panel.feeCompare', 5); b.chapterClosePanel('panel.feeCompare');
b.chapterAnswer('6.3.fee', 'structure');
step('6.3');

b.chapterAck('6.4.advance');
out.push(['6.4.day', { date: b.sim.calendar.inGameDate, ev: S().currentEvent ? S().currentEvent.id : null }]);
b.chapterRead('panel.circuitBreaker', 3); b.chapterClosePanel('panel.circuitBreaker');
step('6.4');

b.chapterAck('6.5.sleep');
out.push(['6.5.day', { date: b.sim.calendar.inGameDate, ev: S().currentEvent ? S().currentEvent.id : null }]);
b.chapterRead('panel.nightTimeline', 4); b.chapterClosePanel('panel.nightTimeline');
step('6.5');

b.chapterAnswer('6.6.sleep', 'uncomfortable');
step('6.6');
b.chapterAnswer('6.end', 'awake');
step('6.7');
out.push(['c6.final', {
  beat: C().beatId, completed: C().completedBeats, end: C().chapterEndReached,
  rating: C().rating ? { S: C().rating.S, grade: C().rating.grade } : null,
}]);

// ══════════════ 第七章 ══════════════
enter(7);
step('c7.go');
b.chapterAck('7.1.advance');
// 额外推进到周末（直接推世界，不标记完成条件）
for (let i = 0; i < 6 && b.sim.calendar.isMarketOpen; i += 1) b.devAdvanceDay();
out.push(['7.1.day', {
  date: b.sim.calendar.inGameDate, weekday: b.sim.calendar.weekdayLabel,
  cnOpen: b.sim.calendar.isOpenFor('A_SHARE'), cryptoOpen: b.sim.calendar.isOpenFor('CRYPTO'),
}]);
b.chapterRead('panel.weekend', 4); b.chapterClosePanel('panel.weekend');
step('7.1');

b.chapterAnswer('7.2.baseline', '1000');
out.push(['7.2.baseline', { logged: S().baselineAmount }]);
step('7.2');

b.chapterRead('panel.volatility', 4); b.chapterClosePanel('panel.volatility');
b.chapterAnswer('7.3.vol', 'bigger');
step('7.3');

{
  const px = S().quotes['BTC'].lastPrice;
  b.selectInstrument('BTC');
  const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: 'BTC', price: px, qty: 0.01 });
  out.push(['7.4.buy', { ok: r.accepted, code: r.reasonCode, fee: r.fee, notional: r.notional }]);
}
step('7.4');

b.chapterAck('7.5.advance');
out.push(['7.5.day', { date: b.sim.calendar.inGameDate, ev: S().currentEvent ? S().currentEvent.id : null }]);
b.chapterRead('panel.concentration', 3); b.chapterClosePanel('panel.concentration');
step('7.5');

b.chapterRead('panel.baselineCallback', 3); b.chapterClosePanel('panel.baselineCallback');
b.chapterAnswer('7.6.check', 'within');
step('7.6');
b.chapterAnswer('7.end', 'mine');
step('7.7');
out.push(['c7.final', {
  beat: C().beatId, completed: C().completedBeats, end: C().chapterEndReached,
  baseline: S().baselineAmount, maxDD: C().chapterMaxDrawdown,
  rating: C().rating ? { S: C().rating.S, grade: C().rating.grade } : null,
}]);

return JSON.stringify(out, null, 1);
