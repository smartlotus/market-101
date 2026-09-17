// 第四章驱动 2/5：4.2 谁在定价 —— 挂单簿由代码绘制 + 点选「这一笔是谁和谁成交的」+ 消耗一个开市日（P02 定拍钉）
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const c = () => st().chapter
const R = {}
const openPanels = () =>
  Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.getAttribute('data-panel-id'))
const snap = (tag) => ({
  tag,
  beatId: c().beatId,
  req: c().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
  panelId: c().panelId,
  openPanels: openPanels(),
  dayIndex: st().dayIndex,
  isMarketOpen: st().isMarketOpen,
  currentEvent: st().currentEvent ? st().currentEvent.id : null,
  directedEvents: c().directedEvents,
  pendingChoiceAnswered: c().pendingChoice ? c().pendingChoice.answeredKey : null,
  mentorLine: c().mentor.line,
  rating: c().rating,
})

R.start = snap('4.2 起点')
const p = document.querySelector('#game-container .ch-scrim[data-panel-id="panel.orderBook"]')
R.dom = p
  ? {
      open: p.classList.contains('ch-open'),
      blocks: Array.from(p.querySelectorAll('[data-block-type]')).map((e) => e.getAttribute('data-block-type')),
      askRows: p.querySelectorAll('.bk-col.asks .bk-row').length,
      bidRows: p.querySelectorAll('.bk-col.bids .bk-row').length,
      askPrices: Array.from(p.querySelectorAll('.bk-col.asks .bk-row .p')).map((e) => e.textContent),
      bidPrices: Array.from(p.querySelectorAll('.bk-col.bids .bk-row .p')).map((e) => e.textContent),
      lastChip: p.querySelector('[data-role="last"]') ? p.querySelector('[data-role="last"]').textContent : null,
      spreadChip: p.querySelector('[data-role="spread"]') ? p.querySelector('[data-role="spread"]').textContent : null,
      notes: Array.from(p.querySelectorAll('.bk-note')).map((e) => e.textContent),
      canvasOrImg: p.querySelectorAll('canvas, img').length,
      imgs: Array.from(p.querySelectorAll('img')).map((e) => e.getAttribute('src')),
      unresolved: Array.from(p.querySelectorAll('[data-ch-unresolved]')).map((e) => e.getAttribute('data-ch-unresolved')),
    }
  : null

// 先答一次另一条（只重讲、不判完成）
const wrong = b.chapterAnswer('4.2.match', 'exchange')
R.wrongAnswer = { result: wrong, after: snap('4.2 答了另一条') }
// 再答正确的那条
const right = b.chapterAnswer('4.2.match', 'match')
R.rightAnswer = { result: right, after: snap('4.2 点选完成') }

// 挂单簿读完后合上，再点「进入下一交易日」（顶栏控件，唯一路径 chapterAck）
b.chapterClosePanel('panel.orderBook')
R.afterClose = snap('4.2 合上挂单簿')
b.advanceDay()
R.afterAdvance = snap('4.2 推进一个开市日')
R.advanceDetail = {
  dayIndex: st().dayIndex,
  inGameDate: st().inGameDate,
  isMarketOpen: st().isMarketOpen,
  currentEvent: st().currentEvent ? st().currentEvent : null,
  owed: c().directedEvents.owed,
  drawn: c().directedEvents.drawn,
}
return R
