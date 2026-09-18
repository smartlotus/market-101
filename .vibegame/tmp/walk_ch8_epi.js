/* 第八章（期权）+ 尾声（毕业）端到端驱动。 */
const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const out = [];
const step = (name) => out.push([name, {
  beat: C().beatId,
  req: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
}]);

const toOpen = () => { let g = 0; while (!b.sim.calendar.isOpenFor('OPTION') && g < 10) { b.devAdvanceDay(); g += 1; } };

function enter(chapterId) {
  try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
  b.resetChapterProgress();
  b.sim.reset();
  b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
  b.devGotoChapter(chapterId);
}

// ══════════════ 第八章 ══════════════
enter(8);
step('c8.go');
out.push(['8.0.chain', (() => {
  const o = S().options;
  return { spot: o.underlyingSpot, series: o.series.map((s) => s.name + '/D' + s.daysLeft), n: o.series.reduce((a, s) => a + s.contracts.length, 0) };
})()]);

b.chapterRead('panel.chain', 10); b.chapterClosePanel('panel.chain');
b.chapterAnswer('8.1.atm', 'same');
step('8.1');

b.chapterRead('panel.leverage', 4); b.chapterClosePanel('panel.leverage');
step('8.2');

// 8.3 买一张虚值 CALL
toOpen();
{
  const o = S().options;
  const near = o.series[0];
  const otm = near.contracts.filter((c) => c.type === 'CALL' && c.moneyStatus === '虚值')
    .sort((a, z) => z.strike - a.strike)[0];
  const r = b.chapterBuyOption(otm.id, 1);
  out.push(['8.3.buy', { id: otm.id, K: otm.strike, prem: otm.premiumTotal, money: otm.moneyStatus,
    ok: r.accepted, code: r.reasonCode }]);
}
b.chapterAck('8.3.advance');
b.chapterRead('panel.decayWatch', 3); b.chapterClosePanel('panel.decayWatch');
out.push(['8.3.hold', S().options.positions.map((p) => p.contractId + ' D' + p.daysLeft + ' 值' + p.valueNow + ' 浮' + p.unrealizedPnL)]);
step('8.3');

// 8.4 推到近月到期（近月 D0=30）
b.chapterAck('8.4.advance');
for (let i = 0; i < 32; i += 1) b.devAdvanceDay();
b.chapterRead('panel.zero', 4); b.chapterClosePanel('panel.zero');
out.push(['8.4.settled', S().options.settled.map((s) => ({ id: s.contractId, ex: s.exercised, pnl: s.pnl })),
          'lastSettle', S().lastOptionSettlements]);
step('8.4');

b.chapterAnswer('8.5.tenLots', 'regret');
step('8.5');

// 8.6 买一张实值 CALL 并持有到到期
toOpen();
{
  const o = S().options;
  const near = o.series[0];
  const itm = near.contracts.filter((c) => c.type === 'CALL' && c.moneyStatus === '实值')
    .sort((a, z) => a.strike - z.strike)[0];
  const r = b.chapterBuyOption(itm.id, 1);
  out.push(['8.6.buy', { id: itm.id, K: itm.strike, prem: itm.premiumTotal, money: itm.moneyStatus, ok: r.accepted, code: r.reasonCode }]);
}
b.chapterAck('8.6.advance');
for (let i = 0; i < 32; i += 1) b.devAdvanceDay();
b.chapterRead('panel.exercise', 4); b.chapterClosePanel('panel.exercise');
out.push(['8.6.settled', S().options.settled.slice(-1)]);
step('8.6');

b.chapterAnswer('8.7.quiz', 'time');
step('8.7');
b.chapterAnswer('8.end', 'respect');
step('8.8');
out.push(['c8.final', { beat: C().beatId, completed: C().completedBeats, end: C().chapterEndReached,
  rating: C().rating ? { S: C().rating.S, grade: C().rating.grade } : null, NAV: S().NAV }]);

// ══════════════ 尾声 ══════════════
enter(9);
step('epi.go');
out.push(['E.0.finale', (() => { const f = C().finale || {}; return {
  finalNav: f.finalNav, capital: f.initialCapital, years: f.years,
  dormant: f.dormantValue, inflation: f.inflationValue, grades: (f.gradeRows || []).length }; })()]);

b.chapterRead('panel.certificate', 10); b.chapterClosePanel('panel.certificate');
step('E.1');
b.chapterRead('panel.flashback', 8); b.chapterClosePanel('panel.flashback');
step('E.2');
b.chapterRead('panel.handover', 3); b.chapterClosePanel('panel.handover');
step('E.3');
b.chapterRead('panel.freeMode', 4); b.chapterClosePanel('panel.freeMode');
b.chapterAnswer('E.4.open', 'free');
step('E.4');
out.push(['epi.final', { beat: C().beatId, completed: C().completedBeats, end: C().chapterEndReached,
  mode: C().mode, unlocked: S().unlockedMarkets }]);

return JSON.stringify(out, null, 1);
