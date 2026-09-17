const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const q = (sel) => document.querySelector(sel);
const reqDone = (s, id) => ((s.beatRequirements || []).find((r) => r.id === id) || {}).satisfied === true;
function dispatch(r, beat, s) {
  if (r.kind === 'interact' || r.kind === 'advanceDay') return b.chapterAck(r.id);
  if (r.kind === 'read') {
    if (s.panelId !== r.panelId) b.chapterOpenPanel(r.panelId);
    b.chapterRead(r.panelId, Number(r.count || 1));
    if (r.mustClose) b.chapterClosePanel(r.panelId);
    return { ok: true };
  }
  if (r.kind === 'select') return b.selectInstrument(r.instrumentId || b.sim.selectCheapestAffordable());
  if (r.kind === 'choice') {
    let pc = C().pendingChoice;
    if (!pc) { const p = (beat.panels || [])[0]; if (p) b.chapterOpenPanel(p); pc = C().pendingChoice; }
    if (!pc) return { ok: false, reason: 'no_choice' };
    return b.chapterAnswer(pc.id, pc.correctKey || (pc.options[0] && pc.options[0].key));
  }
  if (r.kind === 'submit') {
    const expect = r.expect || {};
    const st = S();
    if (expect.side === 'sell') {
      const pos = (st.positions || []).find((p) => p.qty - (p.lockedQty || 0) >= 100) || (st.positions || [])[0];
      return b.submitOrder({ side: 'sell', instrumentId: pos ? pos.instrumentId : st.selectedInstrumentId, type: 'market', qty: pos ? Math.min(pos.qty, 100) : 100 });
    }
    const type = expect.type === 'market' ? 'market' : 'limit';
    const id = st.selectedInstrumentId;
    const spec = { side: 'buy', instrumentId: id, type, qty: 100, price: null };
    if (type === 'limit') spec.price = px(id);
    return b.submitOrder(spec);
  }
  return { ok: false, reason: 'unknown:' + r.kind };
}
function walkTo(chapterId, beatId) {
  let guard = 0;
  while (Number(C().chapterId) === chapterId && C().beatId !== beatId && guard < 300) {
    guard += 1;
    const s = C();
    if (s.chapterEndReached) { b.chapterConfirm(); continue; }
    const beat = s.beat || {};
    const todo = (beat.require || []).filter((r) => !reqDone(s, r.id));
    if (!todo.length) break;
    dispatch(todo[0], beat, s);
  }
  return { chapterId: C().chapterId, beatId: C().beatId, steps: guard };
}
function toCh2() {
  b.reset(); b.resetChapterProgress(); b.refresh();
  walkTo(1, '1.9');
  b.chapterAnswer('1.9.confirm', 't1');
  b.chapterConfirm();
  return { chapterId: C().chapterId, beatId: C().beatId };
}
const R = {};
R.enter = toCh2();
R.atEntry = { NAV: S().NAV, cash: S().cash, mode: C().mode, ci: (C().ratingInputs || {}), beatId: C().beatId, remaining: C().remainingBeats };
// 探针：不切模式（chapter），注入 navSeries 以 100000 结尾
const realNav = S().NAV;
const rar = (80 - 50) / 833;
const navStart = realNav / (1 + rar);
R.chapterModeInject = (() => {
  b.devInjectRatingInputs({ navSeries: [navStart, realNav], fees: 0, notional: 0 });
  const c = C();
  return { rating: c.rating, ri: c.ratingInputs && { baseScore: c.ratingInputs.baseScore, ddPenalty: c.ratingInputs.ddPenalty, costPenalty: c.ratingInputs.costPenalty, costPenaltyHalf: c.ratingInputs.costPenaltyHalf, navStart: c.ratingInputs.navStart, navNow: c.ratingInputs.navNow, adj: c.ratingInputs.adjustedNavSeries }, extra: c.extraSegment && c.extraSegment.kind };
})();
// 探针：freeDay 模式
R.freeDayInject = (() => {
  const st = toCh2();
  b.setMode('freeDay');
  b.devInjectRatingInputs({ navSeries: [navStart, realNav], fees: 0, notional: 0 });
  const c = C();
  return { st, mode: c.mode, rating: c.rating, ri: c.ratingInputs && { baseScore: c.ratingInputs.baseScore, costPenaltyHalf: c.ratingInputs.costPenaltyHalf, adj: c.ratingInputs.adjustedNavSeries }, extra: c.extraSegment && c.extraSegment.kind };
})();
return R;
