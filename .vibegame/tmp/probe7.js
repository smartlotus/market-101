const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(7);
const rt = b.chapter;
const snap0 = b.runtimeState();
const r = b.chapterAnswer('7.2.baseline', '1000');
return JSON.stringify({
  hasBaselineChoiceId: rt.chapter ? rt.chapter.baselineChoiceId : 'no-chapter',
  answerResult: r,
  answeredChoices: rt.answeredChoices,
  snapBaseline: snap0.baselineAmount,
  snapAfter: b.runtimeState().baselineAmount,
  snapKeysHasBaseline: 'baselineAmount' in snap0,
}, null, 1);
