// 第四章驱动 6/6：**一次不落地**的自然走法（不用 devGotoBeat 重进），逐拍记录 trace
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const c = () => st().chapter
const R = { trace: [] }
const openPanels = () =>
  Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.getAttribute('data-panel-id'))
const panelText = (id) => {
  const p = document.querySelector('#game-container .ch-scrim[data-panel-id="' + id + '"]')
  return p ? p.innerText.replace(/\s+/g, ' ') : null
}
const row = (tag) => {
  const r = {
    tag,
    beatId: c().beatId,
    req: c().beatRequirements.map((x) => x.id + '=' + x.satisfied),
    panelId: c().panelId,
    openPanels: openPanels(),
    mentor: c().mentor.line,
    mentorSource: c().mentor.source,
    match: c().matchProgress.institutions ? c().matchProgress.institutions.pairsDone.length : null,
    flow: c().flowProgress.orderFlow ? c().flowProgress.orderFlow.index : null,
    event: st().currentEvent ? st().currentEvent.id : null,
    rating: c().rating,
    extra: c().extraSegment,
    endPhase: c().endPhase,
    mode: c().mode,
  }
  R.trace.push(r)
  return r
}

// 干净开局 → 真实账户 → 第四章
b.reset()
b.chapter.resetChapterProgress()
b.chapterAck('1.0.start')
b.chapterAck('1.1.openDeposit')
b.chapterRead('panel.deposit', 2)
b.chapterClosePanel('panel.deposit')
b.chapterAck('1.2.openAccount')
b.chapterAck('1.3.fundInitial')
b.devGotoChapter(4)
row('enter 4.1')

// 4.1
R.b41dom = { props: document.querySelectorAll('#chapter-root .ch-prop.tower').length }
b.chapterAck('4.1.openExchange'); b.chapterClosePanel('panel.tower.exchange')
b.chapterAck('4.1.openBroker'); b.chapterClosePanel('panel.tower.broker')
b.chapterAck('4.1.openFund'); b.chapterClosePanel('panel.tower.fund')
row('4.1 done')

// 4.2（先故意答错一次，再答对；然后消耗一个开市日）
R.b42dom = { last: panelText('panel.orderBook') ? panelText('panel.orderBook').includes('这一笔成交 ¥10.43 × 500') : null }
R.b42wrong = b.chapterAnswer('4.2.match', 'exchange')
b.chapterAnswer('4.2.match', 'match')
b.chapterClosePanel('panel.orderBook')
b.advanceDay()
R.b42event = st().currentEvent ? { id: st().currentEvent.id, headline: st().currentEvent.headline, targets: st().currentEvent.targets, sentiment: st().currentEvent.sentiment, magnitude: st().currentEvent.magnitude } : null
R.b42owed = c().directedEvents
row('4.2 done')

// 4.3（先故意配错一次，再配完六对）
R.b43wrong = b.chapterMatch('institutions', 'exchange', 't.bank')
const pairs = [['exchange', 't.exchange'], ['broker', 't.broker'], ['bank', 't.bank'], ['clearing', 't.clearing'], ['regulator', 't.regulator'], ['fundManager', 't.fundManager']]
R.b43pairs = pairs.map((p) => b.chapterMatch('institutions', p[0], p[1]).ok)
row('4.3 done')

// 4.4（先错序一次，再按顺序走完）
R.b44wrong = b.chapterFlowStep('orderFlow', 'regulate')
R.b44steps = ['buy', 'broker', 'match', 'clearing', 'custody', 'register', 'regulate'].map((s) => b.chapterFlowStep('orderFlow', s).ok)
row('4.4 done')

// 4.5（不判对错的选择题）
R.b45 = b.chapterAnswer('4.5.ifNoRule', 'same')
b.chapterClosePanel('panel.ifNoRule')
row('4.5 done')

// 4.6（读满三条并关面板）
R.b46 = { open: c().panelId }
b.chapterRead('panel.badNews', 3)
b.chapterClosePanel('panel.badNews')
row('4.6 done')

// 4.7（章末台词 —— 自然进场，非 dev 重进）
R.b47 = { mentorLine: c().mentor.line, mentorSource: c().mentor.source, endOfChapter: c().beat.endOfChapter === true }
row('4.7 起点')
b.chapterAck('4.7.finish')
R.afterEnd = row('4.7 完成')
R.endPanel = { panels: openPanels(), text: panelText('panel.confirm') }
R.mentorHistoryCh4 = (c().mentorHistory || []).filter((e) => Number(e.chapterId) === 4).map((e) => e.beatId + ' | ' + e.source + ' | ' + e.line)
R.confirm = b.chapterConfirm()
R.finalRow = row('确认后')
R.finalSummary = {
  mode: c().mode,
  unlockedChapters: c().unlockedChapters,
  grades: c().grades,
  rating: c().rating,
  extraSegment: c().extraSegment,
  remedialUsedThisChapter: c().remedialUsedThisChapter,
  redLineActive: c().redLineActive,
  injectionsTotal: c().injectionsTotal,
  completedBeats: c().completedBeats,
  beatCount: c().beatCount,
}
return R
