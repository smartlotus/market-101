/**
 * test_copy_compliance —— 文案纪律（六词）/ 评级公式可见 / 无引导纠正文案。
 *
 * 覆盖范围（严格限定，见交付说明）：
 *   ① 六词纪律的**扫描面只有两处**：章末结算面板全文 + A/B/C/D 档位标签。
 *      补救段 / 加演段正文**不在扫描范围内** —— 它们照录 GDD 的市场描述
 *      （例如 `remedial.lowMarketLine`「这一章市场很差…」），扫了必然误报。
 *   ② 「不得用综合评分掩盖算法」：结算面板必须把 rar / maxDD / costRatio 三项输入
 *      与逐步代入值（baseScore / ddPenalty / costPenalty）连同 S、档位一起摊开；
 *      并且存在完整公式查询入口（词典与公式 → 评级公式）。
 *   ③ 拒单回执与教学反馈不得出现「你不该」「建议按导师指引操作」这类纠正 / 引导措辞。
 *
 * 全部走 Runtime API（`vibegame play eval`）＋真实页面 DOM 读取，与玩家点击同一条渲染路径。
 * 返回结构化对象，由 assert_copy_compliance.py 断言。
 */
const b = sceneTree.nodes.get('broker');
const R = {};
const S = () => b.runtimeState();
const C = () => S().chapter;
const scrim = (id) => document.querySelector('#game-container .ch-scrim[data-panel-id="' + id + '"]');
const scrimText = (id) => { const el = scrim(id); return el ? el.innerText : null; };
const openPanels = () => Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open'))
  .map((e) => e.dataset.panelId);
const closeAll = () => { for (const p of openPanels()) b.chapterClosePanel(p); };
const px = (id) => Number(S().quotes[id].lastPrice);
const limitsOf = (id) => S().quotes[id];

// ─── 0. 清档后进入第二章（唯一有章末结算面板的已实现章）───────────────────────
b.reset();
b.resetChapterProgress();
b.refresh();
b.devGotoBeat(2, '2.1');
b.refresh();
R.entered = {
  chapterId: C().chapterId,
  beatId: C().beatId,
  mode: C().mode,
  settlementPanelId: (C().chapterEnd || {}).settlementPanelId,
  rated: (C().chapterEnd || {}).settlementPanelId === 'panel.settlement',
};

// ─── 1. 结算面板：六词纪律 + 公式可见（逐档 A/B/C/D）─────────────────────────
/**
 * 数据侧真值：结算面板声明在 `config/chapters.json` 的 `panel.settlement.blocks[]`。
 * 从章节数据（视图持有的同一份）取出来，供断言逐字比对 —— 不断言渲染出「别的公式」。
 */
R.settlementPanelSpec = (() => {
  try {
    const chs = (b.chapterRoot && b.chapterRoot.dictionary && b.chapterRoot.dictionary.chapters) || [];
    const c2 = chs.find((c) => Number(c.id) === 2) || null;
    const panel = c2 && c2.panels && c2.panels['panel.settlement'];
    return {
      title: (panel && panel.title) || null,
      blocks: ((panel && panel.blocks) || []).map((blk) => ({
        type: blk.type, id: blk.id || null, source: blk.source || null, label: blk.label || null,
        expression: blk.expression || null,
        notes: Array.isArray(blk.notes) ? blk.notes : null,
        rows: Array.isArray(blk.rows) ? blk.rows.map((r) => ({ key: r.key, label: r.label, source: r.source })) : null,
      })),
    };
  } catch (e) { return { err: String(e) }; }
})();

R.grades = {};
for (const grade of ['A', 'B', 'C', 'D']) {
  b.devForceGrade(grade);
  const settled = b.devInjectRatingInputs({
    navSeries: [100000, 105000, 98000, 108000],
    fees: 123.45,
    notional: 50000,
    marketMoveSeries: [0.01, -0.005],
  });
  b.refresh();
  b.chapterOpenPanel('panel.settlement');
  b.refresh();
  const c = C();
  const el = scrim('panel.settlement');
  const rating = c.rating || {};
  R.grades[grade] = {
    forced: grade,
    settledGrade: settled ? settled.grade : null,
    ratingGrade: rating.grade || null,
    S: rating.S,
    rar: rating.rar,
    maxDD: rating.maxDD,
    costRatio: rating.costRatio,
    forcedFlag: rating.forced,
    gradeLine: (c.ratingInputs || {}).gradeLine,
    gradeLabel: (c.ratingInputs || {}).gradeLabel,
    graded: (c.ratingInputs || {}).graded,
    panelId: c.panelId,
    openPanels: openPanels(),
    panelText: el ? el.innerText : null,
    panelUnresolved: el ? Array.from(el.querySelectorAll('[data-ch-unresolved]'))
      .map((e) => e.dataset.chUnresolved) : null,
    expression: el ? (((el.querySelector('.ch-formula .expr') || {}).textContent) || null) : null,
    notes: el ? Array.from(el.querySelectorAll('.ch-formula .notes li')).map((li) => li.textContent) : null,
    kvRows: el ? Array.from(el.querySelectorAll('.ch-kvr')).map((r) => ({
      key: r.dataset.rowKey, source: r.dataset.source, text: r.innerText.replace(/\n/g, ' '),
    })) : null,
    chips: el ? Array.from(el.querySelectorAll('.ch-chip')).map((x) => ({
      key: x.dataset.key, text: x.textContent,
    })) : null,
    bigNumbers: el ? Array.from(el.querySelectorAll('.ch-big')).map((x) => {
      const v = x.querySelector('.v');
      return { source: v ? v.dataset.source : null, text: x.innerText.replace(/\n/g, ' ') };
    }) : null,
    gradeText: el ? ((el.querySelector('[data-block-id="settlement.grade"]') || {}).innerText || null) : null,
  };
  b.chapterClosePanel('panel.settlement');
  closeAll();
  b.refresh();
}
b.devForceGrade(null);
b.refresh();

// 档位标签 / 档位点评的数据真值（档位标签是六词扫描的第二个面）
const chData = (() => {
  try {
    const chs = (b.chapterRoot && b.chapterRoot.dictionary && b.chapterRoot.dictionary.chapters) || [];
    const c2 = chs.find((c) => Number(c.id) === 2) || null;
    return (c2 && c2.settlement) || null;
  } catch (e) { return null; }
})();
R.gradeLabelsData = chData ? chData.gradeLabels : null;
R.gradeLinesData = chData ? chData.gradeLines : null;
// 补救 / 加演段正文（第二章数据）—— 只用于「不得纠正 / 引导」扫描，**不参与六词扫描**
R.segmentsData = chData ? chData.extraSegments : null;
R.ratingThresholds = C().ratingThresholds;
R.ratingParams = C().ratingParams;

// ─── 2. 完整公式查询入口（词典与公式 → 评级公式）──────────────────────────────
R.dictionary = (() => {
  const out = { opened: false };
  const entry = document.querySelector('.ch-dict-entry');
  out.entryExists = !!entry;
  out.entryText = entry ? entry.innerText.replace(/\s+/g, '') : null;
  out.opened = Boolean(b.openDictionary());
  b.refresh();
  const panel = document.querySelector('[data-role="concept-dictionary"]');
  out.panelExists = !!panel;
  out.hiddenOnOpen = panel ? panel.classList.contains('ch-hidden') : null;
  if (!panel) return out;
  const tabs = Array.from(panel.querySelectorAll('.tabs .tab'));
  out.tabs = tabs.map((t) => t.textContent.trim());
  const formulaTab = tabs[1];
  if (formulaTab) formulaTab.click(); // 真实点击，走 _selectTab 同一条路径
  out.tabsAfterClick = Array.from(panel.querySelectorAll('.tabs .tab'))
    .map((t) => t.textContent.trim() + ':' + (t.classList.contains('on') ? 'on' : 'off'));
  out.formulaText = panel.innerText;
  out.formulaExpression = ((panel.querySelector('.ch-formula .expr') || {}).textContent) || null;
  out.formulaNotes = Array.from(panel.querySelectorAll('.ch-formula .notes li')).map((li) => li.textContent);
  out.chips = Array.from(panel.querySelectorAll('.ch-chip')).map((x) => ({
    key: x.dataset.key, text: x.textContent,
  }));
  out.gradeRows = Array.from(panel.querySelectorAll('.ch-grade')).map((g) => ({
    grade: g.dataset.grade,
    on: g.classList.contains('on'),
    rows: Array.from(g.querySelectorAll('.r')).map((r) => r.textContent.trim()),
  }));
  // 档位标签在词典里是 GRADES 每档的**最后一行**（门槛 / 档位点评 / 档位标签）
  out.gradeLabelRows = out.gradeRows.map((g) => ({ grade: g.grade, label: g.rows[g.rows.length - 1] }));
  out.unresolved = Array.from(panel.querySelectorAll('[data-ch-unresolved]')).map((e) => e.dataset.chUnresolved);
  b.openDictionary(); // 再点一次 → 关闭（保持会话干净）
  b.refresh();
  return out;
})();

// ─── 3. 拒单（refusal）文案 ──────────────────────────────────────────────────
R.refusal = (() => {
  const out = { cases: [], ticketTexts: [] };
  b.devGotoBeat(2, '2.6');
  let guard = 0;
  while (!S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
  out.marketOpen = S().isMarketOpen;
  const submit = (tag, spec) => {
    let err = null;
    let r = null;
    try { r = b.submitOrder(spec); } catch (e) { err = String(e); }
    b.refresh();
    const ticket = document.querySelector('#broker-shell .ticket');
    const receipt = ticket ? ticket.querySelector('.result') : null;
    out.cases.push({
      tag,
      status: r && r.status, reasonCode: r && r.reasonCode, rejectText: r && r.rejectText, err,
      receiptText: receipt ? receipt.innerText : null,
      receiptShown: receipt ? getComputedStyle(receipt).display !== 'none' : null,
    });
    if (ticket) out.ticketTexts.push(ticket.innerText);
  };
  submit('funds', { side: 'buy', type: 'market', instrumentId: '601398', qty: 100000 });
  submit('limitRange', {
    side: 'buy', type: 'limit', instrumentId: '601398', price: Number(limitsOf('601398').limitUp) + 1, qty: 100,
  });
  submit('t1Sell', { side: 'sell', type: 'market', instrumentId: '601398', qty: 100 });
  submit('tick', { side: 'buy', type: 'limit', instrumentId: '601398', price: 6.283, qty: 100 });
  submit('lotSize', { side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 150 });
  submit('qtyZero', { side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 0 });
  // 休市拒单：把日历推到周末
  guard = 0;
  while (S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
  out.marketOpenAfterAdvance = S().isMarketOpen;
  submit('closed', { side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
  out.lastOrder = S().lastOrder
    ? { reasonCode: S().lastOrder.reasonCode, rejectText: S().lastOrder.rejectText } : null;
  return out;
})();

// ─── 4. 教学反馈（teaching feedback）文案 ────────────────────────────────────
R.teaching = (() => {
  const out = { choices: [], panels: [], mentorLines: [], segmentTexts: [], dataFeedback: [], dataMentorLines: [] };
  // 2.5 四张规则卡 + 老周的四个问题
  b.devGotoBeat(2, '2.5');
  b.chapterOpenPanel('panel.ruleCards');
  b.refresh();
  out.panels.push({ id: 'panel.ruleCards', text: scrimText('panel.ruleCards') });
  const pc25 = C().pendingChoice;
  if (pc25) {
    out.choices.push({
      id: pc25.id, question: pc25.question, options: pc25.options,
      feedback: pc25.feedbackByOption, correctKey: pc25.correctKey,
    });
  }
  out.mentorLines.push({ at: '2.5', line: (C().mentor || {}).line, speaker: (C().mentor || {}).speaker });
  if (pc25 && pc25.feedbackByOption) {
    const firstKey = Object.keys(pc25.feedbackByOption)[0];
    b.chapterAnswer(pc25.id, firstKey);
    b.refresh();
    out.panels.push({
      id: 'afterAnswer2.5',
      text: (document.querySelector('#chapter-root') || {}).innerText || null,
    });
    out.mentorLines.push({ at: '2.5.answered', line: (C().mentor || {}).line, speaker: (C().mentor || {}).speaker });
    out.feedbackShown = (pc25.feedbackByOption || {})[firstKey] || null;
  }
  closeAll();
  b.refresh();
  // 1.9 章末理解确认（选错只重讲 —— 重讲本身就是教学反馈）
  b.devGotoBeat(1, '1.9');
  b.chapterOpenPanel('panel.confirm');
  b.refresh();
  const pc19 = C().pendingChoice;
  if (pc19) {
    out.choices.push({
      id: pc19.id, question: pc19.question, options: pc19.options,
      feedback: pc19.feedbackByOption, correctKey: pc19.correctKey,
    });
    out.panels.push({ id: 'panel.confirm', text: scrimText('panel.confirm') });
    const wrongKey = Object.keys(pc19.feedbackByOption || {}).find((k) => k !== pc19.correctKey);
    if (wrongKey) {
      b.chapterAnswer(pc19.id, wrongKey);
      b.refresh();
      out.feedbackShown19 = (pc19.feedbackByOption || {})[wrongKey] || null;
      out.panels.push({ id: 'afterWrong1.9', text: (document.querySelector('#chapter-root') || {}).innerText || null });
    }
  }
  out.mentorLines.push({ at: '1.9', line: (C().mentor || {}).line, speaker: (C().mentor || {}).speaker });
  closeAll();
  b.refresh();
  // 教学正文：补救段 / 加演段（**仅用于「不得纠正/引导」扫描**，不参与六词扫描）
  // 注意取的是**第二章**的数据：此处运行时可能已被 devGotoBeat 切回第一章。
  const segs = R.segmentsData || ((C().settlement && C().settlement.extraSegments) || null);
  out.segments = segs;
  if (segs) {
    for (const kind of Object.keys(segs)) {
      const seg = segs[kind] || {};
      out.segmentTexts.push({ kind, label: seg.label || null, text: seg.mentorLine || null });
      out.segmentTexts.push({ kind, label: seg.label || null, text: seg.lowMarketLine || null });
      for (const st of seg.steps || []) {
        out.segmentTexts.push({ kind, label: seg.label || null, text: st.title || null });
        out.segmentTexts.push({ kind, label: seg.label || null, text: st.text || null });
      }
    }
    out.segmentKinds = Object.keys(segs);
  }
  // 数据侧全量教学语料（章节数据里的导师台词 + 每道选择题的每个选项反馈）
  try {
    const chs = (b.chapterRoot && b.chapterRoot.dictionary && b.chapterRoot.dictionary.chapters) || [];
    for (const ch of chs) {
      for (const beat of ch.beats || []) {
        for (const m of beat.mentor || []) if (m && m.line) out.dataMentorLines.push({ chapter: ch.id, beat: beat.id, line: m.line });
      }
      const choices = ch.choices || {};
      for (const key of Object.keys(choices)) {
        const ch2 = choices[key] || {};
        for (const o of ch2.options || []) {
          if (o && o.feedback) out.dataFeedback.push({ choice: key, option: o.key, feedback: o.feedback });
          if (o && o.text) out.dataFeedback.push({ choice: key, option: o.key, feedback: o.text });
        }
        if (ch2.question) out.dataFeedback.push({ choice: key, option: 'question', feedback: ch2.question });
      }
    }
  } catch (e) { out.dataErr = String(e); }
  return out;
})();

return R;
