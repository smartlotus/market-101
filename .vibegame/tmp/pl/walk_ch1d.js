const b = sceneTree.nodes.get('broker');
const log = [];
const snap = (tag) => {
  const st = b.runtimeState();
  const c = st.chapter;
  log.push({
    tag, beatId: c.beatId, chapterId: c.chapterId, panelId: c.panelId, mode: c.mode,
    reqs: (c.beatRequirements || []).map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    choice: c.pendingChoice ? { id: c.pendingChoice.id, ans: c.pendingChoice.answeredKey, opts: (c.pendingChoice.options || []).map((o) => o.key) } : null,
  });
};
snap('t0');
b.chapterOpenPanel('panel.review');
snap('reopened review');
b.chapterRead('panel.review', 2);
snap('read2');
b.chapterRead('panel.review', 3);
snap('read5');
b.chapterClosePanel('panel.review');
snap('closed review');
// 现在应该到 1.9，面板自动打开
const c1 = b.runtimeState().chapter.pendingChoice;
log.push({ tag: 'choice19', c: c1 });
if (c1) { b.chapterAnswer(c1.id, '__nope__'); }
snap('after bogus key');
const c2 = b.runtimeState().chapter.pendingChoice;
if (c2 && c2.options) {
  const keys = c2.options.map((o) => o.key);
  log.push({ tag: 'keys', keys });
  for (const k of keys) { b.chapterAnswer(c2.id, k); log.push({ tag: 'answer ' + k, after: (b.runtimeState().chapter.pendingChoice || {}).answeredKey, beat: b.runtimeState().chapter.beatId }); }
}
snap('after all options');
return log;
