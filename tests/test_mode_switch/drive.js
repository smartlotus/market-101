/**
 * test_mode_switch —— §3.2 三模式切换 / 自由窗口不计评级 / 回到主线的承接语。
 *
 * 切换一律走宿主对外方法 `setMode()` —— TopBar 的模式菜单回调就是它。
 */
const b = sceneTree.nodes.get('broker');
const R = {};
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const q = (sel) => document.querySelector(sel);
const reqDone = (s, id) => ((s.beatRequirements || []).find((r) => r.id === id) || {}).satisfied === true;

function dispatch(r, beat, s) {
  if (r.kind === 'interact' || r.kind === 'advanceDay') return b.chapterAck(r.id);
  if (r.kind === 'read') {
    if (s.panelId !== r.panelId) b.chapterOpenPanel(r.panelId);
    b.chapterRead(r.panelId, Number(r.count || 1));
    if (r.mustClose) b.chapterClosePanel(r.panelId);
    return { ok: true };
  }
  if (r.kind === 'select') return b.selectInstrument(b.sim.selectCheapestAffordable());
  if (r.kind === 'choice') {
    let pc = C().pendingChoice;
    if (!pc) { const p = (beat.panels || [])[0]; if (p) b.chapterOpenPanel(p); }
    return { ok: false, reason: 'choice_ui_unreachable' };
  }
  if (r.kind === 'submit') {
    const ex = r.expect || {};
    const st = S();
    if (ex.side === 'sell') {
      const pos = (st.positions || []).find((p) => p.qty - (p.lockedQty || 0) >= 100) || (st.positions || [])[0];
      return b.submitOrder({ side: 'sell', instrumentId: pos ? pos.instrumentId : st.selectedInstrumentId, type: 'market', qty: pos ? Math.min(pos.qty, 100) : 100 });
    }
    if (ex.reasonCode === 'REJECT_1') return b.submitOrder({ side: 'buy', instrumentId: '600519', type: 'limit', qty: 100, price: px('600519') });
    if (ex.reasonCode === 'REJECT_2') return b.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', qty: 100, price: Number(st.quotes['601398'].limitUp) + 0.01 });
    if (ex.reasonCode === 'REJECT_4') {
      if (!(st.positions || []).some((p) => p.qty >= 100)) {
        b.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', qty: 100, price: px('601398') });
      }
      return b.submitOrder({ side: 'sell', instrumentId: '601398', type: 'limit', qty: 100, price: px('601398') });
    }
    if (ex.reasonCode === 'REJECT_3') {
      let g = 0;
      while (S().isMarketOpen && g < 12) { b.advanceDay(); g += 1; }
      return b.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', qty: 100, price: px('601398') });
    }
    const id = st.selectedInstrumentId;
    return b.submitOrder({ side: 'buy', instrumentId: id, type: ex.type === 'market' ? 'market' : 'limit', qty: 100, price: ex.type === 'market' ? null : px(id) });
  }
  return { ok: false, reason: 'unknown:' + r.kind };
}
function walkTo(chapterId, beatId) {
  let g = 0;
  while (Number(C().chapterId) === chapterId && C().beatId !== beatId && g < 300) {
    g += 1;
    const s = C();
    const todo = ((s.beat || {}).require || []).filter((r) => !reqDone(s, r.id));
    if (!todo.length) break;
    if (todo[0].kind === 'choice') { b.chapterAnswer(todo[0].choiceId, 'restrict'); continue; }
    dispatch(todo[0], s.beat || {}, C());
  }
  return { chapterId: C().chapterId, beatId: C().beatId, steps: g };
}
function resetAll() { b.reset(); b.resetChapterProgress(); b.refresh(); }
function toCh2() { resetAll(); walkTo(1, '1.9'); b.chapterAnswer('1.9.confirm', 't1'); b.chapterConfirm(); return { chapterId: C().chapterId, beatId: C().beatId }; }
function bindRuleCards() { b.chapterOpenPanel('panel.ruleCards'); b.chapterRead('panel.ruleCards', 4); b.chapterClosePanel('panel.ruleCards'); }

const domState = () => ({
  goalCardVisible: (() => { const e = q('#chapter-root .ch-goal'); return e ? !e.classList.contains('ch-hidden') && getComputedStyle(e).display !== 'none' : null; })(),
  goalCardText: (() => { const e = q('#chapter-root .ch-goal'); return e ? e.innerText : null; })(),
  freeWinVisible: (() => { const e = q('#chapter-root .ch-freewin'); return e ? !e.classList.contains('ch-hidden') && getComputedStyle(e).display !== 'none' : null; })(),
  freeWinText: (() => { const e = q('#chapter-root .ch-freewin'); return e ? e.innerText : null; })(),
  dialogueVisible: (() => { const e = q('#chapter-root .ch-dialogue'); return e ? !e.classList.contains('ch-hidden') && getComputedStyle(e).display !== 'none' : null; })(),
  dialogueText: (() => { const e = q('#chapter-root .ch-dialogue'); return e ? e.innerText : null; })(),
  lineText: (() => { const e = q('#chapter-root .ch-line'); return e ? e.innerText : null; })(),
  speakerText: (() => { const e = q('#chapter-root .ch-speaker'); return e ? e.innerText : null; })(),
  choiceBoxVisible: (() => { const e = q('#chapter-root .ch-choicebox'); return e ? !e.classList.contains('ch-hidden') : null; })(),
  chapterRootText: (() => { const e = q('#chapter-root'); return e ? e.innerText : null; })(),
});

// ══ 1. 三模式切换：chapter → freeDay → sandbox → chapter ═══════════════════
R.triSwitch = (() => {
  toCh2();
  const order = [];
  const snap = (tag) => order.push({
    tag, mode: C().mode, beatId: C().beatId, chapterId: C().chapterId,
    goalCardVisible: (() => { const e = q('#chapter-root .ch-goal'); return e ? !e.classList.contains('ch-hidden') : null; })(),
    freeWinVisible: (() => { const e = q('#chapter-root .ch-freewin'); return e ? !e.classList.contains('ch-hidden') : null; })(),
    mentorLine: C().mentor.line, mentorSpeaker: C().mentor.speaker,
    dialogueText: (() => { const e = q('#chapter-root .ch-dialogue'); return e ? e.innerText : null; })(),
    lineText: (() => { const e = q('#chapter-root .ch-line'); return e ? e.innerText : null; })(),
    freeWinText: (() => { const e = q('#chapter-root .ch-freewin'); return e ? e.innerText : null; })(),
    goalText: (() => { const e = q('#chapter-root .ch-goal'); return e ? e.innerText : null; })(),
  });
  snap('chapter');
  b.setMode('freeDay'); snap('freeDay');
  b.setMode('sandbox'); snap('sandbox');
  b.setMode('chapter'); snap('backToChapter');
  const domAfter = domState();
  return { order, domAfter };
})();

// ══ 2. freeDay：不推进章、可连续推进多日、常驻卡显示下一章 ══════════════════
R.freeDay = (() => {
  toCh2();
  b.setMode('freeDay');
  const start = { beatId: C().beatId, chapterId: C().chapterId, completedBeats: C().completedBeats.slice(), dayIndex: S().dayIndex, date: S().inGameDate };
  const days = [];
  for (let i = 0; i < 5; i += 1) {
    b.advanceDay();
    days.push({ dayIndex: S().dayIndex, date: S().inGameDate, beatId: C().beatId, chapterId: C().chapterId });
  }
  return {
    start, days,
    after: { beatId: C().beatId, chapterId: C().chapterId, completedBeats: C().completedBeats.slice(), mode: C().mode },
    dom: domState(),
  };
})();

// ══ 3. sandbox：无目标卡 / 无引导 ═══════════════════════════════════════════
R.sandbox = (() => {
  toCh2();
  b.setMode('sandbox');
  const dom = domState();
  const beats = [];
  for (let i = 0; i < 3; i += 1) { b.advanceDay(); beats.push(C().beatId); }
  return {
    dom,
    mode: C().mode,
    beatIdUnchanged: beats.every((x) => x === beats[0]),
    beats,
    goalCard: C().goalCard,
    mentorLine: C().mentor.line,
    hasChoice: Boolean(C().pendingChoice),
  };
})();

// ══ 4. freeDay 的盈亏不进评级窗口；excludedPnl 记账 ═════════════════════════
R.excludedPnl = (() => {
  toCh2();
  const wIn = b.chapter.ratingWindowInputs;
  const navBefore = S().NAV;
  b.setMode('freeDay');
  // 在自由窗口里买卖各一次（真实成交）
  const o1 = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  let g = 0;
  while (!S().isMarketOpen && g < 12) { b.advanceDay(); g += 1; }
  const o2 = b.submitOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  const navAfterWindow = S().NAV;
  const wOut = b.chapter.ratingWindowInputs;
  b.setMode('chapter');
  const wBack = b.chapter.ratingWindowInputs;
  return {
    insideWindow: { fees: wIn.feesInWindow, notional: wIn.notionalInWindow, cumInjection: wIn.externalInjectionInWindow },
    orders: [
      { side: 'buy', reasonCode: o1.reasonCode, status: o1.status },
      { side: 'sell', reasonCode: o2.reasonCode, status: o2.status },
    ],
    navBefore, navAfterWindow, navDelta: Number((navAfterWindow - navBefore).toFixed(2)),
    inFreeDay: { fees: wOut.feesInWindow, notional: wOut.notionalInWindow, excludedPnl: wOut.excludedPnl },
    backInChapter: { fees: wBack.feesInWindow, notional: wBack.notionalInWindow, excludedPnl: wBack.excludedPnl },
    // 评级结果：自由窗口的盈亏不得改善 rar
    gradedAfter: b.devInjectRatingInputs({}) && { rar: C().rating.rar, S: C().rating.S },
    ratingInputs: C().ratingInputs && {
      feesInWindow: C().ratingInputs.feesInWindow,
      notionalInWindow: C().ratingInputs.notionalInWindow,
      excludedPnl: C().ratingInputs.excludedPnl,
      externalInjectionInWindow: C().ratingInputs.externalInjectionInWindow,
    },
  };
})();

// ══ 5. 回到主线的承接语 ═════════════════════════════════════════════════════
R.resumeLine = (() => {
  toCh2();
  b.setMode('freeDay');
  const inFree = { line: C().mentor.line, speaker: C().mentor.speaker };
  b.setMode('chapter');
  const back = { line: C().mentor.line, speaker: C().mentor.speaker, mode: C().mode, beatId: C().beatId };
  const domText = (() => { const e = q('#chapter-root .ch-dialogue'); return e ? e.innerText : null; })();
  // sandbox → chapter 也应给承接语
  b.setMode('sandbox');
  b.setMode('chapter');
  const fromSandbox = { line: C().mentor.line, speaker: C().mentor.speaker };
  return { inFree, back, domText, fromSandbox };
})();

// ══ 6. freeDay 中章节进度不受影响（不推进任何章）+ 章末确认后进 freeDay ══════
R.chapterEndFree = (() => {
  toCh2();
  bindRuleCards();
  b.devGotoBeat(2, '2.7');
  b.devSatisfy('2.7.advance');
  b.devSatisfy('2.7.eventCard');
  b.chapterEndPhase();
  while (C().extraSegment) b.chapterCompleteExtra();
  const pc = C().pendingChoice;
  if (pc) b.chapterAnswer(pc.id, pc.correctKey || (pc.options[0] && pc.options[0].key));
  const conf = b.chapterConfirm();
  return {
    confirm: conf,
    mode: C().mode,
    chapterId: C().chapterId,
    nextChapter: C().nextChapter,
    dom: domState(),
  };
})();

return R;
