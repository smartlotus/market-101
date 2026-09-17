const b = sceneTree.nodes.get('broker');
const C = () => b.runtimeState().chapter;
const out = {};

// 让下一个会话可验证：清一次，再走两步（1.0 → 1.1）、静音开、非剧情开关关
b.setMuted(false);
b.chapter.setProactiveEnabled(true);
b.resetChapterProgress();
b.chapterAck('1.0.start');
b.callMentor({ question: 'meaning' });
const before = C().mentorHistory;

// ── 6) 静音边界：勾剧情 / 功能性台词照常，概念讲解被吞 ─────────────────────────
b.setMuted(true);
b.devGotoBeat(1, '1.0'); // 回到 1.0（不重放开场台词）
b.chapterAck('1.0.start'); // → 1.1「银行」首遇讲解（非剧情发言）→ 必须被吞
const mutedFirstConcept = { line: C().mentor.line, reason: b.chapter.mentor.request({ timing: 'firstConcept', conceptKey: '银行', mode: 'chapter' }).reason };
b.devGotoBeat(1, '1.0');
b.resetChapterProgress(); // 静音下的**章开场**（剧情台词）→ 必须照常出现
const mutedChapterOpen = { line: C().mentor.line, source: C().mentor.source };
out.muteScope = { mutedFirstConcept, mutedChapterOpen, chapterOpenAppears: !!mutedChapterOpen.line, firstConceptSilent: mutedFirstConcept.line === null };
b.setMuted(false);

// ── 7) 「关闭非剧情发言」：关掉讲解 / 提示，但剧情对白与功能性台词照常 ─────────
b.chapter.setProactiveEnabled(false);
b.resetChapterProgress();
const proactiveOffOpen = { line: C().mentor.line };
b.chapterAck('1.0.start');
const proactiveOffFirstConcept = { line: C().mentor.line, reason: b.chapter.mentor.request({ timing: 'firstConcept', conceptKey: '银行', mode: 'chapter' }).reason };
b.chapter.setProactiveEnabled(true);
out.proactiveOff = { openLine: proactiveOffOpen.line, conceptLine: proactiveOffFirstConcept.line, conceptReasonWhenMuted: null };
out.proactiveOffReason = proactiveOffFirstConcept.reason;

// ── 8) 风险警示线：freeDay 触线 → 经 isRiskWarning 路径开口；sandbox 闭嘴 ──────
b.setMode('freeDay');
b.chapter.noteNav(9000);
const fd = { line: C().mentor.line, source: C().mentor.source, mode: C().mode };
const dataRiskLine = C().copy.riskLine;
b.setMode('sandbox');
b.chapter.noteNav(4000);
const sb = { line: C().mentor.line, mode: C().mode };
out.riskWarning = { freeDay: fd, sandbox: sb, matchesData: fd.line === dataRiskLine, spokeInSandbox: !!sb.line };
b.setMode('chapter');

// ── 9) 空历史状态：中性文案，不是错误 ────────────────────────────────────────
b.chapter.mentorHistory = [];
b.openMentorHistory();
b.refresh();
const hp = document.querySelector('[data-role="mentor-history"]');
out.emptyState = {
  histLen: C().mentorHistory.length,
  emptyText: hp && hp.querySelector('.hist-empty') ? hp.querySelector('.hist-empty').innerText : 'NO_EMPTY_EL',
  rows: hp ? hp.querySelectorAll('.hist-row').length : null,
  matchesData: !!hp && !!hp.querySelector('.hist-empty') && hp.querySelector('.hist-empty').innerText === C().copy.historyEmpty,
  hasErrorCue: !!hp && /错误|失败|异常/.test(hp.innerText),
};
b.openMentorHistory();

// ── 10) 章节绑定：走过第一章后其条目不再是「下一章你会用到它」 ────────────────
b.resetChapterProgress();
for (const beat of ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.5.5', '1.6', '1.7', '1.8', '1.9']) {
  b.devGotoBeat(1, beat);
  for (const r of (C().beat.requirements || [])) if (r.id !== 'never') b.devSatisfy(r.id);
}
const confirmed = b.chapterConfirm();
b.openDictionary();
const tabs = document.querySelectorAll('[data-role="concept-dictionary"] .tabs .tab');
tabs[0].click();
const rowOf = (k) => Array.from(document.querySelectorAll('.idx .entry')).find((e) => e.dataset.conceptKey === k);
out.chapterBinding = {
  confirm: confirmed,
  unlockedChapters: C().unlockedChapters,
  chapterId: C().chapterId,
  bankNex: rowOf('银行') ? rowOf('银行').classList.contains('nex') : 'MISSING',
  ch2Nex: rowOf('限价单') ? rowOf('限价单').classList.contains('nex') : 'MISSING',
  ch3Nex: rowOf('资产配置') ? rowOf('资产配置').classList.contains('nex') : 'MISSING',
  ch4Nex: rowOf('机构与生态') && rowOf('机构与生态') ? rowOf('机构与生态').classList.contains('nex') : 'NO_SUCH_KEY',
  advancedUnlocked: C().advancedUnlocked,
};
b.openDictionary();

// 收尾：留下一个可被下一个 eval / 刷新验证的状态
b.resetChapterProgress();
b.setMuted(false);
b.chapter.setProactiveEnabled(true);
b.chapterAck('1.0.start');
b.callMentor({ question: 'action' });
out.persistHandoff = { historyLen: C().mentorHistory.length, muted: C().mentor.muted, proactive: C().mentor.proactiveEnabled, unlocked: C().unlockedChapters };
out.savedKeys = Object.keys(b.chapter.toJSON());
return out;
