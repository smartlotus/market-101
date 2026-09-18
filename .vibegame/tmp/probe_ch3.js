const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(3);
b.selectInstrument('510300');                       // 3.1
b.chapterRead('panel.compare', 6); b.chapterClosePanel('panel.compare');
b.chapterRead('panel.prospectus', 9); b.chapterClosePanel('panel.prospectus');
b.chapterAnswer('3.2.pick', 'priceKnown');          // → 3.3

const nav = S().quotes['110020'].lastPrice;
b.selectInstrument('110020');
const r = b.submitOrder({ side: 'buy', instrumentId: '110020', type: 'limit', price: nav, qty: 200 });
const lo = S().lastOrder || {};
return JSON.stringify({
  beat: C().beatId,
  order: { accepted: r.accepted, instrumentId: r.instrumentId, side: r.side, type: r.type, status: r.status },
  lastOrder: { instrumentId: lo.instrumentId, accepted: lo.accepted, status: lo.status },
  reqs: C().beatRequirements,
  hasOnOrderResult: typeof b.chapter.onOrderResult,
}, null, 1);
