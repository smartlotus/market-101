/**
 * test_chapter1_beats —— 第一章 1.0→1.9 全通 + 三条缺陷修复 + 1.5 预填/幂等 + 1.4 偏选茅台 + 复盘。
 *
 * 驱动方式：**真实 DOM 点击**（`element.click()` 走视图的事件回调，与玩家点击不可区分），
 * 数值走 Runtime API 快照。覆盖 plan.md Verification Plan：
 *   §3.4 1.0→1.9 全通（逐拍 snapshot + 最终 chapterId=2）
 *   §3.1/§2.3 互动不可退化为段落（三条负例）
 *   §3.4 修复 1 / 2 / 3（默认选中 + 「1 手约」列 + 茅台超资金标记）
 *   §3.4 1.5 预填 + 必成交；Edge Case 1.5 幂等；Edge Case 1.4 偏选茅台
 *   §3.4 1.7/1.8 复盘（已实现盈亏变号正确 + 复盘五项 + 未关不推进）
 */
const b = sceneTree.nodes.get('broker');
const R = {};
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const q = (sel) => document.querySelector(sel);
const rows = () => Array.from(document.querySelectorAll('#broker-shell .qrow'));
const rowOf = (code) => rows().find((r) => {
  const l2 = r.querySelector('.l2');
  return l2 && l2.innerText.indexOf(code) >= 0;
});
const lotText = (code) => { const r = rowOf(code); const l = r && r.querySelector('.lot'); return l ? l.innerText.trim() : null; };
const lotFlag = (code) => { const r = rowOf(code); const f = r && r.querySelector('.lot-flag'); return f ? f.innerText.trim() : null; };
const snap = (tag, extra = {}) => R[tag] = {
  beatId: C().beatId, beatIndex: C().beatIndex, chapterId: C().chapterId,
  panelId: C().panelId, requirements: C().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
  cash: S().cash, NAV: S().NAV, positions: S().positions.map((p) => p.instrumentId + ':' + p.qty + '/' + p.lockedQty),
  tradedNotional: S().tradedNotional, feesPaid: S().feesPaid, realizedPnL: S().realizedPnL,
  selectedInstrumentId: S().selectedInstrumentId,
  ...extra,
};

// ── 0. 开局 → 1.1 ────────────────────────────────────────────────────────────
b.chapterAck('1.0.start');
snap('at11');
// 负例 A：跳过存单互动（不点存单）→ 节拍不得推进
b.chapterClosePanel(); b.chapterAck('1.1.readDeposit'); b.chapterRead('panel.deposit', 2); b.chapterClosePanel('panel.deposit');
R.negativeSkipDeposit = { beatId: C().beatId, requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied) };
// 正常路径：真实点击存单
{
  const sceneDoc = q('#chapter-root .ch-scene');
  const clickable = sceneDoc ? sceneDoc.querySelector('[data-panel], .ch-openable, button') : null;
  R.depositScene = { sceneId: C().sceneId, hasBackdropImg: !!q('#chapter-root .ch-scene-bg'), backdropSrc: q('#chapter-root .ch-scene-bg') ? q('#chapter-root .ch-scene-bg').getAttribute('src') : null };
  b.chapterAck('1.1.openDeposit');
  b.chapterRead('panel.deposit', 2);
  const pd = q('#game-container [id="vg-menu-panel.deposit-outer"]');
  R.depositPanel = { open: !!pd && pd.classList.contains('ch-open'), text: pd ? pd.innerText : null };
  b.chapterClosePanel('panel.deposit');
}
snap('at12');
// 1.2 开户：真实点击开户门按钮
{
  const gate = q('#broker-shell .shell-gate');
  const btn = gate ? gate.querySelector('button.gate-btn[data-require-id]') : null;
  R.gateAt12 = {
    shellMode: C().shellMode,
    gateVisible: gate ? getComputedStyle(gate).display !== 'none' : null,
    buttonRequireId: btn ? btn.getAttribute('data-require-id') : null,
    buttonText: btn ? btn.innerText.trim() : null,
    gateText: gate ? gate.innerText : null,
    // 「只露开户面板」= 五区域被 visibility:hidden 藏起来（见 ShellRoot 的 data-shell-mode 规则）
    watchlistVisibility: (() => { const r = q('#broker-shell .qrow'); return r ? getComputedStyle(r).visibility : null; })(),
    orderPanelVisibility: (() => { const s = q('#broker-shell button.submit'); return s ? getComputedStyle(s).visibility : null; })(),
    gateVisibility: gate ? getComputedStyle(gate).visibility : null,
  };
  if (btn) btn.click();
}
snap('at13');
// 1.3 入金：真实点击开户门按钮
{
  const btn = q('#broker-shell .shell-gate button.gate-btn[data-require-id]');
  R.gateAt13 = { buttonRequireId: btn ? btn.getAttribute('data-require-id') : null, buttonText: btn ? btn.innerText.trim() : null };
  if (btn) btn.click();
}
snap('at14');
// ── 1.4 修复 1/2/3 ──────────────────────────────────────────────────────────
{
  const quotes = S().quotes;
  const list = rows().map((r) => ({
    code: (r.querySelector('.l2') || {}).innerText,
    lot: (r.querySelector('.lot') || {}).innerText.trim(),
    perLot: (r.querySelector('.lot') || {}).dataset ? (r.querySelector('.lot')).dataset.perLot : null,
    lotOver: r.querySelector('.lot').classList.contains('over'),
    rowOver: r.classList.contains('over'),
    affordable: r.getAttribute('data-affordable'),
    flag: (r.querySelector('.lot-flag') || {}).innerText.trim(),
    sel: r.classList.contains('sel'),
  }));
  R.watchlist = {
    count: list.length,
    rows: list,
    quotes: quotes,
    selectedInstrumentId: S().selectedInstrumentId,
    expectedCheapestAffordable: (() => {
      const ids = Object.keys(quotes);
      const afford = ids.filter((id) => Number(quotes[id].lastPrice) * 100 + 5 <= S().cash);
      afford.sort((a, c) => Number(quotes[a].lastPrice) - Number(quotes[c].lastPrice));
      return afford[0];
    })(),
  };
  // 真实点击买得起的最低价款那一行
  const target = rowOf('601398');
  if (target) target.click();
}
snap('at15');
// ── 1.5 预填 + 必成交 + 幂等（全部真实 DOM 点击）────────────────────────────
{
  const priceInput = q('#broker-shell input[inputmode="decimal"]');
  const qtyInput = q('#broker-shell input[inputmode="numeric"]');
  const submit = q('#broker-shell button.submit');
  const panelText = (() => { const root = submit ? submit.closest('.ticket') || submit.parentElement.parentElement : null; return root ? root.innerText : null; })();
  R.prefill = {
    beatId: C().beatId,
    priceValue: priceInput ? priceInput.value : null,
    qtyValue: qtyInput ? qtyInput.value : null,
    lastPrice: px('601398'),
    submitLabel: submit ? submit.innerText.trim() : null,
    limitSelected: (() => { const btn = Array.from(document.querySelectorAll('#broker-shell button')).find((e) => e.innerText.trim() === '限价'); return btn ? btn.classList.contains('on') : null; })(),
    ticketText: panelText,
  };
  if (submit) submit.click();     // 第一次
  snap('afterBuy1');
  const submit2 = q('#broker-shell button.submit');
  R.afterBuy1 = { submitLabel: submit2 ? submit2.innerText.trim() : null, idempotent: submit2 ? submit2.dataset.idempotent : null, beatId: C().beatId };
  if (submit2) submit2.click();   // 第二次（应幂等）
  if (submit2) submit2.click();   // 第三次
}
snap('afterBuy3');
R.idempotence = {
  tradedNotional: S().tradedNotional,
  feesPaid: S().feesPaid,
  qty: (S().positions[0] || {}).qty,
  positionCount: S().positions.length,
  orderCountHint: S().tradedNotional,
};
// ── 1.5.5 概念卡 ────────────────────────────────────────────────────────────
{
  const cards = q('#game-container [id="vg-menu-panel.conceptCards-outer"]');
  R.conceptCards = { open: !!cards && cards.classList.contains('ch-open'), text: cards ? cards.innerText : null, beatId: C().beatId };
  // 负例 B：只读 1 张就关 → 不推进
  b.chapterRead('panel.conceptCards', 1);
  b.chapterClosePanel('panel.conceptCards');
  R.negativePartialCards = { beatId: C().beatId, requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied) };
  b.chapterRead('panel.conceptCards', 3);
  b.chapterClosePanel('panel.conceptCards');
}
snap('at16');
// ── 1.6 推进交易日（真实点击顶栏按钮）──────────────────────────────────────
{
  const advanceBtn = Array.from(document.querySelectorAll('#broker-shell button'))
    .find((e) => e.innerText.indexOf('进入下一交易日') >= 0);
  R.advanceButton = { found: !!advanceBtn, text: advanceBtn ? advanceBtn.innerText.trim() : null, highlighted: advanceBtn ? advanceBtn.classList.contains('hl') : null, dataHighlight: advanceBtn ? advanceBtn.getAttribute('data-highlight') : null };
  if (advanceBtn) advanceBtn.click();
}
snap('at17');
// ── 1.7 卖出（真实 DOM 点击）+ 已实现盈亏变号 ───────────────────────────────
{
  const sellBtn = Array.from(document.querySelectorAll('#broker-shell button')).find((e) => e.innerText.trim() === '卖出');
  if (sellBtn) sellBtn.click();
  const qtyInput = q('#broker-shell input[inputmode="numeric"]');
  const priceInput = q('#broker-shell input[inputmode="decimal"]');
  // 显式把卖价设为最新价（高于成本 6.28）→ 应为**盈利**，验证 realizedPnL 变号
  if (priceInput) priceInput.value = px('601398').toFixed(2);
  R.sellUi = {
    qtyValue: qtyInput ? qtyInput.value : null,
    priceValue: priceInput ? priceInput.value : null,
    costPrice: (S().positions[0] || {}).avgCost,
    lastPrice: px('601398'),
  };
  const submit = q('#broker-shell button.submit');
  if (submit) submit.click();
  const lo = S().lastOrder || {};
  R.sellUi.lastOrder = { fillPrice: lo.fillPrice, fee: lo.fee, notional: lo.notional, qty: lo.qty, status: lo.status };
}
snap('at18');
{
  const review = q('#game-container [id="vg-menu-panel.review-outer"]');
  R.review = {
    open: !!review && review.classList.contains('ch-open'),
    text: review ? review.innerText : null,
    realizedPnL: S().realizedPnL,
    costPrice: R.sellUi.costPrice,
    fillPrice: R.sellUi.lastOrder.fillPrice,
    sellFee: R.sellUi.lastOrder.fee,
    sellQty: R.sellUi.lastOrder.qty,
    beatId: C().beatId,
    requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  };
  // 负例 C：不关复盘面板 → 不推进
  b.chapterClosePanel(); // 关的是 null → 无操作
  R.negativeReviewOpen = { beatId: C().beatId };
  b.chapterRead('panel.review', 5);
  b.chapterClosePanel('panel.review');
}
snap('at19');
// ── 变号检查：亏本卖出应得负的 realizedPnL ─────────────────────────────────
{
  const before = S().realizedPnL;
  b.advanceDay();                                   // 解锁窗口
  b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  b.advanceDay();                                   // 次日 → 持仓解锁
  const pos = S().positions.find((p) => p.instrumentId === '601398') || {};
  const avg = Number(pos.avgCost) || 0;
  const last = px('601398');
  const limitDown = Number(S().quotes['601398'].limitDown);
  // 限价卖**只有「最新价 ≥ 限价」时才成交**（涨跌停撮合规则）。原实现取 `avg × 0.97`，
  // 一旦两天的随机行情把价格砸下去超过 3%，这张单就挂在那儿不成交 —— 于是 realizedPnL
  // 不动、持仓也卖不掉（本测试曾因此在连续会话中随机失败）。
  // 取 min(均价−0.01, 最新价)：前者保证低于成本（必是亏损），后者保证不高于市价（必成交）；
  // 再用跌停价托底，避免触发拒单 #2。
  const lossPx = Number(Math.max(limitDown + 0.01, Math.min(avg - 0.01, last)).toFixed(2));
  const r = b.submitOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: lossPx, qty: 100 });
  R.signCheck = {
    realizedBefore: before,
    buyAvgCost: avg,
    lastPrice: last,
    limitDown,
    sellPrice: lossPx,
    reasonCode: r.reasonCode,
    status: r.status,
    fillPrice: r.fillPrice,
    fee: r.fee,
    qty: r.qty,
    realizedAfter: S().realizedPnL,
    delta: Number((S().realizedPnL - before).toFixed(2)),
    expectedDelta: Number(((r.fillPrice - avg) * 100 - r.fee).toFixed(2)),
    positionsAfterLossSell: S().positions.map((p) => p.instrumentId + ':' + p.qty),
  };
}
// ── 1.9 章末确认 → 第二章 ──────────────────────────────────────────────────
{
  b.chapterAnswer('1.9.confirm', 't1');
  R.chapter2 = b.chapterConfirm();
  R.finalChapterId = C().chapterId;
  R.finalBeatId = C().beatId;
}

// ── Edge Case 1.4：偏选茅台（预填金额 > 可用资金）────────────────────────────
{
  b.devGotoBeat(1, '1.4');
  const target = rowOf('600519');
  if (target) target.click();
  const overEl = q('#broker-shell .overhint') || Array.from(document.querySelectorAll('#broker-shell *')).find((e) => e.className && String(e.className).indexOf('over') >= 0 && e.innerText && e.innerText.indexOf('超出可用资金') >= 0);
  const qtyInputAfterPick = q('#broker-shell input[inputmode="numeric"]');
  R.maotai = {
    selectedInstrumentId: S().selectedInstrumentId,
    overNoteText: overEl ? overEl.innerText.trim() : null,
    qtyAfterPick: qtyInputAfterPick ? qtyInputAfterPick.value : null,
    rowFlag: lotFlag('600519'),
    rowAffordable: rowOf('600519') ? rowOf('600519').getAttribute('data-affordable') : null,
  };
  // 1.5 的下单面板：以茅台提交（玩家主动越界）
  b.devGotoBeat(1, '1.5');
  b.chapterSelect('600519', { player: true });
  const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '600519', price: px('600519'), qty: 100 });
  R.maotai.rejectResult = { accepted: r.accepted, reasonCode: r.reasonCode };
  R.maotai.cashAfter = S().cash;
  R.maotai.positionsAfter = S().positions.map((p) => p.instrumentId + ':' + p.qty);
}
return R;
