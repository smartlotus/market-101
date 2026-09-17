/** 场景 2 的刷新后读数：应回到 2.6 起点，四项 require 全部未满足。 */
return {
  beatId: C().beatId,
  beatIndex: C().beatIndex,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  allUnsatisfied: (C().beatRequirements || []).every((r) => !r.satisfied),
  save: C().save,
};
