/**
 * test_mentor —— 导师周老师的运行期约束驱动脚本。
 *
 * 覆盖范围（严格限定为交付说明里的六条）：
 *   ① 只在五个**穷举**时机开口（章开场 / 首遇或本拍点名的概念 / 被拒单·亏损·触风险警示线 /
 *      章末 / 玩家主动呼叫），其余路径不得产生台词（负例：刷新、开面板、读面板、
 *      进入未声明台词的节拍）。
 *   ② 每概念**主动**讲解上限 2 次（第 1 次比喻、第 2 次机制），第 3 次起只在玩家呼叫时出现；
 *      计数跨节拍 / 跨章累加，且 `toJSON()` → `loadFrom()` 往返后一致。
 *   ③ 静音只抑制**非剧情发言**（他主动补的提示 / 讲解 / 点评）；章开场 / 章末 / 承接语 /
 *      选项反馈 / 风险警示线等剧情与功能性台词照常出现；计数（静音期间）照常累加。
 *   ④ `freeDay` / `sandbox` 下不主动弹窗（唯一例外是风险警示线）。
 *   ⑤ 导师**无任何隐藏层**：持久化状态面只有 explainCounts / muted / proactiveEnabled；
 *      存档白名单把未知键（伏笔 / 身份 / 延迟台词）物理丢弃。
 *   ⑥ lead 裁决 R10 —— 章内一次只有一张嘴：`MentorView` 静态化（立绘 + 中性标签，无台词，
 *      不渲染当日 `mentorLine`）；`freeDay` / `sandbox` 恢复显示事件 `mentorLine`。
 *
 * 全部走 Runtime API（`vibegame play eval`）＋真实页面 DOM 读取，与玩家点击同一条渲染路径。
 * 返回结构化对象，由 assert_mentor.py 断言。
 */
const b = sceneTree.nodes.get('broker')
const S = () => b.runtimeState()
const C = () => S().chapter
const L = () => C().mentor.line
const CK = () => ({ ...C().mentor.explainCounts })
const MVD = () => document.querySelector('#broker-shell .mentor.panel')
const MV_SAY = () => { const e = MVD(); return e ? e.querySelector('.say') : null }
const MV_FOOT = () => { const e = MVD(); return e ? e.querySelector('.foot') : null }
const CH_LINE = () => document.querySelector('#chapter-root .ch-line')
const beatOf = (timing) => ((C().beat && C().beat.mentor) || []).find((m) => m.timing === timing) || null
const R = {}

// ─── 0. 确定性基线 ────────────────────────────────────────────────────────────
// 计数不随任何产品重置路径清零（这是设计：跨章 / 跨存档累加），因此这里显式建立基线，
// 断言全部按「基线 + 增量」写，避免依赖上一个会话残留的计数。
b.setMuted(false)
b.setMode('chapter')
b.resetChapterProgress()
b.chapter.mentor.loadFrom({ explainCounts: {}, muted: false, proactiveEnabled: true })
b.refresh()
R.baseline = {
  mode: C().mode, beatId: C().beatId, muted: C().mentor.muted,
  proactiveEnabled: C().mentor.proactiveEnabled, counts: CK(), line: L(),
  openEntry: beatOf('chapterOpen'),
}

// ─── 1. ① 五个穷举时机 ────────────────────────────────────────────────────────
// (a) 章开场一次 + 负例：仅仅刷新视图不产生台词
{
  const before = L()
  b.refresh()
  R.open = {
    beatId: C().beatId, line: L(), conceptKey: C().mentor.conceptKey,
    speaker: C().mentor.speaker, counts: CK(),
    dataLine: R.baseline.openEntry && R.baseline.openEntry.line,
    dataSpeaker: R.baseline.openEntry && R.baseline.openEntry.speaker,
    lineUnchangedOnRefresh: L() === before,
  }
}
// (b) 首遇概念：1.0 → 1.1「银行」
b.chapterAck('1.0.start')
R.firstConceptBank = {
  beatId: C().beatId, line: L(), conceptKey: C().mentor.conceptKey, counts: CK(),
  dataLine: beatOf('firstConcept') && beatOf('firstConcept').line,
}
// 负例：本拍未完成时点开面板（不推进、不重讲）
{
  const before = L()
  b.chapterAck('1.1.openDeposit')
  R.negative = { afterPanelOpen: { beatId: C().beatId, lineUnchanged: L() === before } }
  b.chapterRead('panel.deposit', 2)
  R.negative.afterPanelRead = { beatId: C().beatId, lineUnchanged: L() === before, readCount: 2 }
  b.chapterClosePanel('panel.deposit')
  R.negative.afterPanelClose = { beatId: C().beatId, line: L(), conceptKey: C().mentor.conceptKey, counts: CK() }
}
// 负例：进入未声明 mentor 台词的节拍（1.3 无 mentor 条目）→ 不得凭空开口
b.chapterAck('1.2.openAccount')
R.negative.into1_3 = { beatId: C().beatId, line: L(), counts: CK(), beatMentor: (C().beat || {}).mentor || null }
// (b) 首遇概念：1.3 → 1.4「最小交易单位」
b.chapterAck('1.3.fundInitial')
R.firstConceptLot = {
  beatId: C().beatId, line: L(), conceptKey: C().mentor.conceptKey, counts: CK(), nav: S().NAV,
  dataLine: beatOf('firstConcept') && beatOf('firstConcept').line,
}
// 负例：选标的推进到未声明台词的 1.5 → 不得开口
b.chapterSelect('601398', { player: true, affordable: true })
R.negative.into1_5 = { beatId: C().beatId, line: L(), counts: CK(), beatMentor: (C().beat || {}).mentor || null }
// 负例：面板打开 / 阅读本身不开口（1.5.5 概念卡）
{
  b.devGotoBeat(1, '1.5.5') // restoring → 不重放开场台词
  const afterGoto = L()
  b.chapterOpenPanel('panel.conceptCards')
  b.refresh()
  const afterOpen = L()
  b.chapterRead('panel.conceptCards', 3)
  const afterRead = L()
  b.chapterClosePanel('panel.conceptCards')
  R.negative.panelPaths = {
    afterGoto, afterOpen, afterRead,
    afterClose: { beatId: C().beatId, line: L(), conceptKey: C().mentor.conceptKey, counts: CK() },
  }
}
// (c) 被拒单 / 触风险警示线
{
  // 风险警示线：NAV 掉到黄/红档 → 一句「补足本金」提示，且每章最多一次（第二次不再重复）。
  // `resetChapterProgress()` 会重置 goalCardState（黄档提醒配额），`devGotoBeat` 同章跳拍只清台词、不开口。
  b.resetChapterProgress()
  b.devGotoBeat(1, '1.5')
  const countsBefore = CK()
  const lineBefore = L()
  b.chapter.noteNav(9000)
  b.refresh()
  const riskLine = L()
  b.devGotoBeat(1, '1.5')
  const cleared = L()
  b.chapter.noteNav(4000)
  b.refresh()
  const secondRiskLine = L()
  R.reactive = {
    lineBefore, countsBefore,
    riskLine, countsAfterRisk: CK(),
    lineAfterClear: cleared, secondRiskLine,
    goalCardYellowLine: C().goalCard && C().goalCard.yellowLine,
  }
  // 被拒单：2.1 声明了 rejected 台词（conceptKey = 可用资金不足）
  b.devGotoBeat(2, '2.1')
  const beforeReject = { line: L(), counts: CK() }
  const reject = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: Number(S().quotes['601398'].limitUp) + 1, qty: 100 })
  R.reactive.reject = {
    before: beforeReject,
    reasonCode: reject && reject.reasonCode, accepted: reject && reject.accepted,
    beatId: C().beatId, line: L(), conceptKey: C().mentor.conceptKey, counts: CK(),
    dataLine: beatOf('rejected') && beatOf('rejected').line,
  }
}
// 全仓台词不得出现「你不该……」（comfort 优先，绝无纠正措辞）
R.forbiddenWording = (() => {
  const hits = []
  const walk = (node, path) => {
    if (typeof node === 'string') { if (/你不该|不应该做/.test(node)) hits.push(path + '=' + node.slice(0, 40)); return }
    if (!node || typeof node !== 'object') return
    for (const k of Object.keys(node)) walk(node[k], path + '.' + k)
  }
  walk(b.chapter.chapters, 'chapters')
  return { hits, scanned: true }
})()

// ─── 2. ② 每概念主动讲解上限 2 次 + 权重 2 的跨章 / 存档往返 ────────────────────
R.quota = { steps: [] }
{
  const snap = (tag) => R.quota.steps.push({ tag, beatId: C().beatId, line: L(), conceptKey: C().mentor.conceptKey, counts: CK() })
  b.resetChapterProgress()
  snap('reset -> 1.0 章开场（不受概念上限限制）')
  b.chapterAck('1.0.start') // 银行 第 2 次主动 → 允许
  snap('1.1 银行 第 2 次主动')
  b.resetChapterProgress()
  b.chapterAck('1.0.start') // 银行 第 3 次主动 → 抑制
  snap('1.1 银行 第 3 次主动（应被抑制）')
  R.quota.callWhenSuppressed = { res: b.callMentor(), line: L(), counts: CK() }
  // 另一概念不受影响：重玩到 1.2（券商 第 2 次主动）
  b.resetChapterProgress()
  b.chapterAck('1.0.start')
  b.chapterAck('1.1.openDeposit')
  b.chapterRead('panel.deposit', 2)
  b.chapterClosePanel('panel.deposit')
  snap('1.2 券商 第 2 次主动（另一概念不受银行配额影响）')
}
// 跨章累加：进入第二章时章内状态重置，导师计数**不**重置
R.crossChapter = (() => {
  const before = CK()
  b.devGotoBeat(2, '2.1')
  return {
    before, after: CK(),
    conceptsIntroducedReset: C().conceptsIntroduced.length,
    beatId: C().beatId, line: L(),
  }
})()
// 存档往返：toJSON() → loadFrom()
R.saveTrip = (() => {
  const json = b.chapter.toJSON()
  const before = { counts: CK(), muted: C().mentor.muted, proactiveEnabled: C().mentor.proactiveEnabled }
  b.chapter.mentor.loadFrom({ explainCounts: {}, muted: true, proactiveEnabled: false })
  const cleared = { counts: CK(), muted: C().mentor.muted, proactiveEnabled: C().mentor.proactiveEnabled }
  b.chapter.mentor.loadFrom(json.mentor)
  return {
    before, cleared,
    saveKeys: Object.keys(json.mentor || {}),
    restored: { counts: CK(), muted: C().mentor.muted, proactiveEnabled: C().mentor.proactiveEnabled },
    snapshotKeys: Object.keys(C().mentor).sort(),
  }
})()

// ─── 3. ⑤ 无隐藏层：白名单丢弃未知键（真实 SaveStore 往返）────────────────────
R.noHiddenLayer = (() => {
  const KEY = 'market-101.save.v1'
  const original = (() => { try { return localStorage.getItem(KEY) } catch (e) { return null } })()
  const liveKeysBefore = Object.keys(b.chapter.mentor).sort()
  // ① 直接往活的调度器对象上塞伏笔容器 → toJSON 必须把它们丢掉
  const m = b.chapter.mentor
  m.fragment = { id: 'F1', revealed: false }
  m.identity = { name: 'hidden' }
  m.delayedLine = 'later'
  m.foreshadow = ['a']
  m.pendingReveal = { at: 3 }
  const afterInjectKeys = Object.keys(b.chapter.mentor).sort()
  const liveJSONKeys = Object.keys(m.toJSON()).sort()
  const chapterJSONKeys = Object.keys(b.chapter.toJSON().mentor || {}).sort()
  delete m.fragment; delete m.identity; delete m.delayedLine; delete m.foreshadow; delete m.pendingReveal
  const liveKeysAfter = Object.keys(b.chapter.mentor).sort()
  // ② 伪造一份带未知键的存档写进 localStorage，走产品自己的 SaveStore.read()
  let readDoc = null
  let readErr = null
  try {
    const tampered = {
      version: 1, beatId: '1.1', chapterId: 1, mode: 'chapter',
      fragment: 'top-level', reveal: { at: 2 },
      chapter: {
        ...b.chapter.toJSON(),
        mentor: { explainCounts: { 银行: 1 }, muted: false, proactiveEnabled: true, fragment: { id: 'F2' }, identity: { name: 'x' }, delayedLine: 'y' },
        fragments: ['a'],
      },
    }
    localStorage.setItem(KEY, JSON.stringify(tampered))
    readDoc = b.saveStore.read()
  } catch (e) { readErr = String(e) }
  try { if (original === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, original) } catch (e) {}
  const hits = []
  const scan = (node, path) => {
    if (!node || typeof node !== 'object') return
    for (const k of Object.keys(node)) {
      if (/fragment|identity|foreshadow|delayed|reveal|pendingReveal|伏笔|碎片|身份|延迟/i.test(k)) hits.push(path + '.' + k)
      scan(node[k], path + '.' + k)
    }
  }
  scan(readDoc, 'save')
  return {
    liveKeysBefore, afterInjectKeys, liveKeysAfter, liveJSONKeys, chapterJSONKeys,
    readErr,
    readMentorKeys: readDoc && readDoc.chapter && readDoc.chapter.mentor ? Object.keys(readDoc.chapter.mentor).sort() : null,
    readMentorCounts: readDoc && readDoc.chapter && readDoc.chapter.mentor ? readDoc.chapter.mentor.explainCounts : null,
    forbiddenKeyHits: hits,
    saveRawMentorKeys: (() => {
      try { const raw = localStorage.getItem('market-101.save.v1'); if (!raw) return null; const d = JSON.parse(raw); return d.chapter && d.chapter.mentor ? Object.keys(d.chapter.mentor).sort() : null } catch (e) { return null }
    })(),
  }
})()

// ─── 3b. 被拒单后回到第一章，继续静音与模式相关断言 ───────────────────────────
b.resetChapterProgress()
R.afterRejectReset = { beatId: C().beatId, line: L(), counts: CK() }

// ─── 4. ③ 静音：抑制**非剧情发言**，但剧情/功能性台词照常，计数照常累加 ──────────
R.mute = (() => {
  const before = CK()
  b.setMuted(true)
  const mutedFlag = C().mentor.muted
  // 章开场是**剧情台词** → 静音下也必须出现（lead 裁决：静音只吞他主动补的提示 / 讲解 / 点评）
  b.resetChapterProgress()
  const afterReset = { line: L(), source: C().mentor.source, muted: C().mentor.muted }
  b.chapterAck('1.0.start') // 1.1 银行：首遇概念的讲解属**非剧情发言** → 静音下不出现；计数由运行时补记
  const afterAck = { line: L(), counts: CK(), chLineText: CH_LINE() ? CH_LINE().textContent : null }
  b.refresh()
  const afterRefresh = { counts: CK(), chLineText: CH_LINE() ? CH_LINE().textContent : null }
  const reason = b.chapter.mentor.request({ timing: 'firstConcept', conceptKey: '券商', mode: 'chapter' })
  // 取消静音 → 不得补讲（没有积压）
  b.setMuted(false)
  b.refresh()
  const afterUnmute = { line: L(), counts: CK(), chLineText: CH_LINE() ? CH_LINE().textContent : null }
  // 取消静音后配额仍然成立：再走一次 1.1 → 银行仍在抑制态
  b.resetChapterProgress()
  const openLineAfterUnmute = L()
  b.chapterAck('1.0.start')
  const quotaStillHolds = { line: L(), counts: CK() }
  return { before, mutedFlag, afterReset, afterAck, afterRefresh, reason, afterUnmute, openLineAfterUnmute, quotaStillHolds }
})()

// ─── 5. ④ freeDay / sandbox 下不主动弹窗 ─────────────────────────────────────
R.freeDay = (() => {
  const out = {}
  b.setMode('freeDay')
  out.mode = C().mode
  out.lineAfterSetMode = L()
  out.rejectReason = b.chapter.mentor.request({ timing: 'rejected', mode: 'freeDay' })
  out.firstConceptReason = b.chapter.mentor.request({ timing: 'firstConcept', conceptKey: '银行', mode: 'freeDay' })
  // 普通动作一：普通拒单
  b.devSetEvent({
    id: 'B01', type: 'BLACK_SWAN', targets: ['ALL'], sentiment: 'BAD', magnitude: 0.6, fxTarget: null,
    headline: '突发：某大型机构爆雷，市场短暂恐慌',
    mentorLine: '罕见的大事件引发集体抛售，但监管迅速出手维稳，跌幅有限。就像小区突然停电，大家慌了一下，但很快来电、没真出大事——教你看懂"罕见、剧烈、难预测"，但市场长期仍会恢复。',
    conceptKeys: [],
  })
  b.advanceDay()
  out.afterAdvanceDay = { line: L(), currentEventId: S().currentEvent && S().currentEvent.id }
  out.eventMentorLine = S().currentEvent && S().currentEvent.mentorLine
  // R10：freeDay 恢复显示当日事件的 mentorLine（此刻还没有被拒单，`lastOrder` 不抢位）
  const el = MVD()
  out.mentorView = {
    exists: !!el,
    datasetStatic: el ? el.dataset.mentorStatic || null : 'MISSING',
    cls: el ? el.className : null,
    rootText: el ? el.textContent : null,
    sayText: MV_SAY() ? MV_SAY().textContent : null,
    sayDisplay: MV_SAY() ? getComputedStyle(MV_SAY()).display : null,
    footText: MV_FOOT() ? MV_FOOT().textContent : null,
  }
  // 章内那张嘴（对话层）在 freeDay 应当收起来 —— 一次只有一张嘴
  out.dialogueLayer = {
    hasLineEl: !!CH_LINE(),
    hiddenByClass: !!CH_LINE() && !!CH_LINE().closest('.ch-hidden'),
    visible: CH_LINE() ? CH_LINE().offsetParent !== null : null,
    text: CH_LINE() ? CH_LINE().textContent : null,
  }
  // 普通动作：被拒单也不得让调度器开口（唯一例外是风险警示线）
  const reject = b.submitOrder({ side: 'buy', type: 'market', instrumentId: '601398', qty: 100000 })
  out.afterRejectedOrder = { line: L(), reasonCode: reject && reject.reasonCode, accepted: reject && reject.accepted }
  return out
})()
R.sandbox = (() => {
  const out = {}
  b.devSkipToSandbox()
  out.mode = C().mode
  out.lineAfterSwitch = L()
  out.rejectReason = b.chapter.mentor.request({ timing: 'rejected', mode: 'sandbox' })
  b.advanceDay()
  out.afterAdvanceDay = L()
  const reject = b.submitOrder({ side: 'buy', type: 'market', instrumentId: '601398', qty: 100000 })
  out.afterRejectedOrder = { line: L(), reasonCode: reject && reject.reasonCode, accepted: reject && reject.accepted }
  out.dialogueLayer = {
    hasLineEl: !!CH_LINE(),
    hiddenByClass: !!CH_LINE() && !!CH_LINE().closest('.ch-hidden'),
    visible: CH_LINE() ? CH_LINE().offsetParent !== null : null,
  }
  return out
})()

// ─── 6. ⑥ R10 —— 章内一次只有一张嘴 ─────────────────────────────────────────
R.r10Chapter = (() => {
  const out = {}
  b.setMode('chapter')
  b.refresh()
  // 制造一条**当前**导师台词：章内只有一个说话面（对话层）应当显示它
  const call = b.callMentor()
  b.refresh()
  out.mode = C().mode
  out.mentorLine = L()
  out.callOk = call && call.ok
  out.chLineText = CH_LINE() ? CH_LINE().textContent : null
  const el = MVD()
  out.exists = !!el
  out.datasetStatic = el ? el.dataset.mentorStatic || null : 'MISSING'
  out.cls = el ? el.className : null
  out.hasStaticClass = el ? el.classList.contains('static') : null
  out.rootText = el ? el.textContent : null
  out.rootInnerText = el ? el.innerText : null
  out.sayText = MV_SAY() ? MV_SAY().textContent : null
  out.sayDisplay = MV_SAY() ? getComputedStyle(MV_SAY()).display : null
  out.footText = MV_FOOT() ? MV_FOOT().textContent : null
  out.footDisplay = MV_FOOT() ? getComputedStyle(MV_FOOT()).display : null
  out.whoText = el ? (el.querySelector('.who') ? el.querySelector('.who').textContent : null) : null
  out.rendersMentorLine = !!(el && out.mentorLine && el.textContent.includes(out.mentorLine))
  out.shellDisplay = (() => { const sh = document.querySelector('#broker-shell'); return sh ? getComputedStyle(sh).display : null })()
  // 章内那张嘴是对话层：它必须显示当前台词，且可见
  out.dialogueLayer = {
    hasLineEl: !!CH_LINE(),
    hiddenByClass: !!CH_LINE() && !!CH_LINE().closest('.ch-hidden'),
    visible: CH_LINE() ? CH_LINE().offsetParent !== null : null,
  }
  return out
})()

// ─── 7. 收尾：停在「章内 + 无台词」的拍上，供 test.sh 空转帧复验「不主动弹窗」──
b.resetChapterProgress()
b.devGotoBeat(1, '1.5')
b.refresh()
R.final = { mode: C().mode, beatId: C().beatId, line: L(), counts: CK(), muted: C().mentor.muted }
return R
