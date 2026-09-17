/**
 * 场景 1（§3.1）：在 `savePoint` 节拍完成后刷新 → 恢复到「最后完成节拍之后」那一拍的起点，
 * 且世界（cash / inGameDate / quotes / eventDeck / 持仓 / 净值史）与刷新前逐字节一致。
 *
 * 2.2 是 `savePoints` 里声明的存档拍；走到 2.2 完成 → 应落在 2.3 起点。
 */
toCh2();
walkTo(2, '2.2');
{
  const s = C();
  const todo = (s.beat.require || []).filter((r) => !reqDone(s, r.id));
  for (const r of todo) dispatch(r, s.beat || {}, C());
}
return {
  chapterId: C().chapterId,
  beatId: C().beatId,
  beatIndex: C().beatIndex,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  fingerprint: fingerprint(),
  save: C().save,
};
