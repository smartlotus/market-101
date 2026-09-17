// 探针 B1 —— 解锁独立性 + 评级注入 + 存档结构（结构化证明：派生量不落盘）
const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const out = [];
const chk = (name, ok, got) => out.push({ name, ok: Boolean(ok), got });

// ---- 走完第一章（唯一解锁路径：confirmChapter 成功）----
b.reset();
b.resetChapterProgress();
b.refresh();

function pushBeat() {
  const s = C();
  const todo = ((s.beat && s.beat.require) || []).filter(
    (r) => !((s.beatRequirements || []).find((x) => x.id === r.id) || {}).satisfied);
  if (!todo.length) return false;
  b.devSatisfy(todo[0].id);
  return true;
}
let guard = 0;
while (C().chapterId === 1 && C().beatId !== '1.9' && guard < 300) { guard += 1; if (!pushBeat()) break; }
guard = 0;
while (!C().chapterEndReached && C().chapterId === 1 && guard < 60) { guard += 1; if (!pushBeat()) break; }
const conf = b.chapterConfirm();

const afterCh1 = {
  conf,
  unlockedChapters: C().unlockedChapters.slice(),
  unlockedInstruments: C().unlockedInstruments.slice(),
  grades: JSON.stringify(C().grades),
  moneyTier: C().moneyTier,
  standing: C().graduationStanding,
};
chk('走完第一章 → unlockedChapters=[1]', JSON.stringify(afterCh1.unlockedChapters) === '[1]', afterCh1.unlockedChapters);
chk('派生 unlockedInstruments=[601398]（来自章数据 unlocks）',
  JSON.stringify(afterCh1.unlockedInstruments) === '["601398"]', afterCh1.unlockedInstruments);
chk('初始本金由配置注入（100000），不是脚本字面量',
  afterCh1.standing.initialCapital === 100000, afterCh1.standing.initialCapital);
chk('第一章不打分 → 评级记录为空', afterCh1.grades === '{}', afterCh1.grades);

// ---- 注入极端评级：解锁集合必须一字不变 ----
const gradesIn = b.devSetChapterGrades({ 1: 'D', 2: 'D', 3: 'D', 5: 'D', 6: 'D', 7: 'D', 8: 'D' });
const afterGrades = {
  unlockedChapters: C().unlockedChapters.slice(),
  unlockedInstruments: C().unlockedInstruments.slice(),
  tier: C().graduationStanding.tier,
  gradedCount: C().graduationStanding.gradedCount,
};
chk('注入 7 个 D → 解锁集合不变（章节 + 品种）',
  JSON.stringify(afterGrades.unlockedChapters) === JSON.stringify(afterCh1.unlockedChapters) &&
  JSON.stringify(afterGrades.unlockedInstruments) === JSON.stringify(afterCh1.unlockedInstruments),
  afterGrades);
chk('注入 7 个 D → 档位跌到结业（评级确实生效，只是不动解锁）',
  afterGrades.tier === '结业' && afterGrades.gradedCount === 7, afterGrades);

// ---- 注入近零 NAV（走 NAV 的唯一入口 noteNav）：解锁集合仍必须一字不变 ----
b.setMode('sandbox');
b.chapter.noteNav(1234);
b.refresh();
const afterNav = {
  moneyTier: C().moneyTier,
  unlockedChapters: C().unlockedChapters.slice(),
  unlockedInstruments: C().unlockedInstruments.slice(),
  tier: C().graduationStanding.tier,
  adjusted: C().graduationStanding.adjustedCumReturn,
};
chk('NAV 掉到 ¥1,234（红档）→ 解锁集合不变',
  JSON.stringify(afterNav.unlockedChapters) === JSON.stringify(afterCh1.unlockedChapters) &&
  JSON.stringify(afterNav.unlockedInstruments) === JSON.stringify(afterCh1.unlockedInstruments) &&
  afterNav.moneyTier === 'red',
  afterNav);
chk('近零 NAV → 调整后收益接近 −0.99（评定读到钱了，解锁没读）',
  afterNav.adjusted < -0.98 && afterNav.adjusted > -0.99, afterNav.adjusted);

// ---- 反方向：把评级拉满 + NAV 拉高，解锁集合仍然不变 ----
b.devSetChapterGrades({ 1: 'A', 2: 'A', 3: 'A', 5: 'A' });
b.chapter.noteNav(500000);
b.refresh();
const afterHigh = {
  tier: C().graduationStanding.tier,
  adjusted: C().graduationStanding.adjustedCumReturn,
  unlockedChapters: C().unlockedChapters.slice(),
  unlockedInstruments: C().unlockedInstruments.slice(),
};
chk('4 个 A + NAV ¥500,000 → 优秀',
  afterHigh.tier === '优秀' && afterHigh.adjusted === 4, afterHigh);
chk('评级拉满 + NAV 拉高 → 解锁集合仍然一字不变',
  JSON.stringify(afterHigh.unlockedChapters) === JSON.stringify(afterCh1.unlockedChapters) &&
  JSON.stringify(afterHigh.unlockedInstruments) === JSON.stringify(afterCh1.unlockedInstruments),
  { unlockedChapters: afterHigh.unlockedChapters, unlockedInstruments: afterHigh.unlockedInstruments });

// ---- 存档结构：派生量不落盘（无第二份真相）----
b.devSetChapterGrades({ 2: 'A', 3: 'B' });
b.chapter.noteNav(100000);
b.save ? b.save() : null;
const raw = JSON.parse(localStorage.getItem('market-101.save.v1') || 'null');
const cav = (raw && raw.chapter) || {};
chk('存档里没有 unlockedInstruments（派生量不落盘）', !('unlockedInstruments' in cav), Object.keys(cav));
chk('存档里没有 graduationStanding（评定不落盘）', !('graduationStanding' in cav));
chk('存档里有 chapterGrades（评级记录持久化）', JSON.stringify(cav.chapterGrades) === '{"2":"A","3":"B"}', cav.chapterGrades);
chk('存档里有 injectionsTotal / unlockedChapters', 'injectionsTotal' in cav && JSON.stringify(cav.unlockedChapters) === '[1]', {
  injectionsTotal: cav.injectionsTotal, unlockedChapters: cav.unlockedChapters,
});
chk('mentor 子树仍然只有那三个键（导师无隐藏层）',
  JSON.stringify(Object.keys(cav.mentor || {}).sort()) === '["explainCounts","muted","proactiveEnabled"]', cav.mentor);

return { pass: out.filter((r) => r.ok).length, total: out.length, fails: out.filter((r) => !r.ok), afterCh1, afterNav, afterHigh };
