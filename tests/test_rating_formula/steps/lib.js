/**
 * 共享驱动库（被 drive.js 用 `eval` 前置拼接）—— 只做两件事：
 *   1) 把章节推进到第二章（评级窗口所在章，`rated=true`）；
 *   2) 提供「注入评级输入 → 读回 rating / ratingInputs」的探针外壳。
 *
 * 为什么在每个探针前都切到 `freeDay`：`settle()` 会先 `_syncFromWorld()` → `noteNav()` →
 * `_sample()` 把**真实 NAV** 追加为采样点，从而污染注入的 `navSeries`（评级窗口的采样只在
 * `mode==='chapter'` 时发生）。测试要断言的是「给定输入的公式输出」，因此需要一条不含
 * 隐式追加的通道；`freeDay` 下注入即所见，且 §3.2 本身要求自由窗口的采样不进评级窗口，
 * 这条路径是产品语义的一部分，不是测试后门。
 */
const b = sceneTree.nodes.get('broker');
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
  if (r.kind === 'select') return b.selectInstrument(r.instrumentId || b.sim.selectCheapestAffordable());
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
    if (!todo.length) break;
    dispatch(todo[0], beat, s);
  }
  return { chapterId: C().chapterId, beatId: C().beatId, steps: guard };
}

function toCh2() {
  b.reset();
  b.resetChapterProgress();
  b.refresh();
  walkTo(1, '1.9');
  b.chapterAnswer('1.9.confirm', 't1');
  b.chapterConfirm();
  return { chapterId: C().chapterId, beatId: C().beatId };
}

/** 注入一组评级输入并读回结果。`mode` 缺省 'freeDay'（见文件头说明）。 */
function probe(input, { mode = 'freeDay' } = {}) {
  const entered = toCh2();
  if (mode !== 'chapter') b.setMode(mode);
  const settled = b.devInjectRatingInputs(input);
  const c = C();
  return {
    entered,
    mode: c.mode,
    input,
    settled: settled ? { rar: settled.rar, maxDD: settled.maxDD, costRatio: settled.costRatio, S: settled.S, grade: settled.grade, marketMove: settled.marketMove, beatenMarket: settled.beatenMarket } : null,
    rating: c.rating,
    inputs: c.ratingInputs,
    extra: c.extraSegment ? { kind: c.extraSegment.kind, origin: c.extraSegment.origin } : null,
  };
}

/** S = clamp(50 + rar×833, 0, 100) 的目标反解：给定目标 S，返回需要的 rar。 */
const rarFor = (targetS) => (targetS - 50) / 833;
