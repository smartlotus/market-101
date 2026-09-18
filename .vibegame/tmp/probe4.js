const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress();
b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(3);
b.selectInstrument('510300');
b.chapterRead('panel.compare', 6); b.chapterClosePanel('panel.compare');
b.chapterRead('panel.prospectus', 9); b.chapterClosePanel('panel.prospectus');
b.chapterAnswer('3.2.pick', 'priceKnown');
b.selectInstrument('110020');
b.submitOrder({ side: 'buy', instrumentId: '110020', type: 'limit', price: S().quotes['110020'].lastPrice, qty: 200 });
b.chapterRead('panel.holdingPeriod', 5); b.chapterClosePanel('panel.holdingPeriod');
b.chapterAck('3.4.advance1'); b.chapterAck('3.4.advance2');
b.selectInstrument('510300');
b.submitOrder({ side: 'buy', instrumentId: '510300', type: 'limit', price: S().quotes['510300'].lastPrice, qty: 500 });
b.chapterRead('panel.whyNotHold', 2); b.chapterClosePanel('panel.whyNotHold');
for (const id of ['p2', 'p1', 'p3', 'p4']) b.chapterFlowStep('reason', id);
b.chapterAnswer('3.end', 'knowWhy');

const c = C();
return JSON.stringify({
  beat: c.beatId,
  completed: c.completedBeats,
  chapterEndReached: c.chapterEndReached,
  openPanelId: c.openPanelId,
  pendingChoice: c.pendingChoice,
  mode: c.mode,
  extraSegment: c.extraSegment ? c.extraSegment.origin : null,
  rating: c.rating,
  keys: Object.keys(c),
}, null, 1);
