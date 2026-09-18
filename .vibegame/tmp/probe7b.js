const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(7);
b.chapterAnswer('7.2.baseline', '1000');
const c = b.runtimeState().chapter;
return JSON.stringify({
  chapterHasBaseline: 'baselineAmount' in c,
  baselineAmount: c.baselineAmount,
  chapterMaxDrawdown: c.chapterMaxDrawdown,
}, null, 1);
