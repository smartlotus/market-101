const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress();
b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(5);

const snap = () => {
  const root = document.querySelector('[data-role="concept-dictionary"]') || document;
  const imgs = Array.from(root.querySelectorAll('img.ch-badge'));
  return {
    count: imgs.length,
    list: imgs.slice(0, 10).map((i) => ({
      cls: i.className,
      file: (i.getAttribute('src') || '').split('/').pop(),
      w: Math.round(i.getBoundingClientRect().width),
      loaded: i.complete && i.naturalWidth > 0,
    })),
  };
};

const before = snap();
let opened = null;
try { opened = b.openDictionary(); } catch (e) { opened = 'ERR:' + e; }
const afterOpen = snap();

// 点进一个有徽章的概念（汇率）
let detail = null;
const btn = document.querySelector('[data-role="concept-dictionary"] button.entry[data-concept-key="汇率"]');
if (btn) {
  btn.click();
  const root = document.querySelector('[data-role="concept-dictionary"]');
  const d = Array.from(root.querySelectorAll('img.ch-badge'));
  detail = {
    clicked: '汇率',
    count: d.length,
    sizes: d.map((i) => i.className + ' w=' + Math.round(i.getBoundingClientRect().width)
      + (i.complete && i.naturalWidth > 0 ? ' 已加载' : ' 未加载')),
  };
} else {
  detail = '未找到汇率条目';
}

return JSON.stringify({ before, opened: opened === undefined ? 'ok' : String(opened), afterOpen, detail }, null, 1);
