const b = sceneTree.nodes.get('broker');
const out = {};
b.reset();
out.afterReset = b.sim.klinesFor('601398').length;
b.setMode('chapter'); // 模式切换内部会 runtime.save()
out.modeAfter = b.runtimeState().chapter.mode;
const doc = b.saveStore.read();
const states = doc ? doc.world.quotes.states : null;
out.savedCounts = states ? Object.values(states).map((s) => (s.klines || []).length) : null;
out.savedLastBar = states ? states['601398'].klines.slice(-1)[0] : null;
// 「刷新」= 用存档重建世界
b.sim.loadFrom(doc.world);
out.afterReloadCounts = Object.values(b.runtimeState().quotes).map((q) => q.klinesCount);
out.drawableBars = b.sim.klinesFor('601398').length;
out.reloadLastBar = b.sim.klinesFor('601398').slice(-1)[0] || null;
return out;
