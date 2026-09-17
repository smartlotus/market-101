/**
 * 场景 4（B2 回归：`chapterRejectSeen` 必须跨刷新存活）：
 * 走完 2.1–2.5（四次拒单由玩家提交撞出来）停在 2.6，刷新，然后提交 2.6 要求的四类合法委托。
 * 2.6 **没有 `giveUp` 出口** —— 若「本章见过拒单」这个标记在刷新后丢失，
 * `2.6.correctedLimit`（`corrected: true`）将永不可满足，第二章就再也结不了章。
 *
 * 2.5 的选择题在 UI 上不可达（见 `# Player` 报告的缺陷 2），因此这里用 `chapterAnswer`
 * 钩子作答 —— 它和面板按钮走的是同一个 `chapterAnswer` 回调。
 */
b.reset();
b.resetChapterProgress();
b.refresh();
toCh2();
walkTo(2, '2.5');
{
  const s = C();
  const todo = (s.beat.require || []).filter((r) => !reqDone(s, r.id));
  for (const r of todo) {
    if (r.kind === 'choice') { b.chapterAnswer('2.5.fourRules', 'restrict'); continue; }
    dispatch(r, s.beat || {}, C());
  }
}
const at25 = { beatId: C().beatId, requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied) };
// 2.5 完成 → 应停在 2.6 起点
const rejected = (() => {
  const ids = [];
  for (let i = 0; i < 6 && C().beatId !== '2.6'; i += 1) {
    const s = C();
    const todo = (s.beat.require || []).filter((r) => !reqDone(s, r.id));
    if (!todo.length) break;
    dispatch(todo[0], s.beat || {}, C());
    ids.push(S().lastOrder && S().lastOrder.reasonCode);
  }
  return ids;
})();
// 若是休市日，推进到开市日再交单（2.6 要求的是「合法委托」，不是拒单）
let guard = 0;
while (!S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
return {
  at25,
  rejected,
  beatId: C().beatId,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  save: C().save,
  rawSave: (() => { try { const raw = window.localStorage.getItem('market-101.save.v1'); return raw ? Object.keys(JSON.parse(raw).chapter || {}) : null; } catch (e) { return null; } })(),
};
