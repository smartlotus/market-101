const b = sceneTree.nodes.get('broker');
const log = [];
const snap = (tag) => {
  const st = b.runtimeState();
  const c = st.chapter;
  log.push({ tag, beatId: c.beatId, chapterId: c.chapterId, panelId: c.panelId, mode: c.mode, reqs: (c.beatRequirements || []).map((r) => r.kind + ':' + r.id + '=' + r.satisfied), rating: c.rating, remaining: c.remainingBeats, extra: c.extraSegment });
};
snap('t0');
const r = b.chapterConfirm();
log.push({ tag: 'confirm result', r: r ? { ok: r.ok, next: r.next, chapterId: r.chapterId } : null });
snap('after confirm');
// 试一次 chapterEndPhase（若还需要）
try { log.push({ tag: 'endPhase', p: b.chapterEndPhase() }); } catch (e) { log.push({ tag: 'ERR endPhase', err: String(e) }); }
snap('after endPhase');
return log;
