const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(3);
b.selectInstrument('510300');
b.chapterRead('panel.compare', 6); b.chapterClosePanel('panel.compare');
b.chapterRead('panel.prospectus', 9); b.chapterClosePanel('panel.prospectus');
b.chapterAnswer('3.2.pick', 'priceKnown');

const rt = b.chapter;
const r0 = rt.beat.require[0];
const merged = { accepted: true, status: 'filled', side: 'buy', type: 'limit', instrumentId: '110020', fee: 0, notional: 0 };
const out = {
  beatId: rt.beat.id,
  kind: r0.kind,
  satisfied: rt._satisfied(r0),
  matches: rt._matchesSubmit(r0.expect, merged),
  extraSegment: rt.extraSegment ? String(rt.extraSegment.origin || 'yes') : null,
  hasBeat: !!rt.beat,
  isArr: Array.isArray(rt.beat.require),
  reqLen: rt.beat.require.length,
  runtimeHasOnOrder: typeof b.chapter.onOrderResult,
};
// 再手工执行一次判定循环
const marked = [];
for (const r of rt.beat.require) {
  if (r.kind !== 'submit' || rt._satisfied(r)) { out['skip_' + r.id] = 'kindOrSatisfied'; continue; }
  if (!rt._matchesSubmit(r.expect, merged)) { out['skip_' + r.id] = 'noMatch'; continue; }
  rt._mark(r.id);
  marked.push(r.id);
  break;
}
out.markedByHand = marked;
out.beatAfterHand = C().beatId;
out.snapAfterHand = C().beatRequirements;
return JSON.stringify(out, null, 1);
