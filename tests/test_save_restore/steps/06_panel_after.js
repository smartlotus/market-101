/** 场景 3 的刷新后读数：同一面板重新打开、`answeredKey` 保留、节拍仍在 1.9。 */
const pc = C().pendingChoice;
return {
  chapterId: C().chapterId,
  beatId: C().beatId,
  panelId: C().panelId,
  openPanels: Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.id),
  pendingChoiceId: pc && pc.id,
  answeredKey: pc && pc.answeredKey,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  // 世界层面（除面板外）也应完整恢复
  fingerprint: fingerprint(),
};
