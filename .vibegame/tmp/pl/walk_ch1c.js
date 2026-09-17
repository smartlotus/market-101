const b = sceneTree.nodes.get('broker');
const log = [];
const snap = (tag) => {
  const st = b.runtimeState();
  const c = st.chapter;
  log.push({
    tag,
    beatId: c.beatId,
    chapterId: c.chapterId,
    beatIndex: c.beatIndex,
    panelId: c.panelId,
    mode: c.mode,
    shellMode: c.shellMode,
    reqs: (c.beatRequirements || []).map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    choice: c.pendingChoice ? { id: c.pendingChoice.id, ans: c.pendingChoice.answeredKey, opts: (c.pendingChoice.options || []).map((o) => o.key), fb: c.pendingChoice.feedbackByOption } : null,
    mentorLine: c.mentor && c.mentor.line,
    goalCard: c.goalCard,
  });
};
snap('before review close');
try { b.chapterClosePanel('panel.review'); } catch (e) { log.push({ tag: 'ERR closeReview', err: String(e) }); }
snap('after review close');
// 1.9 面板自动打开，尝试错误答案
const c1 = b.runtimeState().chapter.pendingChoice;
log.push({ tag: 'choice19', c: c1 });
if (c1) {
  b.chapterAnswer(c1.id, 'wrong');
}
snap('after wrong answer');
const c2 = b.runtimeState().chapter.pendingChoice;
if (c2 && c2.options && c2.options.length) {
  // 试第二个选项
  const keys = c2.options.map((o) => o.key);
  const wrongKey = keys[keys.length - 1];
  b.chapterAnswer(c2.id, wrongKey);
}
snap('after last option');
const c3 = b.runtimeState().chapter.pendingChoice;
if (c3 && c3.options && c3.options.length) {
  const keys = c3.options.map((o) => o.key);
  b.chapterAnswer(c3.id, keys[0]);
}
snap('after first option');
return log;
