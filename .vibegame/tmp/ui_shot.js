const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devSkipToSandbox ? b.devSkipToSandbox() : b.devGotoChapter(1);
return JSON.stringify({ mode: b.runtimeState().chapter.mode, ch: b.runtimeState().chapter.chapterId });
