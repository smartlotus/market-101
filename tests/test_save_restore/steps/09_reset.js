/** 场景 5（§4 Reset）：章节进度重置 → 回 1.0、清空章内状态与存档。 */
b.reset();
b.resetChapterProgress();
b.refresh();
toCh2();
b.devGotoBeat(2, '2.6');
// 先让章内状态非空（概念 / 规则卡 / 评级），否则「清空」无从断言
b.chapterOpenPanel('panel.ruleCards');
b.chapterRead('panel.ruleCards', 4);
b.chapterClosePanel('panel.ruleCards');
b.devInjectRatingInputs({ navSeries: [100000, 110000], fees: 0, notional: 0 });
const before = {
  chapterId: C().chapterId, beatId: C().beatId,
  conceptsIntroduced: C().conceptsIntroduced.slice(),
  ruleCardsSeen: C().ruleCardsSeen.slice(),
  rating: C().rating,
  save: C().save,
};
b.resetChapterProgress();
const after = {
  chapterId: C().chapterId, beatId: C().beatId, beatIndex: C().beatIndex,
  conceptsIntroduced: C().conceptsIntroduced.slice(),
  ruleCardsSeen: C().ruleCardsSeen.slice(),
  rating: C().rating,
  save: C().save,
  completedBeats: C().completedBeats.slice(),
  extraSegment: C().extraSegment,
  remedialUsedThisChapter: C().remedialUsedThisChapter,
  ratingInputsGrade: C().ratingInputs ? C().ratingInputs.graded : null,
};
const rawSave = (() => { try { return window.localStorage.getItem('market-101.save.v1'); } catch (e) { return null; } })();
return { before, after, rawSaveAfterReset: rawSave };
