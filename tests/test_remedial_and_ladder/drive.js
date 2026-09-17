/**
 * test_remedial_and_ladder —— 辅助/阶梯：红线补救段（**UI 路径**）/ D 级补救 / 补救配额 /
 * 一键补足本金 / 黄档提示 / 外来入金剔除。
 *
 * 覆盖 plan.md Verification Plan 中 test_remedial_and_ladder 的 6 行。
 * 红线一节刻意**不使用任何 `dev*` 钩子**：走宿主对外方法（与 DOM 控件回调同一条路径）
 * 与 `chapter.noteNav(...)`（runtime 的 NAV 唯一入口，宿主自己就是这么喂的），
 * 段内步进全部是**真实面板按钮点击**。
 */
const b = sceneTree.nodes.get('broker');
const R = {};
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const q = (sel) => document.querySelector(sel);
const segPanel = () => q('[data-panel-id="panel.extraSegment"]');
const segVisible = () => { const e = segPanel(); return !!e && e.style.display !== 'none' && e.classList.contains('ch-open'); };
const segBtn = (actionId) => q(`[data-panel-id="panel.extraSegment"] button[data-action-id="${actionId}"]`);
const clickSeg = (actionId) => { const x = segBtn(actionId); if (!x) return { ok: false, reason: 'no_button' }; if (x.disabled) return { ok: false, reason: 'disabled' }; x.click(); return { ok: true }; };
const reqDone = (s, id) => ((s.beatRequirements || []).find((r) => r.id === id) || {}).satisfied === true;

/** 通用节拍驱动（走宿主对外方法，与 DOM 回调同一条路径）。 */
function dispatch(r, beat, s) {
  if (r.kind === 'interact' || r.kind === 'advanceDay') return b.chapterAck(r.id);
  if (r.kind === 'read') {
    if (s.panelId !== r.panelId) b.chapterOpenPanel(r.panelId);
    b.chapterRead(r.panelId, Number(r.count || 1));
    if (r.mustClose) b.chapterClosePanel(r.panelId);
    return { ok: true };
  }
  if (r.kind === 'select') {
    if (r.instrumentId) return b.selectInstrument(r.instrumentId);
    return b.selectInstrument(b.sim.selectCheapestAffordable());
  }
  if (r.kind === 'choice') {
    let pc = C().pendingChoice;
    if (!pc) { const p = (beat.panels || [])[0]; if (p) b.chapterOpenPanel(p); pc = C().pendingChoice; }
    if (!pc) return { ok: false, reason: 'no_choice' };
    return b.chapterAnswer(pc.id, pc.correctKey || (pc.options[0] && pc.options[0].key));
  }
  if (r.kind === 'submit') {
    const expect = r.expect || {};
    const st = S();
    if (expect.side === 'sell') {
      const pos = (st.positions || []).find((p) => p.qty - (p.lockedQty || 0) >= 100) || (st.positions || [])[0];
      return b.submitOrder({ side: 'sell', instrumentId: pos ? pos.instrumentId : st.selectedInstrumentId, type: 'market', qty: pos ? Math.min(pos.qty, 100) : 100 });
    }
    const type = expect.type === 'market' ? 'market' : 'limit';
    const id = st.selectedInstrumentId;
    const spec = { side: 'buy', instrumentId: id, type, qty: 100, price: null };
    if (type === 'limit') spec.price = px(id);
    return b.submitOrder(spec);
  }
  return { ok: false, reason: 'unknown:' + r.kind };
}
function walkTo(chapterId, beatId) {
  let guard = 0;
  while (Number(C().chapterId) === chapterId && C().beatId !== beatId && guard < 300) {
    guard += 1;
    const s = C();
    if (s.chapterEndReached) { b.chapterConfirm(); continue; }
    const beat = s.beat || {};
    const todo = (beat.require || []).filter((r) => !reqDone(s, r.id));
    if (!todo.length) { b.chapterNext ? null : null; break; }
    dispatch(todo[0], beat, s);
  }
  return { chapterId: C().chapterId, beatId: C().beatId, steps: guard };
}
function resetAll() {
  b.reset();
  b.resetChapterProgress();
  b.refresh();
}
function toCh2() {
  resetAll();
  walkTo(1, '1.9');
  b.chapterAnswer('1.9.confirm', 't1');
  b.chapterConfirm();
  return { chapterId: C().chapterId, beatId: C().beatId };
}

// ══ A. 红线（red line）—— UI 路径，全程无 dev* ═════════════════════════════
R.redLine = (() => {
  const entered = toCh2();
  // 把被打断的节拍推到 2.2（非 2.1），使「回到被打断的节拍」成为有意义的断言
  b.chapterGiveUp('2.1');
  const before = { beatId: C().beatId, beatIndex: C().beatIndex, panelId: C().panelId, isMarketOpen: S().isMarketOpen };
  // 触发红线（NAV 唯一入口）
  b.chapter.noteNav(9000);
  b.refresh();
  const hit = C();
  const dom = {
    visible: segVisible(),
    hasFinish: !!segBtn('extra.finish'),
    hasTopUp: !!segBtn('extra.topUp'),
    finishDisabled: segBtn('extra.finish') ? segBtn('extra.finish').disabled : null,
    panelText: segPanel() ? segPanel().innerText : null,
    sceneTreeRunning: sceneTree.running,
  };
  const clicks = [];
  for (let i = 0; i < 10 && C().extraSegment; i += 1) {
    const idxBefore = C().extraSegment.stepIndex;
    const res = clickSeg('extra.finish');
    clicks.push({ n: i + 1, stepBefore: idxBefore, stepAfter: C().extraSegment ? C().extraSegment.stepIndex : null, res, panelId: C().panelId, segmentLeft: C().extraSegment ? C().extraSegment.kind : null });
  }
  const after = C();
  const afterState = {
    extraSegment: after.extraSegment, panelId: after.panelId, redLineActive: after.redLineActive,
    interruptedBeatId: after.interruptedBeatId, beatId: after.beatId, beatIndex: after.beatIndex,
    panelStillVisible: segVisible(), allRequiresUnsatisfied: (after.beatRequirements || []).every((r) => !r.satisfied),
    sceneTreeRunning: sceneTree.running,
  };
  // 推进恢复：2.2 的 require 照常可由玩家提交满足
  const lim = S().quotes['601398'];
  const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: Number(lim.limitUp) + 0.01, qty: 100 });
  const resumed = { reasonCode: r.reasonCode, beatId: C().beatId };
  // 配额：同章第二次红线不再触发
  b.chapter.noteNav(500); b.refresh();
  const quota = { extraSegment: C().extraSegment, panelId: C().panelId, redLineActive: C().redLineActive, moneyTier: C().moneyTier };
  return {
    entered, before,
    hit: {
      redLineActive: hit.redLineActive, moneyTier: hit.moneyTier, panelId: hit.panelId,
      interruptedBeatId: hit.interruptedBeatId, remedialUsedThisChapter: hit.remedialUsedThisChapter,
      extraSegment: hit.extraSegment && { kind: hit.extraSegment.kind, origin: hit.extraSegment.origin, label: hit.extraSegment.label, steps: hit.extraSegment.steps.length, stepIndex: hit.extraSegment.stepIndex, toTopUpLabel: hit.extraSegment.toTopUpLabel },
    },
    dom, clicks, after: afterState, resumed, quota,
  };
})();

// ══ B. D 级补救段（章末，UI 路径）══════════════════════════════════════════
R.gradeD = (() => {
  toCh2();
  // 出场条件里的「四张规则卡可读」先行满足（真实打开面板读满 4 张），
  // 否则章末确认会被 `rule_cards_missing` 挡下，「完成后可照常确认」就没法断言。
  b.chapterOpenPanel('panel.ruleCards');
  b.chapterRead('panel.ruleCards', 4);
  b.chapterClosePanel('panel.ruleCards');
  b.devGotoBeat(2, '2.7');
  b.devForceGrade('D');
  b.devSatisfy('2.7.advance');
  b.devSatisfy('2.7.eventCard');
  const atEnd = { rating: C().rating, endPhase: S().endPhase, extraSegment: C().extraSegment && { kind: C().extraSegment.kind, origin: C().extraSegment.origin, steps: C().extraSegment.steps.length }, panelId: C().panelId, openPanels: Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.id) };
  const settlementText = q('#game-container [id="vg-menu-panel.settlement-outer"]') ? q('#game-container [id="vg-menu-panel.settlement-outer"]').innerText : null;
  b.chapterEndPhase();
  const inExtra = {
    endPhase: S().endPhase, panelId: C().panelId, visible: segVisible(),
    hasFinish: !!segBtn('extra.finish'), hasTopUp: !!segBtn('extra.topUp'),
    panelText: segPanel() ? segPanel().innerText : null,
    extraSegment: C().extraSegment && { kind: C().extraSegment.kind, origin: C().extraSegment.origin, label: C().extraSegment.label, steps: C().extraSegment.steps.length, toTopUpLabel: C().extraSegment.toTopUpLabel },
  };
  const clicks = [];
  for (let i = 0; i < 10 && C().extraSegment; i += 1) {
    const res = clickSeg('extra.finish');
    clicks.push({ n: i + 1, stepAfter: C().extraSegment ? C().extraSegment.stepIndex : null, res, panelId: C().panelId });
  }
  const afterComplete = { extraSegment: C().extraSegment, endPhase: S().endPhase, panelId: C().panelId, openPanels: Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.id) };
  // 「完成后可照常确认」——先答掉章末理解确认题（UI 上就是点 confirm 面板里的选项按钮）
  // 未答理解确认题时，章末确认应被拒（负例）
  const confirmBeforeAnswer = (() => { try { return b.chapterConfirm(); } catch (e) { return { err: String(e) }; } })();
  const pc = C().pendingChoice;
  const answered = pc ? b.chapterAnswer(pc.id, pc.correctKey || (pc.options[0] && pc.options[0].key)) : null;
  const conf = (() => { try { return b.chapterConfirm(); } catch (e) { return { err: String(e) }; } })();
  return {
    atEnd, settlementText, inExtra, clicks, afterComplete,
    pendingChoiceAfterRemedial: pc && { id: pc.id, question: pc.question, optionKeys: pc.options.map((o) => o.key), correctKey: pc.correctKey },
    answered,
    confirmBeforeAnswer,
    confirmAfterRemedial: conf,
    chapterIdAfter: C().chapterId, modeAfter: C().mode, beatIdAfter: C().beatId,
  };
})();

// ══ C. 补救配额：真线先触发 → 章末 D 不再起段；跨章重置 ═════════════════════
R.quota = (() => {
  const entered = toCh2();
  b.chapterOpenPanel('panel.ruleCards');
  b.chapterRead('panel.ruleCards', 4);
  b.chapterClosePanel('panel.ruleCards');
  b.chapterGiveUp('2.1');                      // 到 2.2
  b.chapter.noteNav(9000); b.refresh();        // 真线触发（消耗配额）
  const usedAfterRedLine = C().remedialUsedThisChapter;
  for (let i = 0; i < 10 && C().extraSegment; i += 1) clickSeg('extra.finish');
  const afterRedLine = { extraSegment: C().extraSegment, beatId: C().beatId, remedialUsedThisChapter: C().remedialUsedThisChapter };
  b.devGotoBeat(2, '2.7');
  b.devForceGrade('D');
  b.devSatisfy('2.7.advance');
  b.devSatisfy('2.7.eventCard');
  const atEnd = { rating: C().rating && C().rating.grade, extraSegment: C().extraSegment, endPhase: S().endPhase, panelId: C().panelId };
  const settlementText = q('#game-container [id="vg-menu-panel.settlement-outer"]') ? q('#game-container [id="vg-menu-panel.settlement-outer"]').innerText : null;
  b.chapterEndPhase();
  const afterEndPhase = { endPhase: S().endPhase, panelId: C().panelId, extraSegment: C().extraSegment };
  // 跨章边界重置
  b.chapterConfirm();
  const atCh3Free = { mode: C().mode, remedialUsedThisChapter: C().remedialUsedThisChapter };
  b.devGotoBeat(2, '2.1');
  const remedialAfterReenter2 = C().remedialUsedThisChapter;
  // 跨章边界重置为 false：第三章未实现，用「章节进度重置 → 重进第一章」走同一条
  // `enterChapter()` 代码路径（`resetChapterProgress()` 内部就是它）。
  b.resetChapterProgress();
  const afterChapterReset = { chapterId: C().chapterId, beatId: C().beatId, remedialUsedThisChapter: C().remedialUsedThisChapter };
  return { entered, usedAfterRedLine, afterRedLine, atEnd, settlementText, afterEndPhase, atCh3Free, remedialAfterReenter2, afterChapterReset };
})();

// ══ D. 一键补足本金（真实按钮）═════════════════════════════════════════════
R.topUp = (() => {
  toCh2();
  b.devGotoBeat(2, '2.6');
  // 建仓，让「持仓保留」可断言
  b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  const before = {
    cash: S().cash, NAV: S().NAV, qty: (S().positions[0] || {}).qty,
    navHistoryLen: (S().navHistory || []).length, concepts: C().conceptsIntroduced.length,
    beatId: C().beatId, explainCounts: JSON.stringify(C().mentor.explainCounts),
  };
  // 触发黄档让目标卡露出补足按钮（真实按钮）
  b.chapter.noteNav(30000); b.refresh();
  const tierBefore = { moneyTier: C().moneyTier, line: q('#chapter-root .ch-tier .line') ? q('#chapter-root .ch-tier .line').innerText : null, btnText: q('#chapter-root .ch-tier button') ? q('#chapter-root .ch-tier button').innerText.trim() : null, btnHidden: q('#chapter-root .ch-tier button') ? q('#chapter-root .ch-tier button').classList.contains('ch-hidden') : null };
  const btn = q('#chapter-root .ch-tier button');
  if (btn) btn.click();                       // ← 真实按钮
  const after1 = { NAV: S().NAV, cash: S().cash, qty: (S().positions[0] || {}).qty, navHistoryLen: (S().navHistory || []).length, concepts: C().conceptsIntroduced.length, beatId: C().beatId, explainCounts: JSON.stringify(C().mentor.explainCounts), injection: C().ratingInputs && C().ratingInputs.externalInjectionInWindow };
  const btn2 = q('#chapter-root .ch-tier button');
  if (btn2) btn2.click();                     // 不限次数
  const after2 = { NAV: S().NAV, cash: S().cash, qty: (S().positions[0] || {}).qty, navHistoryLen: (S().navHistory || []).length };
  return { before, tierBefore, after1, after2 };
})();

// ══ E. 黄档提示（章目标卡文案 + 老周每章最多一次）═══════════════════════════
R.yellow = (() => {
  toCh2();
  b.chapter.noteNav(30000); b.refresh();
  const first = { moneyTier: C().moneyTier, line: q('#chapter-root .ch-tier .line') ? q('#chapter-root .ch-tier .line').innerText : null, mentorLine: C().mentor.line, mentorSpeaker: C().mentor.speaker, goalCard: C().goalCard };
  const lineAfterFirst = first.mentorLine;
  b.chapter.noteNav(31000); b.refresh();
  const second = { moneyTier: C().moneyTier, mentorLine: C().mentor.line };
  // 绿档不出现黄档行
  b.chapter.noteNav(60000); b.refresh();
  const green = { moneyTier: C().moneyTier, line: q('#chapter-root .ch-tier .line') ? q('#chapter-root .ch-tier .line').innerText : null, tierHidden: (() => { const e = q('#chapter-root .ch-tier'); return e ? e.classList.contains('ch-hidden') : null; })() };
  return { first, lineAfterFirst, second, green };
})();

// ══ F. 外来入金剔除 + 重置账户记账 ═════════════════════════════════════════
R.injection = (() => {
  // 与 rating_isolation 同理：切到 freeDay 后注入即所见（章内模式下 settle() 会把真实 NAV
  // 追加为采样点，两组探针就不是同一条路径了）。
  const probeInj = (input) => {
    toCh2();
    b.setMode('freeDay');
    const r = b.devInjectRatingInputs(input);
    const ri = C().ratingInputs;
    return {
      rar: r && r.rar, S: r && r.S, maxDD: r && r.maxDD,
      externalInjectionInWindow: ri ? ri.externalInjectionInWindow : null,
      adjustedNavSeries: ri ? ri.adjustedNavSeries : null,
    };
  };
  // 同一条调整净值路径，唯一差别是「中途有一笔 ¥50,000 外来入金」。
  const noInjection = probeInj({ navSeries: [100000, 50000, 60000], adjustedNavSeries: [100000, 50000, 60000], fees: 0, notional: 0, injections: [0, 0, 0] });
  const withInjection = probeInj({ navSeries: [100000, 50000, 110000], adjustedNavSeries: [100000, 50000, 60000], fees: 0, notional: 0, injections: [0, 0, 50000] });
  // 真实接线：补足本金 → 窗口里的外来入金等于净增额。
  // 这一条必须留在 chapter 模式——外来入金只记进「章内评级窗口」，freeDay 下不采样。
  // 读 `chapter.ratingWindowInputs`（运行时自己的实时窗口视图；`ratingInputs` 只在 settle
  // 那一刻重算，而 `devInjectRatingInputs({})` 会把 injectionAtSample 拍平成同一值，
  // 反而抹掉「注入前 0 → 注入后 X」的时间线，所以这里读实时窗口才是对的）。
  toCh2();
  b.devGotoBeat(2, '2.6');
  b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  const navBefore = S().NAV;
  const topUpResult = b.topUpCapital();
  const winAfterTopUp = b.chapter.ratingWindowInputs;
  const real = {
    navBefore, topUpResult,
    externalInjectionInWindow: winAfterTopUp && winAfterTopUp.externalInjectionInWindow,
    adjustedNavSeries: winAfterTopUp && winAfterTopUp.adjustedNavSeries,
    navAfter: S().NAV,
  };
  // 重置账户记账 = max(0, 100000 − NAV)
  toCh2();
  b.devGotoBeat(2, '2.6');
  const navBeforeReset = S().NAV;
  const resetResult = b.resetAccount();
  const winAfterReset = b.chapter.ratingWindowInputs;
  const resetExternal = winAfterReset && winAfterReset.externalInjectionInWindow;
  return {
    noInjection, withInjection,
    real, navBeforeReset, resetResult, resetExternal,
  };
})();
return R;
