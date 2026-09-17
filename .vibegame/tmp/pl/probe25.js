const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState(); const C = () => S().chapter;
const q = (s) => document.querySelector(s);
const dump = (tag) => ({
  tag, beatId: C().beatId, panelId: C().panelId,
  reqs: C().beatRequirements.map(r => r.kind+':'+r.id+'='+r.satisfied),
  pendingChoice: C().pendingChoice ? C().pendingChoice.id : null,
  mentorLine: C().mentor.line,
  chapterRootText: (q('#chapter-root')||{}).innerText,
  chapterBtns: Array.from(document.querySelectorAll('#chapter-root button')).map(e=>({t:(e.innerText||'').trim().slice(0,40), cls:e.className, dc:e.dataset.choiceId||null})),
  openPanels: Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map(e=>e.id),
  panelBtns: Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open button')).map(e=>({t:(e.innerText||'').trim().slice(0,40), cls:e.className, dc:e.dataset.choiceId||null})),
});
const out = [];
try { localStorage.removeItem('market-101.save.v1'); } catch(e) {}
b.chapterAck('1.0.start'); b.chapterAck('1.1.openDeposit'); b.chapterRead('panel.deposit',2); b.chapterClosePanel('panel.deposit');
b.chapterAck('1.2.openAccount'); b.chapterAck('1.3.fundInitial');
b.chapterSelect('601398', {player:true});
b.submitOrder({side:'buy',type:'limit',instrumentId:'601398',price:Number(S().quotes['601398'].lastPrice),qty:100});
b.chapterRead('panel.conceptCards',3); b.chapterClosePanel('panel.conceptCards');
b.advanceDay();
b.submitOrder({side:'sell',type:'limit',instrumentId:'601398',price:Number(S().quotes['601398'].lastPrice),qty:100});
b.chapterRead('panel.review',5); b.chapterClosePanel('panel.review');
b.chapterAnswer('1.9.confirm','t1'); b.chapterConfirm();
// ch2
const px = (id) => Number(S().quotes[id].lastPrice);
const o = (s) => b.submitOrder(s);
o({side:'buy',type:'limit',instrumentId:'600519',price:px('600519'),qty:100});
o({side:'buy',type:'limit',instrumentId:'601398',price:Number(S().quotes['601398'].limitUp)+0.01,qty:100});
o({side:'buy',type:'limit',instrumentId:'601398',price:px('601398'),qty:100});
o({side:'sell',type:'limit',instrumentId:'601398',price:px('601398'),qty:100});
let g=0; while(S().isMarketOpen && g<12){b.advanceDay();g++;}
o({side:'buy',type:'limit',instrumentId:'601398',price:px('601398'),qty:100});
out.push(dump('2.5 entered'));
b.chapterRead('panel.ruleCards',4);
out.push(dump('after read4'));
b.chapterClosePanel('panel.ruleCards');
out.push(dump('after close'));
// try opening other panels that may host the choice
const tries = ['panel.confirm','panel.settlement','panel.conceptCards','panel.review','panel.extraSegment','panel.deposit','panel.eventCard'];
for (const p of tries) { let r=null; try{ r=b.chapterOpenPanel(p);}catch(e){r='ERR '+e;} out.push({tag:'openPanel '+p, panelId:C().panelId, pc:C().pendingChoice?C().pendingChoice.id:null, spec: r? Object.keys(r):null}); b.chapterClosePanel(p); }
out.push(dump('final'));
return out;
