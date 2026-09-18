const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(5);
b.openDictionary();
const btn = document.querySelector('[data-role="concept-dictionary"] button.entry[data-concept-key="汇率"]');
if (btn) btn.click();
await new Promise((r) => setTimeout(r, 2500));
const root = document.querySelector('[data-role="concept-dictionary"]');
const d = Array.from(root.querySelectorAll('img.ch-badge'));
return JSON.stringify({
  count: d.length,
  loaded: d.filter((i) => i.complete && i.naturalWidth > 0).length,
  failed: d.filter((i) => i.complete && i.naturalWidth === 0).length,
  sample: d.slice(0, 4).map((i) => i.className + ' ' + (i.getAttribute('src')||'').split('/').pop()
    + ' natural=' + i.naturalWidth),
}, null, 1);
