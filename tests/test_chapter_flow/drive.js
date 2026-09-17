/**
 * test_chapter_flow —— 章节节拍流的驱动脚本。
 *
 * 覆盖 plan.md Verification Plan 中的：
 *   §1            开局落在节拍 1.0
 *   §3.1          节拍只能顺序推进（含「无任何 chapter* 钩子能跳到 1.6」的负例）
 *   §3.4          理解确认「T+1」题：选错只重讲、可无限重试；选对 → 章末确认 → chapterId=2
 *   Edge Case     `beatCount` 显示：加演段期间 remainingBeats 不变、段内标「加演」
 *   §3.7          章内残留清理：带未成交挂单 + T+1 锁定进入下一章 → pendingOrders=[] / lockedQty=0
 *
 * 全部走 Runtime API（`vibegame play eval`），与 DOM 点击走同一条回调路径。
 * 返回一个结构化对象，由 assert_chapter_flow.py 断言。
 */
const b = sceneTree.nodes.get('broker');
const R = {};
const state = () => b.runtimeState();
const c = () => state().chapter;
// 面板宿主：id = `vg-menu-panel.<name>-outer`，打开时加类 `ch-open`（见 ChapterOverlay）。
const panelEl = (name) => document.querySelector('#game-container [id="vg-menu-panel.' + name + '-outer"]');
const panelOpen = (name) => { const el = panelEl(name); return !!el && el.classList.contains('ch-open'); };
const openPanels = () => Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open'))
  .map((e) => e.id.replace('vg-menu-panel.', '').replace('-outer', ''));
const panelText = (name) => { const el = panelEl(name); return el ? el.innerText : null; };
const screenText = () => { const el = document.querySelector('#game-container'); return el ? el.innerText : ''; };
const chapterText = () => { const el = document.querySelector('#chapter-root'); return el ? el.innerText : ''; };
const posOf = (s, id) => (s.positions || []).find((p) => p.instrumentId === id) || { qty: 0, lockedQty: 0 };
const qtyOf = (s, id) => posOf(s, id).qty;
const lockedOf = (s, id) => posOf(s, id).lockedQty;
const px = (id) => Number(state().quotes[id].lastPrice);

// ─── 1. 开局态（§1）───────────────────────────────────────────────────────────
{
  const s = state();
  const shell = document.querySelector('#broker-shell');
  R.initial = {
    chapterId: c().chapterId, beatId: c().beatId, beatIndex: c().beatIndex,
    beatCount: c().beatCount, remainingBeats: c().remainingBeats,
    mode: c().mode, shellMode: c().shellMode,
    accountOpened: s.accountOpened, accountFunded: s.accountFunded, dayOpen: s.dayOpen,
    cash: s.cash, NAV: s.NAV, tradedNotional: s.tradedNotional,
    dayIndex: s.dayIndex, inGameDate: s.inGameDate, selectedInstrumentId: s.selectedInstrumentId,
    panelId: c().panelId,
    requirements: c().beatRequirements,
    goalCard: c().goalCard,
    shellDisplay: shell ? getComputedStyle(shell).display : null,
    shellDataMode: shell ? shell.getAttribute('data-shell-mode') : null,
    shellTextVisible: shell && getComputedStyle(shell).display !== 'none' ? shell.innerText.slice(0, 200) : '',
    openPanels: openPanels(),
  };
}

// ─── 2. 跳过尝试（§3.1 负例）──────────────────────────────────────────────────
{
  const before = c().beatId;
  const attempts = [];
  const hookCalls = [
    ['chapterAck(1.6.advance)', () => b.chapterAck('1.6.advance')],
    ['chapterAck(1.5.buy)', () => b.chapterAck('1.5.buy')],
    ['chapterAck(1.9.confirm)', () => b.chapterAck('1.9.confirm')],
    ['chapterClosePanel()', () => b.chapterClosePanel()],
    ['chapterAnswer(1.9.confirm,t1)', () => b.chapterAnswer('1.9.confirm', 't1')],
    ['chapterExtraStep()', () => b.chapterExtraStep()],
    ['chapterCompleteExtra()', () => b.chapterCompleteExtra()],
    ['chapterEndPhase()', () => b.chapterEndPhase()],
    ['chapterGiveUp()', () => b.chapterGiveUp()],
    ['chapterConfirm()', () => b.chapterConfirm()],
    ['chapterRead(panel.deposit,9)', () => b.chapterRead('panel.deposit', 9)],
  ];
  for (const [name, fn] of hookCalls) {
    let err = null;
    try { fn(); } catch (e) { err = String(e); }
    attempts.push({ name, beatId: c().beatId, beatIndex: c().beatIndex, err });
  }
  R.skipAttempts = { before, attempts };
}

// ─── 3. 顺序推进（§3.1）：逐拍满足 require，记录 beatIndex 增量 ─────────────
const walkLog = [];
const snapBeat = (tag) => walkLog.push({
  tag, beatId: c().beatId, beatIndex: c().beatIndex,
  requirements: c().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
  openPanels: openPanels(),
});
const step = (tag, fn) => {
  let err = null;
  try { fn(); } catch (e) { err = String(e); }
  snapBeat(tag);
  if (err) walkLog.push({ tag: tag + ' ERR', err });
};
step('1.0 start', () => b.chapterAck('1.0.start'));
step('1.1 openDeposit', () => b.chapterAck('1.1.openDeposit'));
// 负例：只读 1 条就关面板 → 不得推进
step('1.1 read 1 then close', () => { b.chapterRead('panel.deposit', 1); b.chapterClosePanel('panel.deposit'); });
step('1.1 read 1 more', () => b.chapterRead('panel.deposit', 1));
step('1.2 openAccount', () => b.chapterAck('1.2.openAccount'));
step('1.3 fundInitial', () => b.chapterAck('1.3.fundInitial'));
step('1.4 select cheapest', () => b.chapterSelect('601398', { player: true }));
step('1.5 buy', () => b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 }));
// 负例：概念卡只读 1 张就关 → 不推进
step('1.5.5 read 1 then close', () => { b.chapterRead('panel.conceptCards', 1); b.chapterClosePanel('panel.conceptCards'); });
step('1.5.5 read 3 + close', () => { b.chapterRead('panel.conceptCards', 3); b.chapterClosePanel('panel.conceptCards'); });
step('1.6 advanceDay', () => b.advanceDay());
step('1.7 sell', () => b.submitOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 }));
// 负例：复盘面板未关 → 不推进
step('1.8 review open (not closed)', () => {});
step('1.8 read 5 + close', () => { b.chapterRead('panel.review', 5); b.chapterClosePanel('panel.review'); });
R.walk = walkLog;

// ─── 4. 章末理解确认题（§3.4）────────────────────────────────────────────────
{
  const before = c();
  const choiceId = before.pendingChoice && before.pendingChoice.id;
  R.choice = {
    beatId: before.beatId,
    hasPendingChoice: !!before.pendingChoice,
    question: before.pendingChoice && before.pendingChoice.question,
    optionKeys: before.pendingChoice ? before.pendingChoice.options.map((o) => o.key) : null,
    correctKey: before.pendingChoice && before.pendingChoice.correctKey,
    panelOpen: panelOpen('confirm'),
    panelText: panelText('confirm'),
  };
  b.chapterAnswer(choiceId, 'limit'); // 错答
  const afterWrong = c();
  R.choice.afterWrong = {
    answeredKey: afterWrong.pendingChoice.answeredKey,
    feedbackForWrong: (afterWrong.pendingChoice.feedbackByOption || {})['limit'],
    requirements: afterWrong.beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    beatId: afterWrong.beatId,
    dialogueText: chapterText(),
    mentorLine: afterWrong.mentor.line,
    confirmResult: (() => { try { return b.chapterConfirm(); } catch (e) { return { err: String(e) }; } })(),
  };
  b.chapterAnswer(choiceId, 'limit'); // 无限重试：再错一次
  R.choice.afterRetryWrong = {
    answeredKey: c().pendingChoice.answeredKey,
    beatId: c().beatId,
    requirements: c().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
  };
  b.chapterAnswer(choiceId, 't1');
  R.choice.afterCorrect = {
    answeredKey: c().pendingChoice.answeredKey,
    requirements: c().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    confirmResult: (() => { try { return b.chapterConfirm(); } catch (e) { return { err: String(e) }; } })(),
    chapterId: c().chapterId, beatId: c().beatId, mode: c().mode,
  };
}

// ─── 5. 第二章真实走通 + beatCount 显示（加演段）───────────────────────────────
const ch2Log = [];
{
  const log2 = (tag, extra = {}) => ch2Log.push({
    tag, beatId: c().beatId, beatIndex: c().beatIndex, date: state().inGameDate,
    isMarketOpen: state().isMarketOpen,
    requirements: c().beatRequirements.map((r) => r.id + '=' + r.satisfied),
    lastOrderReason: state().lastOrder && state().lastOrder.reasonCode,
    ...extra,
  });
  const order = (spec) => {
    const r = b.submitOrder(spec);
    ch2Log.push({ tag: 'order', spec: spec.side + '/' + spec.type + '/' + (spec.instrumentId || '') + (spec.price ? '@' + spec.price : ''), reasonCode: r.reasonCode, status: r.status });
    return r;
  };
  log2('2.1');
  order({ side: 'buy', type: 'limit', instrumentId: '600519', price: px('600519'), qty: 100 });
  log2('after 2.1');
  order({ side: 'buy', type: 'limit', instrumentId: '601398', price: Number(state().quotes['601398'].limitUp) + 0.01, qty: 100 });
  log2('after 2.2');
  order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  log2('2.3 buy');
  order({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  log2('after 2.3');
  let guard = 0;
  while (state().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
  log2('2.4 weekend');
  order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  log2('after 2.4');
  // 2.5：UI 上先把四张规则卡读完并关闭
  b.chapterOpenPanel('panel.ruleCards');
  b.chapterRead('panel.ruleCards', 4);
  const rlPanel = panelEl('ruleCards');
  R.beat25Ui = {
    beatId: c().beatId,
    panelId: c().panelId,
    pendingChoiceBeforeClose: c().pendingChoice,
    panelTitle: rlPanel ? rlPanel.querySelector('.ch-phd .t') && rlPanel.querySelector('.ch-phd .t').textContent : null,
    panelButtons: rlPanel ? Array.from(rlPanel.querySelectorAll('button')).map((e) => (e.textContent || '').trim()) : null,
    panelChoiceButtons: rlPanel ? Array.from(rlPanel.querySelectorAll('[data-choice-id]')).map((e) => e.getAttribute('data-choice-id')) : null,
    dialogueChoiceButtons: Array.from(document.querySelectorAll('#chapter-root [data-choice-id]')).map((e) => e.getAttribute('data-choice-id')),
    panelText: rlPanel ? rlPanel.innerText : null,
  };
  b.chapterClosePanel('panel.ruleCards');
  R.beat25Ui.afterClose = {
    beatId: c().beatId,
    requirements: c().beatRequirements.map((r) => r.id + '=' + r.satisfied),
    pendingChoice: c().pendingChoice,
    ruleCardsSeen: c().ruleCardsSeen,
  };
  b.chapterAck('2.5.choice'); b.chapterEndPhase(); b.chapterExtraStep();
  R.beat25Ui.afterOtherHooks = { beatId: c().beatId, requirements: c().beatRequirements.map((r) => r.id + '=' + r.satisfied) };
  R.beat25Ui.answerViaHook = b.chapterAnswer('2.5.fourRules', 'restrict');
  R.beat25Ui.feedbackByOption = (() => { const ch = c().pendingChoice; return ch ? ch.feedbackByOption : null; })();
  log2('after 2.5');
  guard = 0;
  while (!state().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
  log2('2.6 monday');
  order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  log2('2.6 limitBuy');
  order({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  log2('2.6 limitSell');
  order({ side: 'buy', type: 'market', instrumentId: '601398', qty: 100 });
  log2('2.6 marketBuy');
  order({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  log2('2.6 correctedLimit');
  guard = 0;
  while (c().beatId === '2.6' && guard < 8) { b.advanceDay(); guard += 1; }
  log2('2.7');
  // 章末评级强制为 A（加演段）—— 必须在章末结算发生**之前**设定
  b.devForceGrade('A');
  if (c().beatId === '2.7') b.advanceDay(); // 满足 2.7 的 advanceDay 条件（钉入 I01）
  log2('2.7 advanced');
  b.chapterOpenPanel('panel.eventCard');
  b.chapterRead('panel.eventCard', 1);
  b.chapterClosePanel('panel.eventCard');
  log2('after 2.7');
  const end = c();
  R.extraSpin = {
    atChapterEnd: {
      beatId: end.beatId, beatCount: end.beatCount, remainingBeats: end.remainingBeats,
      completed: end.completedBeats.length, chapterEndReached: state().chapterEndReached,
      endPhase: state().endPhase, openPanels: openPanels(),
      rating: end.rating, extraSegment: end.extraSegment,
    },
    settlementPanelText: panelText('settlement'),
  };
  b.chapterEndPhase();
  const inExtra = c();
  R.extraSpin.inExtra = {
    beatCount: inExtra.beatCount, remainingBeats: inExtra.remainingBeats,
    completed: inExtra.completedBeats.length,
    extraKind: inExtra.extraSegment && inExtra.extraSegment.kind,
    extraOrigin: inExtra.extraSegment && inExtra.extraSegment.origin,
    extraLabel: inExtra.extraSegment && inExtra.extraSegment.label,
    extraSteps: inExtra.extraSegment && inExtra.extraSegment.steps.length,
    stepIndex: inExtra.extraSegment && inExtra.extraSegment.stepIndex,
    endPhase: state().endPhase, openPanels: openPanels(),
    panelText: panelText('extraSegment'),
  };
  for (let i = 0; i < 6; i += 1) b.chapterExtraStep();
  const stepped = c();
  R.extraSpin.afterSteps = { stepIndex: stepped.extraSegment && stepped.extraSegment.stepIndex, remainingBeats: stepped.remainingBeats };
  R.extraSpin.completeResult = b.chapterCompleteExtra();
  const post = c();
  R.extraSpin.afterComplete = {
    extraSegment: post.extraSegment, remainingBeats: post.remainingBeats, beatCount: post.beatCount,
    endPhase: state().endPhase, openPanels: openPanels(),
  };
  R.chapter2Walk = ch2Log;
}

// ─── 6. 章内残留清理（§3.7）──────────────────────────────────────────────────
{
  b.devGotoBeat(1, '1.9');
  b.devSatisfy('1.9.confirm');
  b.chapterAnswer('1.9.confirm', 't1');
  // 造 T+1 锁定持仓（今日买入）
  b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  // 造一个不会成交的挂单（买价低于最新价 → 挂起）
  const pendPx = Number((px('601398') - 0.01).toFixed(2));
  const pending = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: pendPx, qty: 100 });
  const s1 = state();
  R.residual = {
    before: {
      beatId: c().beatId,
      pendingOrderCount: s1.pendingOrders.length,
      pendingOrderProbe: pending.reasonCode + '/' + pending.status,
      frozenCash: s1.frozenCash,
      lockedQty: lockedOf(s1, '601398'),
      qty: qtyOf(s1, '601398'),
    },
  };
  R.residual.confirmResult = b.chapterConfirm();
  const s2 = state();
  R.residual.after = {
    chapterId: c().chapterId, beatId: c().beatId,
    pendingOrderCount: s2.pendingOrders.length,
    lockedQty: lockedOf(s2, '601398'),
    frozenCash: s2.frozenCash,
    positionQty: qtyOf(s2, '601398'),
  };
}
return R;
