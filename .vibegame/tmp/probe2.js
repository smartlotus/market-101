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
const beatNow = rt.beat ? rt.beat.id : null;
const fake = { accepted: true, status: 'filled', side: 'buy', instrumentId: '110020', fee: 0, notional: 0 };
const m = rt._matchesSubmit(rt.beat.require[0].expect, fake);
const before = JSON.stringify(C().beatRequirements);
const res = rt.onOrderResult(fake, { side: 'buy', type: 'limit' });
const after = JSON.stringify(C().beatRequirements);
return JSON.stringify({
  beat: beatNow,
  expect: rt.beat.require[0].expect,
  matches: m,
  onOrderResult: res,
  before, after,
  reqRaw: rt._req,
  beatIdAfter: C().beatId,
}, null, 1);
