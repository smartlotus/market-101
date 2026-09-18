const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(9);
b.chapterRead('panel.certificate', 10); b.chapterClosePanel('panel.certificate');
b.chapterRead('panel.flashback', 8); b.chapterClosePanel('panel.flashback');
b.chapterRead('panel.handover', 3); b.chapterClosePanel('panel.handover');
b.chapterRead('panel.freeMode', 4); b.chapterClosePanel('panel.freeMode');
b.chapterAnswer('E.4.open', 'free');
const before = { mode: C().mode, end: C().chapterEndReached };
let confirmResult = null;
try { confirmResult = b.chapterConfirm(); } catch (e) { confirmResult = String(e); }
const after = { mode: C().mode, chapterId: C().chapterId, beat: C().beatId,
  standing: C().graduationStanding, unlocked: S().unlockedMarkets };
return JSON.stringify({ before, confirmResult, after }, null, 1);
