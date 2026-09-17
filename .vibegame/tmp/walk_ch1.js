const n = [...sceneTree.nodes.values()].find((x) => typeof x.runtimeState === 'function' && x.chapterAck)
if (!n) return 'NO_SHELL'
const steps = []
const snap = () => {
  const c = n.runtimeState().chapter || {}
  return { beat: c.beatId, mode: c.mode, shell: c.shellMode, panel: c.panelId }
}

n.resetChapterProgress()
steps.push(['reset', snap()])

n.chapterAck('1.0.start')
steps.push(['1.0 start', snap()])

n.chapterOpenPanel('panel.deposit')
n.chapterAck('1.1.openDeposit')
n.chapterRead('panel.deposit', 2)
n.chapterClosePanel('panel.deposit')
steps.push(['1.1 deposit', snap()])

n.chapterAck('1.2.openAccount')
steps.push(['1.2 account', snap()])

n.chapterAck('1.3.fundInitial')
steps.push(['1.3 fund', snap()])

n.chapterSelect('601398')
steps.push(['1.4 select', snap()])

const q = n.runtimeState().quotes || {}
const px = (q['601398'] || {}).lastPrice
let order = null
try {
  order = await n.submitOrder({
    side: 'buy', instrumentId: '601398', qty: 100, type: 'limit', price: px,
  })
} catch (e) { order = 'ERR ' + e.message }
steps.push(['1.5 buy px=' + px, { ...snap(), res: order && order.accepted, code: order && order.reasonCode }])

n.chapterRead('panel.conceptCards', 3)
n.chapterClosePanel('panel.conceptCards')
steps.push(['1.5.5 cards', snap()])

await n.advanceDay()
steps.push(['1.6 advance', snap()])

let sell = null
try {
  sell = await n.submitOrder({ side: 'sell', instrumentId: '601398', qty: 100, type: 'market' })
} catch (e) { sell = 'ERR ' + e.message }
steps.push(['1.7 sell', { ...snap(), res: sell && sell.accepted, code: sell && sell.reasonCode }])

n.chapterRead('panel.review', 5)
n.chapterClosePanel('panel.review')
steps.push(['1.8 review', snap()])

const opts = (n.runtimeState().chapter || {}).pendingChoice
const key = opts && opts.options && opts.options[0] ? opts.options[0].key : null
if (key) n.chapterAnswer('1.9.confirm', key)
n.chapterConfirm()
steps.push(['1.9 answer key=' + key, snap()])

const st = n.runtimeState()
steps.push(['final state', {
  beat: st.chapter && st.chapter.beatId,
  cash: st.cash, NAV: st.NAV, realized: st.realizedPnL,
  positions: st.positions, navHistory: st.navHistory,
}])
return JSON.stringify(steps, null, 1)
