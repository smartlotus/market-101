const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(3);
const d = document.querySelector('#chapter-root .ch-draw');
return JSON.stringify({ scene: b.runtimeState().chapter.sceneId, cls: d ? d.className : null,
  blocks: d ? Array.from(d.children).map((c) => c.className).slice(0, 9) : [] }, null, 1);
