const b = sceneTree.nodes.get('broker');
const C = () => b.runtimeState().chapter;
const hist = C().mentorHistory;
return {
  chapterId: C().chapterId,
  beatId: C().beatId,
  unlockedChapters: C().unlockedChapters,
  historyLen: hist.length,
  historyOrderedIntact: hist.every((e, i) => (i === 0 || typeof e.line === 'string') && typeof e.source === 'string'),
  sources: Array.from(new Set(hist.map((e) => e.source))),
  last: hist[hist.length - 1],
  first: hist[0],
  muted: C().mentor.muted,
  proactiveEnabled: C().mentor.proactiveEnabled,
  saveExists: C().save.exists,
  mentorKeys: Object.keys(C().mentor).sort(),
  advancedUnlocked: C().advancedUnlocked,
};
