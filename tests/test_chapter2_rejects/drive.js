/**
 * test_chapter2_rejects —— 第二章：四次拒单由玩家主动提交触发 / giveUp 出口 / 2.3 无持仓 /
 * 出场条件（四类合法委托 + 四张规则卡）/ 2.5 选择题 / §3.8 定向事件。
 *
 * 覆盖 plan.md Verification Plan 中 test_chapter2_rejects 的 6 行。
 */
const b = sceneTree.nodes.get('broker');
const R = {};
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const q = (sel) => document.querySelector(sel);
const panelEl = (name) => q('#game-container [id="vg-menu-panel.' + name + '-outer"]');
const openPanels = () => Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open'))
  .map((e) => e.id.replace('vg-menu-panel.', '').replace('-outer', ''));
const snap = (tag) => ({
  beatId: C().beatId, beatIndex: C().beatIndex, chapterId: C().chapterId,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  reasonCode: S().lastOrder && S().lastOrder.reasonCode,
  positions: S().positions.map((p) => p.instrumentId + ':' + p.qty + '/' + p.lockedQty),
  ruleCardsSeen: C().ruleCardsSeen.slice(),
  date: S().inGameDate, isMarketOpen: S().isMarketOpen,
});
const order = (spec) => {
  const r = b.submitOrder(spec);
  R.orders = R.orders || [];
  R.orders.push({ side: spec.side, type: spec.type, instrumentId: spec.instrumentId, price: spec.price, qty: spec.qty, reasonCode: r.reasonCode, status: r.status, fillPrice: r.fillPrice });
  return r;
};

// ── 走过第一章（记录定向事件 day1/day2）────────────────────────────────────
b.chapterAck('1.0.start');
b.chapterAck('1.1.openDeposit'); b.chapterRead('panel.deposit', 2); b.chapterClosePanel('panel.deposit');
b.chapterAck('1.2.openAccount'); b.chapterAck('1.3.fundInitial');
R.ch1Day1 = { date: S().inGameDate, currentEvent: S().currentEvent && S().currentEvent.id, directed: C().directedEvents };
b.chapterSelect('601398', { player: true });
order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
b.chapterRead('panel.conceptCards', 3); b.chapterClosePanel('panel.conceptCards');
b.advanceDay();
R.ch1Day2 = { date: S().inGameDate, currentEvent: S().currentEvent && S().currentEvent.id, directed: C().directedEvents };
order({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
b.chapterRead('panel.review', 5); b.chapterClosePanel('panel.review');
b.chapterAnswer('1.9.confirm', 't1');
b.chapterConfirm();
R.enteredChapter2 = { chapterId: C().chapterId, beatId: C().beatId, positions: S().positions.length };

// ── 2.1 未提交时无任何自动完成路径（负例）─────────────────────────────────
R.noSubmitNegatives = (() => {
  const out = [];
  for (const [name, fn] of [
    ['chapterAck(2.1.rejectFunds)', () => b.chapterAck('2.1.rejectFunds')],
    ['chapterAck(2.1.giveUp) + chapterEndPhase', () => { b.chapterAck('2.1.giveUp'); b.chapterEndPhase(); }],
    ['chapterCompleteExtra', () => b.chapterCompleteExtra()],
    ['chapterClosePanel', () => b.chapterClosePanel()],
    ['devSatisfy 之外的推进钩子 chapterChange', () => b.chapterExtraStep()],
  ]) {
    let err = null;
    try { fn(); } catch (e) { err = String(e); }
    out.push({ name, beatId: C().beatId, reasonCode: S().lastOrder && S().lastOrder.reasonCode, err });
  }
  return { start: R.enteredChapter2.beatId, attempts: out };
})();

// ── 2.1 – 2.4：四次拒单由玩家主动提交触发 ─────────────────────────────────
R.rejects = [];
order({ side: 'buy', type: 'limit', instrumentId: '600519', price: px('600519'), qty: 100 });
R.rejects.push({ beat: '2.1', expected: 'REJECT_1', ...snap('2.1') });
const lim = S().quotes['601398'];
order({ side: 'buy', type: 'limit', instrumentId: '601398', price: Number(lim.limitUp) + 0.01, qty: 100 });
R.rejects.push({ beat: '2.2', expected: 'REJECT_2', ...snap('2.2') });
order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
R.at23Buy = snap('2.3 buy');
order({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
R.rejects.push({ beat: '2.3', expected: 'REJECT_4', ...snap('2.3') });
let g = 0;
while (S().isMarketOpen && g < 12) { b.advanceDay(); g += 1; }
R.weekend = { date: S().inGameDate, isMarketOpen: S().isMarketOpen };
order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
R.rejects.push({ beat: '2.4', expected: 'REJECT_3', ...snap('2.4') });

// ── 2.5：UI 可达性诊断 + 两个选项都有回馈 ────────────────────────────────
{
  b.chapterOpenPanel('panel.ruleCards');
  b.chapterRead('panel.ruleCards', 4);
  const rl = panelEl('ruleCards');
  R.beat25Ui = {
    beatId: C().beatId,
    panelOpen: !!rl && rl.classList.contains('ch-open'),
    pendingChoiceWhilePanelOpen: C().pendingChoice,
    panelChoiceButtons: rl ? Array.from(rl.querySelectorAll('[data-choice-id]')).map((e) => e.getAttribute('data-choice-id')) : [],
    dialogueChoiceButtons: Array.from(document.querySelectorAll('#chapter-root [data-choice-id]')).map((e) => e.getAttribute('data-choice-id')),
    panelButtonLabels: rl ? Array.from(rl.querySelectorAll('button')).map((e) => (e.textContent || '').trim()) : [],
    panelTextHasQuestion: !!rl && rl.innerText.indexOf('你觉得这几条规则') >= 0,
  };
  b.chapterClosePanel('panel.ruleCards');
  R.beat25Ui.afterClose = { beatId: C().beatId, requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied), pendingChoice: C().pendingChoice };
  R.beat25Ui.uiOnlyAdvanceImpossible = C().beatId === '2.5';
  R.beat25Ui.ruleCardsSeenAfterRead = C().ruleCardsSeen.slice();
  // 用 eval 钩子作答（UI 无入口）—— 记录两个选项的回馈
  const res = b.chapterAnswer('2.5.fourRules', 'restrict');
  R.beat25Ui.answerRestrict = res;
  R.beat25Ui.mentorLineAfterRestrict = C().mentor.line;
  R.beat25Ui.beatAfterRestrict = C().beatId;
}
// 另一个选项在独立场景下验证
R.beat25SecondOption = (() => {
  b.devGotoBeat(2, '2.5');
  b.chapterOpenPanel('panel.ruleCards');
  b.chapterRead('panel.ruleCards', 4);
  b.chapterClosePanel('panel.ruleCards');
  const res = b.chapterAnswer('2.5.fourRules', 'protect');
  return {
    answerResult: res,
    mentorLineAfterProtect: C().mentor.line,
    beatAfter: C().beatId,
  };
})();

// ── 2.6：四类合法委托 ────────────────────────────────────────────────────
{
  b.devGotoBeat(2, '2.6');
  g = 0;
  while (!S().isMarketOpen && g < 12) { b.advanceDay(); g += 1; }
  R.at26Start = snap('2.6 start');
  order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  R.at26AfterLimitBuy = snap('2.6 limitBuy');
  order({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  R.at26AfterLimitSell = snap('2.6 limitSell');
  order({ side: 'buy', type: 'market', instrumentId: '601398', qty: 100 });
  R.at26AfterMarketBuy = snap('2.6 marketBuy');
  order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  R.at26AfterCorrected = snap('2.6 correctedLimit');
}
// 词典里四张规则卡可查 + 评级公式查询入口
{
  const opened = b.openDictionary();
  const dict = q('#game-container [data-role="concept-dictionary"]');
  R.dictionary = {
    openResult: opened === null || opened === undefined ? null : true,
    panelFound: !!dict,
    open: dict ? !dict.classList.contains('ch-hidden') : null,
    entryKeys: dict ? Array.from(dict.querySelectorAll('.idx .entry')).map((e) => e.getAttribute('data-concept-key')) : [],
    tabs: dict ? Array.from(dict.querySelectorAll('.tabs .tab')).map((e) => e.innerText.trim()) : [],
    text: dict ? dict.innerText : null,
    formulaText: null,
  };
  if (dict) {
    const formulaTab = Array.from(dict.querySelectorAll('.tabs .tab')).find((e) => e.innerText.indexOf('公式') >= 0);
    if (formulaTab) { formulaTab.click(); R.dictionary.formulaText = dict.innerText; }
  }
  const closeBtn = dict ? dict.querySelector('button.ch-btn.ghost.sm') : null;
  if (closeBtn) closeBtn.click();
}
// ── 2.7：钉入 I01 + 章末 ─────────────────────────────────────────────────
{
  g = 0;
  while (C().beatId === '2.6' && g < 8) { b.advanceDay(); g += 1; }
  R.at27 = { ...snap('2.7'), directed: C().directedEvents };
  b.devForceGrade('B');
  b.advanceDay();  // 满足 2.7.advance（钉入 I01）
  R.at27AfterAdvance = { date: S().inGameDate, currentEvent: S().currentEvent && S().currentEvent.id, directed: C().directedEvents };
  b.chapterOpenPanel('panel.eventCard');
  b.chapterRead('panel.eventCard', 1);
  b.chapterClosePanel('panel.eventCard');
  R.chapterEnd = { beatId: C().beatId, chapterEndReached: S().chapterEndReached, endPhase: S().endPhase, rating: C().rating, ruleCardsSeen: C().ruleCardsSeen, openPanels: openPanels() };
  b.chapterEndPhase();
  R.chapterConfirmBeforeChoice = (() => { try { return b.chapterConfirm(); } catch (e) { return { err: String(e) }; } })();
  b.chapterAnswer('2.end', 'limit');
  R.chapterConfirmAfterChoice = (() => { try { return b.chapterConfirm(); } catch (e) { return { err: String(e) }; } })();
  R.finalMode = C().mode;
  R.finalChapterId = C().chapterId;
  R.nextChapter = C().nextChapter;
}

// ── giveUp 出口（2.2 / 2.4 各演示一次）───────────────────────────────────
R.giveUp = (() => {
  const out = {};
  b.devGotoBeat(2, '2.2');
  const before22 = snap('2.2 fresh');
  const r22 = b.chapterGiveUp();
  out.beat22 = { before: before22.beatId, giveUpResult: r22 && { ok: r22.ok, beatId: r22.beatId, demoSteps: r22.demo && r22.demo.steps && r22.demo.steps.length }, after: snap('after giveUp 2.2') };
  b.devGotoBeat(2, '2.4');
  b._advanceToClosedDay ? b._advanceToClosedDay() : null;
  let gg = 0;
  while (S().isMarketOpen && gg < 12) { b.advanceDay(); gg += 1; }
  const before24 = snap('2.4 fresh');
  const r24 = b.chapterGiveUp();
  out.beat24 = { before: before24.beatId, isMarketOpen: before24.isMarketOpen, giveUpResult: r24 && { ok: r24.ok, beatId: r24.beatId, demoSteps: r24.demo && r24.demo.steps && r24.demo.steps.length }, after: snap('after giveUp 2.4') };
  return out;
})();

// ── Edge Case 2.3 无持仓 ────────────────────────────────────────────────
R.noPosition23 = (() => {
  // 清空持仓（PRD §3.6「重置账户」正是这条产品动作）
  b.resetAccount();
  b.devGotoBeat(2, '2.3');
  let gg = 0;
  while (!S().isMarketOpen && gg < 12) { b.advanceDay(); gg += 1; }
  const before = { ...snap('2.3 no position start'), orderCount: S().positions.length };
  const r = order({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  const afterSell = snap('2.3 sell without position');
  // PRD Edge Case 的引导路径：先买 1 手（成功）→ 当日卖出 → REJECT_4
  const rb = order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  const r2 = order({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  return {
    before,
    sellWithoutPosition: { reasonCode: r.reasonCode, beatAfter: afterSell.beatId, requirements: afterSell.requirements },
    buyThenSell: { buyReason: rb.reasonCode, buyStatus: rb.status, sellReason: r2.reasonCode, after: snap('2.3 after buy+sell') },
  };
})();
return R;
