// 第四章驱动 1/5：开户入金（拿到一个真实账户）→ 经 devGotoChapter(4) 进场 → 走完 4.1 三栋楼
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const c = () => st().chapter
const R = { trace: [] }
const openPanels = () =>
  Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.getAttribute('data-panel-id'))
const snap = (tag) => {
  const s = st()
  const row = {
    tag,
    chapterId: c().chapterId,
    beatId: c().beatId,
    beatIndex: c().beatIndex,
    req: c().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    panelId: c().panelId,
    openPanels: openPanels(),
    dayIndex: s.dayIndex,
    dayOpen: s.dayOpen,
    isMarketOpen: s.isMarketOpen,
    nav: s.NAV,
    moneyTier: c().moneyTier,
    goalCard: c().goalCard,
    rating: c().rating,
    extraSegment: c().extraSegment,
    redLineActive: c().redLineActive,
    noRemedial: c().noRemedial,
    currentEvent: s.currentEvent ? s.currentEvent.id : null,
    directedEvents: c().directedEvents,
  }
  R.trace.push(row)
  return row
}

// ── 用一个真实账户进场（第四章不交易，但账户不该是空的）───────────────────────
b.chapterAck('1.0.start')
b.chapterAck('1.1.openDeposit')
b.chapterRead('panel.deposit', 2)
b.chapterClosePanel('panel.deposit')
snap('ch1 1.2 起点')
b.chapterAck('1.2.openAccount')
snap('ch1 1.3 起点')
b.chapterAck('1.3.fundInitial')
R.funded = { cash: st().cash, nav: st().NAV, dayOpen: st().dayOpen, dayIndex: st().dayIndex, isMarketOpen: st().isMarketOpen }

// ── 确定性章入口 ─────────────────────────────────────────────────────────────
b.devGotoChapter(4)
const entered = snap('entered chapter 4')
R.entered = {
  chapterId: entered.chapterId,
  chapterName: c().chapterName,
  beatId: entered.beatId,
  beatCount: c().beatCount,
  remainingBeats: c().remainingBeats,
  scene: c().sceneId,
  shellMode: c().shellMode,
  mentorLine: c().mentor.line,
  mentorSource: c().mentor.source,
  noScoreLabel: c().goalCard && c().goalCard.noScoreLabel,
  graded: c().goalCard && c().goalCard.graded,
  redLineActive: c().redLineActive,
}
R.propsHome = {
  towers: document.querySelectorAll('#chapter-root .ch-prop.tower').length,
  labels: Array.from(document.querySelectorAll('#chapter-root .ch-prop.tower .sign')).map((e) => e.textContent),
}

// ── 4.1 逐栋点开（顺序无关）──────────────────────────────────────────────────
const towerDom = (panelId) => {
  const p = document.querySelector('#game-container .ch-scrim[data-panel-id="' + panelId + '"]')
  if (!p) return null
  return {
    exists: true,
    open: p.classList.contains('ch-open'),
    blocks: p.querySelectorAll('[data-block-type="tower"]').length,
    facadeParts: p.querySelectorAll('.ch-tower .facade .roof, .ch-tower .facade .door').length,
    text: p.innerText.replace(/\s+/g, ' ').slice(0, 240),
  }
}
b.chapterAck('4.1.openExchange')
R.tower1 = { ...snap('4.1 交易所'), dom: towerDom('panel.tower.exchange') }
b.chapterClosePanel('panel.tower.exchange')
b.chapterAck('4.1.openBroker')
R.tower2 = { ...snap('4.1 券商'), dom: towerDom('panel.tower.broker') }
b.chapterClosePanel('panel.tower.broker')
b.chapterAck('4.1.openFund')
R.tower3 = { ...snap('4.1 基金公司'), dom: towerDom('panel.tower.fund') }
b.chapterClosePanel('panel.tower.fund')
R.after41 = snap('4.1 完成')

return R
