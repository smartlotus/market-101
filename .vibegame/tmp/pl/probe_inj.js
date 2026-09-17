const b = sceneTree.nodes.get('broker');
const S=()=>b.runtimeState(); const C=()=>S().chapter;
const px=(id)=>Number(S().quotes[id].lastPrice);
const out={};
function toCh2(){ b.reset(); b.resetChapterProgress(); b.refresh();
  const reqDone=(s,id)=>((s.beatRequirements||[]).find(r=>r.id===id)||{}).satisfied===true;
  let g=0; while(Number(C().chapterId)===1 && C().beatId!=='1.9' && g<300){ g++;
    const s=C(); const beat=s.beat||{}; const todo=(beat.require||[]).filter(r=>!reqDone(s,r.id));
    if(!todo.length) break; const r=todo[0];
    if(r.kind==='interact'||r.kind==='advanceDay') b.chapterAck(r.id);
    else if(r.kind==='read'){ if(s.panelId!==r.panelId) b.chapterOpenPanel(r.panelId); b.chapterRead(r.panelId,Number(r.count||1)); if(r.mustClose) b.chapterClosePanel(r.panelId); }
    else if(r.kind==='select') b.selectInstrument(b.sim.selectCheapestAffordable());
    else if(r.kind==='choice'){ let pc=C().pendingChoice; if(!pc){const p=(beat.panels||[])[0]; if(p) b.chapterOpenPanel(p); pc=C().pendingChoice;} if(pc) b.chapterAnswer(pc.id, pc.correctKey||pc.options[0].key); }
    else if(r.kind==='submit'){ const ex=r.expect||{}; const st=S();
      if(ex.side==='sell'){ const pos=(st.positions||[])[0]; b.submitOrder({side:'sell',instrumentId:pos?pos.instrumentId:st.selectedInstrumentId,type:'market',qty:100}); }
      else b.submitOrder({side:'buy',instrumentId:st.selectedInstrumentId,type:ex.type==='market'?'market':'limit',qty:100,price:ex.type==='market'?null:px(st.selectedInstrumentId)}); }
  }
  b.chapterAnswer('1.9.confirm','t1'); b.chapterConfirm();
}
toCh2();
out.afterEnter = { mode:C().mode, win: b.chapter.ratingWindow ? {open:b.chapter.ratingWindow.open, cum:b.chapter.ratingWindow.cumInjection} : null };
b.devGotoBeat(2,'2.6');
out.afterGoto = { mode:C().mode, win: b.chapter.ratingWindow ? {open:b.chapter.ratingWindow.open, cum:b.chapter.ratingWindow.cumInjection} : null };
b.submitOrder({side:'buy',type:'limit',instrumentId:'601398',price:px('601398'),qty:100});
out.afterBuy={NAV:S().NAV};
b.devInjectRatingInputs({});
out.afterSettle={ri:C().ratingInputs, win:{open:b.chapter.ratingWindow.open,cum:b.chapter.ratingWindow.cumInjection}};
const r=b.topUpCapital();
out.topUp={r, cum:b.chapter.ratingWindow.cumInjection};
b.devInjectRatingInputs({});
out.afterTopUpSettle={ri:C().ratingInputs, cum:b.chapter.ratingWindow.cumInjection};
return out;
