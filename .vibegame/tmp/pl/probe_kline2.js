const b = sceneTree.nodes.get('broker');
const S=()=>b.runtimeState();
const q=(s)=>document.querySelector(s);
return {
  klinesCount: S().quotes['601398'].klinesCount,
  beatId: S().chapter.beatId,
  chartChildren: (() => { const e=q('#broker-shell .chart'); return e ? e.children.length : null; })(),
  emptyDisplay: (() => { const e=q('#broker-shell .chart-empty') || q('#broker-shell .chart .empty'); return e ? getComputedStyle(e).display : null; })(),
  emptyText: (() => { const e=q('#broker-shell .chart-empty') || q('#broker-shell .chart .empty'); return e ? e.innerText : null; })(),
  chartHTML: (() => { const e=q('#broker-shell .chart'); return e ? e.innerHTML.slice(0,300) : null; })(),
};
