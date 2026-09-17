/** 场景 1 的刷新后读数（与 01_before.js 的 fingerprint 逐字段比对）。 */
return {
  chapterId: C().chapterId,
  beatId: C().beatId,
  beatIndex: C().beatIndex,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  fingerprint: fingerprint(),
  save: C().save,
  // 存档确实来自 localStorage（不是内存态）
  rawSaveExists: (() => { try { return !!window.localStorage.getItem('market-101.save.v1'); } catch (e) { return null; } })(),
};
