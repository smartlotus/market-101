const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress();
b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(5);   // 第五章含「汇率」概念

// 测 1：6 个 SVG 是否都能通过 HTTP 取到（200）
const map = { 杠杆: 'leverage', 复利: 'compound', 分散投资: 'diversify',
              流动性: 'liquidity', 汇率: 'fx', 时间价值: 'timevalue' };
const reachable = Object.keys(map).map((k) => {
  const u = 'assets/concepts/badge_' + map[k] + '.svg';
  const r = new XMLHttpRequest();
  r.open('HEAD', u, false);
  try { r.send(); return k + '=' + r.status; } catch (err) { return k + '=ERR'; }
});

// 测 2：DOM 里是否真的插入了 img.ch-badge（徽章接进界面才是真接上）
const imgs = Array.from(document.querySelectorAll('img.ch-badge'));
const info = imgs.slice(0, 8).map((i) => ({
  cls: i.className,
  src: (i.getAttribute('src') || '').split('/').pop(),
  w: Math.round(i.getBoundingClientRect().width),
  loaded: i.complete && i.naturalWidth > 0,
}));

// 测 3：词典面板里点了「汇率」之后有没有徽章
const dictBtn = document.querySelector('[data-dict-toggle], .dict-toggle, .ch-dict-toggle');
let afterOpen = null;
if (dictBtn) {
  dictBtn.click();
  const el2 = document.querySelector('button.entry[data-concept-key="汇率"]');
  if (el2) {
    el2.click();
    const d = document.querySelectorAll('img.ch-badge');
    afterOpen = { count: d.length, sizes: Array.from(d).map((i) => i.className + ':' + Math.round(i.getBoundingClientRect().width)) };
  } else {
    afterOpen = '未找到汇率条目按钮';
  }
} else {
  afterOpen = '未找到词典开关';
}

return JSON.stringify({ svgReachable: reachable, imgCountNow: imgs.length, imgInfo: info, afterDictOpen: afterOpen }, null, 1);
