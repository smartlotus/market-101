const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(3);
b.selectInstrument('510300');
b.chapterRead('panel.compare', 2);
return 'at 3.2';
