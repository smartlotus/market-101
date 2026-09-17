/**
 * 场景 3（Edge Case「玩家在面板打开时刷新页面」）：
 * 在 1.9 的理解确认面板上作答（保留 `answeredKey`）→ 刷新。
 * 期望：恢复后重新打开同一面板（`panel.confirm`）且 `pendingChoice.answeredKey` 保留。
 */
b.reset();
b.resetChapterProgress();
b.refresh();
walkTo(1, '1.9');
const pcBefore = C().pendingChoice;
b.chapterAnswer(pcBefore ? pcBefore.id : '1.9.confirm', 'limit');   // 错答（只重讲）
return {
  chapterId: C().chapterId,
  beatId: C().beatId,
  panelId: C().panelId,
  openPanels: Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.id),
  pendingChoiceId: (C().pendingChoice || {}).id,
  answeredKey: (C().pendingChoice || {}).answeredKey,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  fingerprint: fingerprint(),
};
