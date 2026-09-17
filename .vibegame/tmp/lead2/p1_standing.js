// 探针 A —— `standing.js` 纯函数模块：三档、公式逐字、以及「补钱不能提升这个数字」
const { computeStanding, adjustedCumulativeReturn, STANDING_THRESHOLDS } = await import('/scripts/chapter/standing.js');

const CAP = 100000;
const out = [];
const chk = (name, ok, got) => out.push({ name, ok: Boolean(ok), got });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const s = (o) => computeStanding(o);
const base = { finalNav: 0, injectionsTotal: 0, initialCapital: CAP };
const mk = (o) => ({ ...base, ...o });

// 1) 三档 —— 优秀（A ≥ 4 且 调整后收益 > 0）
const merit = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'A', 6: 'A', 7: 'B' }, finalNav: 120000 }));
chk('优秀：A=4 且调整后收益 +20%', merit.tier === '优秀' && merit.adjustedCumReturn === 0.2, {
  tier: merit.tier, r: merit.adjustedCumReturn, a: merit.countA,
});
// 2) 优秀 不成立 → 良好（A ≥ 4 但收益不为正）
const meritNo = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'A', 6: 'A' }, finalNav: 90000 }));
chk('A=4 但收益为负 → 良好（不是优秀）', meritNo.tier === '良好' && meritNo.adjustedCumReturn === -0.1, {
  tier: meritNo.tier, r: meritNo.adjustedCumReturn,
});
// 3) 良好（A + B ≥ 4）
const good = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'B', 6: 'B' }, finalNav: 101000 }));
chk('良好：A+B=4', good.tier === '良好' && good.countAB === 4, { tier: good.tier, ab: good.countAB });
// 4) 阈值边界：A+B=3 → 结业（即使收益为正）
const below = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'B' }, finalNav: 160000 }));
chk('A+B=3 → 结业（阈值是绝对次数，不随分母缩放）', below.tier === '结业' && below.countAB === 3 && below.gradedCount === 3, {
  tier: below.tier, ab: below.countAB, n: below.gradedCount, r: below.adjustedCumReturn,
});
// 5) 结业 —— 亏掉大部分本金
const lose = s(mk({ grades: { 2: 'D', 3: 'D', 5: 'D', 6: 'D', 7: 'C', 8: 'C' }, finalNav: 40000 }));
chk('结业：亏掉大部分本金（A+B=0）', lose.tier === '结业' && lose.adjustedCumReturn === -0.6, {
  tier: lose.tier, r: lose.adjustedCumReturn,
});
// 6) 结业 —— 反复补足本金：补钱把「超额收益」抹掉，A=4 也拿不到优秀
const topUp = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'A', 6: 'A' }, finalNav: 300000, injectionsTotal: 200000 }));
chk('补足 ¥200,000 后 NAV 到 ¥300,000 → 调整后收益 0，不给优秀', topUp.tier === '良好' && topUp.adjustedCumReturn === 0, {
  tier: topUp.tier, r: topUp.adjustedCumReturn, inj: topUp.injectionsTotal,
});
// 6b) 同样的 NAV、不补钱 → 优秀（证明上一条不是「NAV 高就行／不行」）
const noTopUp = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'A', 6: 'A' }, finalNav: 300000 }));
chk('同一 NAV 不补钱 → 优秀', noTopUp.tier === '优秀' && noTopUp.adjustedCumReturn === 2, {
  tier: noTopUp.tier, r: noTopUp.adjustedCumReturn,
});

// 7) 公式逐字 + 入金剔除：注入前后**同一个数字**
const before = s(mk({ grades: { 2: 'B', 3: 'B', 5: 'B', 6: 'B' }, finalNav: 60000, injectionsTotal: 0 }));
const after = s(mk({ grades: { 2: 'B', 3: 'B', 5: 'B', 6: 'B' }, finalNav: 110000, injectionsTotal: 50000 }));
chk('公式 = (NAV_final − Σ入金 − 本金)/本金', before.adjustedCumReturn === (60000 - 0 - CAP) / CAP, before.adjustedCumReturn);
chk('补 ¥50,000 后这个数字**一点没变**（不能靠补钱提升）',
  before.adjustedCumReturn === after.adjustedCumReturn && after.adjustedCumReturn === -0.4,
  { before: before.adjustedCumReturn, after: after.adjustedCumReturn });
const naive = (after.formula.navFinal - CAP) / CAP;
chk('若不减入金，同一个状态会显示 +10%（正是被这条规则挡掉的漏洞）', naive === 0.1 && naive !== after.adjustedCumReturn, { naive, honest: after.adjustedCumReturn });
chk('外部函数同口径', adjustedCumulativeReturn({ finalNav: 110000, injectionsTotal: 50000, initialCapital: CAP }) === -0.4);

// 8) 分母只数「真实记录过的」评级：任何数字都不写死
const one = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'A', 6: 'A' }, finalNav: 110000 }));
chk('分母 = 实际条目数（此例 4）', one.gradedCount === 4 && one.tier === '优秀', { n: one.gradedCount });
const five = s(mk({ grades: { 2: 'A', 3: 'A', 5: 'A', 6: 'A', 7: 'A', 8: 'A' }, finalNav: 110000 }));
chk('多记两章 → 分母变 6（不是写死的 7 或 6）', five.gradedCount === 6 && five.countA === 6, { n: five.gradedCount, a: five.countA });
const none = s(mk({ grades: {}, finalNav: 150000 }));
chk('空评级表：结业、已评级 0 次、无记录行、不报错', none.tier === '结业' && none.gradedCount === 0 && none.gradeRows.length === 0, {
  tier: none.tier, n: none.gradedCount,
});
chk('记录行只含已记录的章、按章号升序', eq(merit.gradeRows.map((r) => r.chapterId), [2, 3, 5, 6, 7]), merit.gradeRows.map((r) => r.chapterId));
chk('非法评级值被忽略（不进任何一档计数）', s(mk({ grades: { 2: 'A', 3: 'X' }, finalNav: 110000 })).gradedCount === 1);

// 9) 阈值是绝对次数（与 PRD 一致，不随分母缩放）
chk('阈值常量 = A≥4 / A+B≥4', eq(STANDING_THRESHOLDS, { meritCountA: 4, goodCountAB: 4 }), STANDING_THRESHOLDS);
chk('初始本金为 0 时不产生 NaN/Infinity', Number.isFinite(s({ grades: {}, finalNav: 50000, initialCapital: 0 }).adjustedCumReturn));
chk('三档都不改变任何能力位（返回值里没有解锁字段）',
  !('unlockedChapters' in merit) && !('unlockedInstruments' in merit) && merit.recordCompleteness === 'full' && none.recordCompleteness === 'counts');

return { pass: out.filter((r) => r.ok).length, total: out.length, fails: out.filter((r) => !r.ok), all: out };
