/* 第三章端到端驱动：3.1 → 3.7。走 Runtime API（与 DOM 点击同一条回调路径）。 */
const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const out = [];
const step = (name) => out.push([name, {
  beat: C().beatId,
  mode: C().mode,
  req: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  panel: C().openPanelId || null,
}]);

// 清存档与章状态 → 直接进第三章。
// 注意：`devGotoChapter` 在「已经在目标章」时**不重入**，上一轮 eval 留下的
// 红线补救段会跨轮残留并把所有 submit 标记挂起 —— 所以必须先显式清章状态。
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress();
b.sim.reset();
b.sim.openAccount();
b.sim.fundInitial();
b.sim.beginFirstDay();
b.devGotoChapter(3);
step('goto3');

const reqs = () => C().beatRequirements || [];
const need = (id) => {
  const r = reqs().find((x) => x.id === id);
  return r && r.satisfied;
};
const closeIfOpen = (pid) => { if (C().openPanelId === pid) b.chapterClosePanel(pid); };

// ── 3.1 选中 510300 ────────────────────────────────────────────
b.selectInstrument('510300');
step('3.1');

// ── 3.2 读对照表 + 读说明书 + 选择 ────────────────────────────
b.chapterRead('panel.compare', 6);
b.chapterRead('panel.prospectus', 9);
b.chapterClosePanel('panel.compare');
b.chapterClosePanel('panel.prospectus');
step('3.2.read');
b.chapterAnswer('3.2.pick', 'priceKnown');
step('3.2.choice');

// ── 3.3 申购场外基金 ──────────────────────────────────────────
{
  const nav = S().quotes['110020'].lastPrice;
  b.selectInstrument('110020');
  const r = b.submitOrder({ side: 'buy', instrumentId: '110020', type: 'limit', price: nav, qty: 200 });
  out.push(['3.3.submit', { accepted: r.accepted, reasonCode: r.reasonCode, fillPrice: r.fillPrice, qty: r.qty }]);
}
step('3.3');

// ── 3.4 读时间线 + 推进两天 ───────────────────────────────────
b.chapterRead('panel.holdingPeriod', 5);
b.chapterClosePanel('panel.holdingPeriod');
b.chapterAck('3.4.advance1');
b.chapterAck('3.4.advance2');
step('3.4');

// ── 3.5 买 ETF ────────────────────────────────────────────────
{
  const px = S().quotes['510300'].lastPrice;
  b.selectInstrument('510300');
  const r = b.submitOrder({ side: 'buy', instrumentId: '510300', type: 'limit', price: px, qty: 500 });
  out.push(['3.5.submit', { accepted: r.accepted, reasonCode: r.reasonCode, fillPrice: r.fillPrice, fee: r.fee }]);
}
step('3.5');

// ── 3.6 读点评（选择项可选，不答）──────────────────────────────
b.chapterRead('panel.whyNotHold', 2);
b.chapterClosePanel('panel.whyNotHold');
step('3.6');

// ── 3.7 拼理由 + 最后一问 ─────────────────────────────────────
out.push(['3.7.flowWalk', C().flowProgress || null]);
// 先故意错序一次，证明不惩罚
b.chapterFlowStep('reason', 'p3');
out.push(['3.7.wrongStep', { flow: C().flowProgress || null, beat: C().beatId }]);
for (const id of ['p2', 'p1', 'p3', 'p4']) b.chapterFlowStep('reason', id);
step('3.7.walk');
b.chapterAnswer('3.end', 'knowWhy');
step('3.7.choice');

// ── 章末结算 ──────────────────────────────────────────────────
out.push(['chapterEndPhase', (() => { try { return b.chapterEndPhase(); } catch (e) { return String(e); } })()]);
step('endPhase');

const st = S();
out.push(['final', {
  chapterId: C().chapterId,
  beat: C().beatId,
  completed: C().completedBeats,
  rating: C().rating ? C().rating.grade : null,
  cash: st.cash,
  NAV: st.NAV,
  positions: st.positions.map((p) => p.instrumentId + ':' + p.qty + '@' + p.currency),
  fx: st.fx.rates,
  unlocked: st.unlockedMarkets,
}]);
return JSON.stringify(out, null, 1);
