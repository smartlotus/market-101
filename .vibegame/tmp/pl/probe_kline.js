const b = sceneTree.nodes.get('broker');
const S=()=>b.runtimeState(); const C=()=>S().chapter;
const q=(s)=>document.querySelector(s);
const chart = () => ({
  klinesCount: S().quotes['601398'].klinesCount,
  candles: document.querySelectorAll('#broker-shell .chart .bar, #broker-shell .chart svg rect, #broker-shell .chart *').length,
  chartChildren: (() => { const e=q('#broker-shell .chart'); return e ? e.children.length : null; })(),
  emptyDisplay: (() => { const e=q('#broker-shell .chart-empty') || q('#broker-shell .chart .empty'); return e ? getComputedStyle(e).display : null; })(),
  emptyText: (() => { const e=q('#broker-shell .chart-empty') || q('#broker-shell .chart .empty'); return e ? e.innerText : null; })(),
  chartHTML: (() => { const e=q('#broker-shell .chart'); return e ? e.innerHTML.slice(0,300) : null; })(),
});
const out = {};
try { localStorage.removeItem('market-101.save.v1'); } catch(e){}
b.reset(); b.resetChapterProgress(); b.refresh();
const reqDone=(s,id)=>((s.beatRequirements||[]).find(r=>r.id===id)||{}).satisfied===true;
b.chapterAck('1.0.start'); b.chapterAck('1.1.openDeposit'); b.chapterRead('panel.deposit',2); b.chapterClosePanel('panel.deposit');
b.chapterAck('1.2.openAccount'); b.chapterAck('1.3.fundInitial');
b.selectInstrument('601398');
out.before = chart();
b.chapter.save();
out.tag = 'saved at 1.4';
return out;
