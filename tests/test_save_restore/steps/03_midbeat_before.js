/**
 * 场景 2（Edge Case「存档落在节拍中途」）：在 2.6 只满足 4 项要求中的 1 项 → 存档 → 刷新。
 * 期望：恢复到 2.6 的**起点**，四项 require 全部未满足（节拍中途不设中间存档）。
 *
 * 存档用 `chapter.save()` —— 与每个存档点（拍完成 / 面板打开 / 模式切换 / 补足本金 / 结算）
 * 调用的是同一个方法；这里直接调是为了把「半完成态」精确钉在写入的那一刻。
 */
toCh2();
// 直接落到 2.6：它有四项 `submit` 要求，是「半完成态」最干净的观察点。
// （2.5 的选择题在 UI 上不可达，见 `# Player` 报告的缺陷 2，走不动到 2.6。）
b.devGotoBeat(2, '2.6');
{
  const s = C();
  const todo = (s.beat.require || []).filter((r) => !reqDone(s, r.id));
  dispatch(todo[0], s.beat || {}, C());      // 只完成第 1 项（限价买）
}
const midway = {
  beatId: C().beatId,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  lastOrder: S().lastOrder && S().lastOrder.reasonCode,
};
b.chapter.save();
return {
  midway,
  beatId: C().beatId,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  save: C().save,
};
