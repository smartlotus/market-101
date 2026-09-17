const b = sceneTree.nodes.get('broker');
const C = () => b.runtimeState().chapter;
const DICT = () => document.querySelector('[data-role="concept-dictionary"]');
const out = {};

b.setMuted(false);
b.chapter.setProactiveEnabled(true);
b.resetChapterProgress(); // 干净起点：第一章、无解锁、无历史

// ── 1) 词典：章节绑定标签 + 未走到章节的条目点开有正文 + 无禁用/灰行 ──────────────
b.openDictionary();
const tabs = DICT().querySelectorAll('.tabs .tab');
tabs[0].click(); // 切到「概念」页，保证索引按当前状态渲染
const rows = () => Array.from(DICT().querySelectorAll('.idx .entry'));
const nex = rows().filter((e) => e.classList.contains('nex'));
out.nexCount = nex.length;
out.nexSample = nex.slice(0, 3).map((e) => e.dataset.conceptKey);
out.nexLabelShown = nex.length ? nex[0].innerText.includes('下一章你会用到它') : null;
out.greyedRows = Array.from(DICT().querySelectorAll('.entry')).filter((e) => e.classList.contains('locked')).length;
out.foldedKeys = rows().filter((e) => e.classList.contains('folded')).map((e) => e.dataset.conceptKey);

const detailText = () => (DICT().querySelector('.detail') || {}).innerText || '';
const clickRow = (key) => { const r = rows().find((e) => e.dataset.conceptKey === key); if (r) r.click(); return !!r; };
// 「资产配置」属第三章（未走到）→ 列表带标签，点开后必须是完整正文（def/explain/metaphor 都在）
out.clickedNexRow = clickRow('资产配置');
out.nexDetail = detailText().slice(0, 200);
const concept = (k) => b.chapterRoot.dictionary.concepts.find((c) => c.key === k);
out.nexDetailHasDef = !!concept('资产配置').def && detailText().includes(concept('资产配置').def);

// ── 2) 搜索只扫 key / name / topic；折叠中的进阶条目不得泄露正文 ────────────────
const search = DICT().querySelector('.search input');
const setQ = (v) => { search.value = v; search.dispatchEvent(new Event('input', { bubbles: true })); };
const adv = concept('市净率PB'); // advanced=true 且当前折叠
const bodyWord = String(adv.def).slice(2, 8);
setQ(bodyWord);
out.searchByBodyText = { word: bodyWord, hits: rows().map((e) => e.dataset.conceptKey) };
setQ('市净率');
out.searchByName = rows().map((e) => e.dataset.conceptKey);
clickRow('市净率PB');
out.foldedDetail = detailText();
out.foldedDetailLeaksBody = detailText().includes(adv.def) || detailText().includes(adv.explain);
setQ('');
b.openDictionary(); // 关掉

// ── 3) 追问：两问都有回应，且**不含任何指令** ────────────────────────────────
const DIRECTIVE = /你应该(买|卖|加仓|减仓)|建议(买|卖|加仓|减仓)|应该(买|卖)入|果断(买|卖)/;
const asks = {};
for (const q of ['meaning', 'action']) {
  const r = b.callMentor({ question: q });
  asks[q] = { ok: r && r.ok, question: r && r.question, line: r && r.line, directive: DIRECTIVE.test(String((r && r.line) || '')) };
}
const bare = b.callMentor();
out.asks = asks;
out.bareCall = { ok: bare.ok, line: bare.line };
out.askBackLabels = ['meaning', 'action'].map((k) => (C().copy.askBack[k] || {}).label);
out.directiveHits = Object.entries(asks).filter(([, v]) => v.directive).map(([k]) => k);

// ── 4) 对话历史：有序、带章 / 拍 / 来源 ──────────────────────────────────────
const hist = C().mentorHistory;
out.histLen = hist.length;
out.histFirst = hist[0];
out.histLast = hist[hist.length - 1];
out.histSources = Array.from(new Set(hist.map((e) => e.source)));
out.histOrdered = hist.every((e, i) => i === 0 || typeof e.line === 'string');
out.histAllHaveBeat = hist.every((e) => typeof e.chapterId === 'number' && typeof e.beatId === 'string' && !!e.line);
out.mentorSnapKeys = Object.keys(C().mentor).sort();
out.histTagsForUI = (() => {
  b.openMentorHistory();
  b.refresh();
  const panel = document.querySelector('[data-role="mentor-history"]');
  const dom = { open: panel && !panel.classList.contains('ch-hidden'), rows: panel ? panel.querySelectorAll('.hist-row').length : 0, firstMeta: panel && panel.querySelector('.hist-meta') ? panel.querySelector('.hist-meta').innerText : null, firstLine: panel && panel.querySelector('.hist-line') ? panel.querySelector('.hist-line').innerText : null, sourceTagged: panel ? !!panel.querySelector('.hist-row[data-source]') : false };
  b.openMentorHistory();
  return dom;
})();

// ── 5) 空状态：重置后历史为空，面板给一句中性文案（不是错误） ─────────────────
b.resetChapterProgress();
b.openMentorHistory();
b.refresh();
const hp = document.querySelector('[data-role="mentor-history"]');
out.emptyState = {
  histLen: C().mentorHistory.length,
  emptyEl: hp ? (hp.querySelector('.hist-empty') ? hp.querySelector('.hist-empty').innerText : null) : 'NO_PANEL',
  rows: hp ? hp.querySelectorAll('.hist-row').length : null,
  expected: C().copy.historyEmpty,
};
b.openMentorHistory();
return out;
