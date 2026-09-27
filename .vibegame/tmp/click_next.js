const b = sceneTree.nodes.get('broker');
const nxText = () => { const e = document.querySelector('#chapter-root .ch-next');
  return e ? { hidden: e.classList.contains('ch-hidden'), allDone: e.classList.contains('all-done'),
               text: e.textContent.trim().slice(0, 80) } : null; };
const before = nxText();
// 点「点开存单」
const btn = Array.from(document.querySelectorAll('#chapter-root button'))
  .find((x) => /点开存单/.test(x.textContent || ''));
if (btn) btn.click();
const afterClick = nxText();
return JSON.stringify({ beat: b.runtimeState().chapter.beatId, before, afterClick }, null, 1);
