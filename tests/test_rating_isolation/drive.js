/**
 * test_rating_isolation —— PRD §3.3 锁 L2 / L3：**评级不侵入市场层**、**A 级不发资源**。
 *
 * Verification Plan 两行：
 *   L2：注入极端评级输入（A 与 D 各一次）后 `sim.snapshot()` 与对照**逐字节相同**；
 *   L3：A 级后 `cash`/`NAV`/`frozenCash`/`tradedNotional`/`feesPaid`/解锁集合与对照一致，
 *       仅 `extraSegment.kind='advanced'` 与进阶词典条目变化。
 *
 * 方法：同一进程内「注入前 → 注入 A → 注入 D → 注入 C」链式对照，把 `sim.snapshot()` 序列化成
 * 字符串逐字节比对；再在同一状态下提交**同一笔委托**，比对 `fillPrice`/`notional`/`fee`
 * （费用常量往返的端到端形式）。全程不做 `reset`，避免行情随机性混进对照。
 *
 * 依赖 `steps/lib.js`（test.sh 用 cat 前置拼接）。
 */

const R = {};
const simStr = () => JSON.stringify(b.sim.snapshot());
const limitsStr = () => JSON.stringify(b.instruments.map((i) => b.sim.limitsFor(i)));
/**
 * 「折叠中的进阶条目」= 词典里带 `folded` 类的行（Stage 2 起折叠态不再叫 `locked`：
 * 它是**折叠外观**，不是禁用态 —— PRD §3 禁止把词典做成锁）。
 *
 * 读之前先切到「概念」页：词典的页签是**会话级**状态（别的测试可能把它留在「评级公式」页），
 * 而索引只在「概念」页渲染 —— 不切页就会读到上一次渲染留下的旧行。
 */
const openConceptIndex = () => {
  b.openDictionary();
  const tabs = document.querySelectorAll('[data-role="concept-dictionary"] .tabs .tab');
  if (tabs[0]) tabs[0].click();
  b.refresh();
};
const lockedKeys = () => Array.from(document.querySelectorAll('.entry.folded')).map((e) => e.dataset.conceptKey);
const chapterCore = () => {
  const c = C();
  return {
    beatId: c.beatId, chapterId: c.chapterId, completedBeats: c.completedBeats,
    conceptsIntroduced: c.conceptsIntroduced, ruleCardsSeen: c.ruleCardsSeen,
    rating: c.rating, extra: c.extraSegment ? { kind: c.extraSegment.kind, unlockConcepts: c.extraSegment.unlockConcepts } : null,
  };
};

/** 极端输入：A（大涨、无费用、无回撤）与 D（腰斩、高费用、深回撤）。 */
const EXTREME_A = { navSeries: [100000, 130000], fees: 0, notional: 0 }
const EXTREME_D = { navSeries: [100000, 40000, 45000], fees: 3000, notional: 100000 }
const MID_C = { navSeries: [100000, 101000, 100500], fees: 0, notional: 0 }

// ══ L2：注入前后 sim.snapshot() 逐字节相同 ═════════════════════════════════
R.l2 = (() => {
  const entered = toCh2()
  // 切到 freeDay：注入即所见（章内模式下 `settle()` 会把真实 NAV 追加为采样点，见 steps/lib.js 文件头）
  b.setMode('freeDay')
  const before = { sim: simStr(), limits: limitsStr(), selected: S().selectedInstrumentId, open: S().isMarketOpen, canSubmit: S().canSubmitOrder }
  const grades = []
  for (const [name, input] of [['A', EXTREME_A], ['D', EXTREME_D], ['C', MID_C]]) {
    const r = b.devInjectRatingInputs(input)
    grades.push({ name, grade: r ? r.grade : null })
    b.refresh()
  }
  const after = { sim: simStr(), limits: limitsStr(), selected: S().selectedInstrumentId, open: S().isMarketOpen, canSubmit: S().canSubmitOrder }
  // 逐字段 diff（便于定位是哪一项被动了）
  const fieldDiff = (() => {
    const a = JSON.parse(before.sim)
    const z = JSON.parse(after.sim)
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(z)]))
    const out = []
    for (const k of keys) {
      const same = JSON.stringify(a[k]) === JSON.stringify(z[k])
      if (!same) out.push({ field: k, before: a[k], after: z[k] })
    }
    return out
  })()
  return { entered, before, after, grades, byteIdentical: before.sim === after.sim, limitsIdentical: before.limits === after.limits, fieldDiff }
})()

// ══ L2b：注入了极端评级之后，市场层照常可用（同一笔委托结果逐字段一致）═══
R.l2Order = (() => {
  toCh2()
  b.setMode('freeDay')
  const submit = () => {
    const st = S()
    const id = '601398'
    const price = Number(st.quotes[id].lastPrice)
    const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: id, price, qty: 100 })
    return { accepted: r.accepted, status: r.status, fillPrice: r.fillPrice, notional: r.notional, fee: r.fee, qty: r.qty, reasonCode: r.reasonCode }
  }
  const o0 = { grade: null, order: submit() }
  const injA = b.devInjectRatingInputs(EXTREME_A)
  const o1 = { grade: injA && injA.grade, order: submit() }
  const injD = b.devInjectRatingInputs(EXTREME_D)
  const o2 = { grade: injD && injD.grade, order: submit() }
  return { o0, o1, o2, feeRoundTrip: o0.order.fee === o1.order.fee && o0.order.fee === o2.order.fee, fillRoundTrip: o0.order.fillPrice === o1.order.fillPrice && o0.order.fillPrice === o2.order.fillPrice }
})()

// ══ L3：A 级不发资源（只改 extraSegment 与解锁集合）════════════════════════
R.l3 = (() => {
  toCh2()
  // 与 L2 同理：切到 freeDay，注入即所见（章内模式下 settle() 会把真实 NAV 追加为采样点）
  b.setMode('freeDay')
  // A 级解锁是**持久**的（Stage 2 修的缺陷：解锁集合不再随加演段结束而回滚），
  // 而 L2 已经注入过一轮 A —— 本探针要对照「A vs 非 A 的效果」，故先回到零解锁的确定性起点。
  b.chapter.advancedUnlocked = []
  b.refresh()
  const c0 = chapterCore()
  const before = {
    sim: simStr(),
    cash: S().cash, NAV: S().NAV, frozenCash: S().frozenCash, tradedNotional: S().tradedNotional,
    feesPaid: S().feesPaid, positions: JSON.stringify(S().positions), navHistory: JSON.stringify(S().navHistory),
    chapter: JSON.stringify(c0),
  }
  openConceptIndex()
  const lockedBefore = lockedKeys()
  const rA = b.devInjectRatingInputs(EXTREME_A)
  openConceptIndex()
  const lockedAfterA = lockedKeys()
  const cA = chapterCore()
  const afterA = {
    sim: simStr(),
    cash: S().cash, NAV: S().NAV, frozenCash: S().frozenCash, tradedNotional: S().tradedNotional,
    feesPaid: S().feesPaid, positions: JSON.stringify(S().positions), navHistory: JSON.stringify(S().navHistory),
    chapter: JSON.stringify(cA),
  }
  // 对照：同样注入但落在 C 档 → 没有加演段、进阶条目不开锁
  toCh2()
  b.setMode('freeDay')
  openConceptIndex()
  const lockedBeforeB = lockedKeys()
  const rB = b.devInjectRatingInputs({ navSeries: [100000, 102000], fees: 0, notional: 0 })
  openConceptIndex()
  const lockedAfterB = lockedKeys()
  const cB = chapterCore()
  return {
    c0, before, afterA, cA,
    gradeA: rA && rA.grade, gradeB: rB && rB.grade,
    mapMoveA: rA && rA.marketMove,
    lockedBefore, lockedAfterA, lockedBeforeB, lockedAfterB,
    cB,
    simIdentical: before.sim === afterA.sim,
    resourcesIdentical:
      before.cash === afterA.cash && before.NAV === afterA.NAV && before.frozenCash === afterA.frozenCash &&
      before.tradedNotional === afterA.tradedNotional && before.feesPaid === afterA.feesPaid &&
      before.positions === afterA.positions && before.navHistory === afterA.navHistory,
  }
})()

// ══ L3b：A 级玩家路径（章末结算）同样不发资源 ═══════════════════════════════
R.l3End = (() => {
  toCh2()
  b.devGotoBeat(2, '2.7')
  const before = { cash: S().cash, NAV: S().NAV, frozenCash: S().frozenCash, tradedNotional: S().tradedNotional, feesPaid: S().feesPaid }
  b.devForceGrade('A')
  b.devSatisfy('2.7.advance')
  b.devSatisfy('2.7.eventCard')
  const atEnd = { rating: C().rating, extra: C().extraSegment && { kind: C().extraSegment.kind, unlockConcepts: C().extraSegment.unlockConcepts }, endPhase: S().endPhase }
  const after = { cash: S().cash, NAV: S().NAV, frozenCash: S().frozenCash, tradedNotional: S().tradedNotional, feesPaid: S().feesPaid }
  return { before, after, atEnd }
})()

return R
