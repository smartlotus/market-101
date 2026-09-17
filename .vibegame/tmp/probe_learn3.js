const b = sceneTree.nodes.get('broker');
const C = () => b.runtimeState().chapter;
const out = {};
// 走进第二章（第一章的理解确认 + 章末确认）
b.setMuted(false);
b.chapter.setProactiveEnabled(true);
b.resetChapterProgress();
b.devGotoBeat(1, '1.9');
b.chapterAnswer('1.9.confirm', 't1');
const conf = b.chapterConfirm();
out.confirm = { ok: conf.ok, entered: conf.entered, chapterId: C().chapterId, unlockedChapters: C().unlockedChapters };
b.openDictionary();
const tabs = document.querySelectorAll('[data-role="concept-dictionary"] .tabs .tab');
tabs[0].click();
const row = (k) => Array.from(document.querySelectorAll('.idx .entry')).find((e) => e.dataset.conceptKey === k);
const nexOf = (k) => (row(k) ? row(k).classList.contains('nex') : 'MISSING');
out.binding = {
  ch1Key_bank: nexOf('银行'),
  ch1Advanced_limitOrder: nexOf('限价单'),
  ch2Key_limitDown: nexOf('涨跌停'),
  ch3Key_assetAlloc: nexOf('资产配置'),
  ch4Key_custody: nexOf('存管'),
};
// 留一个可跨刷新验证的状态：静音开 + 两句台词
b.setMuted(true);
b.callMentor({ question: 'meaning' });
b.setMuted(false);
b.callMentor({ question: 'action' });
out.handoff = { historyLen: C().mentorHistory.length, muted: C().mentor.muted, proactive: C().mentor.proactiveEnabled, unlocked: C().unlockedChapters, last: C().mentorHistory[C().mentorHistory.length - 1], sources: Array.from(new Set(C().mentorHistory.map((e) => e.source))) };
b.openDictionary();
return out;
