const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const nx = document.querySelector('#chapter-root .ch-next');
const rail = document.querySelector('#chapter-root .ch-resident');
const card = document.querySelector('#chapter-root .ch-card');
const r = (e) => { if (!e) return null; const x = e.getBoundingClientRect();
  return [Math.round(x.left), Math.round(x.top), Math.round(x.right), Math.round(x.bottom)]; };
// 顶部被裁的东西到底是什么
const topEls = Array.from(document.querySelectorAll('#chapter-root *')).filter((e) => {
  const x = e.getBoundingClientRect();
  return x.height > 0 && x.top < 84 && x.left < 340;
}).map((e) => (e.className || e.tagName) + '@' + r(e));
return JSON.stringify({
  beat: C().beatId,
  nextExists: !!nx,
  nextHidden: nx ? nx.classList.contains('ch-hidden') : null,
  nextText: nx ? nx.textContent.trim().slice(0, 120) : null,
  nextRect: r(nx),
  railRect: r(rail),
  cardRect: r(card),
  topEls: topEls.slice(0, 8),
}, null, 1);
