/**
 * 修复轮 1 · M4 的浏览器端验证：节拍 1.6 声明的 `highlight: "advanceDayButton"` 必须有消费者。
 * 临时脚本，跑完即弃。只做视觉强调 —— 顺带断言按钮**没有**被禁用/置灰/加遮罩。
 */
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const ch = () => st().chapter
const btn = () => document.querySelector('#broker-shell .topbar .cta')
const style = () => {
  const cs = getComputedStyle(btn())
  return { outlineWidth: cs.outlineWidth, outlineStyle: cs.outlineStyle, animationName: cs.animationName }
}
const probe = (label) => ({
  label,
  beatId: ch().beatId,
  cls: btn().className,
  hl: btn().classList.contains('hl'),
  dataset: btn().dataset.highlight || null,
  disabled: btn().disabled,
  ariaDisabled: btn().getAttribute('aria-disabled'),
  pointerEvents: getComputedStyle(btn()).pointerEvents,
  visibility: getComputedStyle(btn()).visibility,
  style: style(),
})

b.reset()
b.chapter.resetChapterProgress()
b.refresh()

// 复用与 B1 相同的驱动方式：走宿主对外方法把第一章推到 1.6
const reqDone = (s, id) => ((s.beatRequirements || []).find((r) => r.id === id) || {}).satisfied === true
function step() {
  const s = ch()
  if (s.chapterEndReached) return b.chapterConfirm()
  const beat = s.beat || {}
  const todo = (beat.require || []).filter((r) => !reqDone(s, r.id))
  if (!todo.length) return null
  const r = todo[0]
  if (r.kind === 'interact' || r.kind === 'advanceDay') return b.chapterAck(r.id)
  if (r.kind === 'read') {
    if (s.panelId !== r.panelId) b.chapterOpenPanel(r.panelId)
    b.chapterRead(r.panelId, Number(r.count || 1))
    if (r.mustClose) b.chapterClosePanel(r.panelId)
    return { ok: true }
  }
  if (r.kind === 'select') return b.selectInstrument(st().selectedInstrumentId || b.sim.selectCheapestAffordable())
  if (r.kind === 'choice') {
    let pc = ch().pendingChoice
    if (!pc) {
      const p = (beat.panels || [])[0]
      if (p) b.chapterOpenPanel(p)
      pc = ch().pendingChoice
    }
    return pc ? b.chapterAnswer(pc.id, pc.correctKey || (pc.options[0] && pc.options[0].key)) : null
  }
  if (r.kind === 'submit') {
    const state = st()
    const expect = r.expect || {}
    const spec =
      expect.side === 'sell'
        ? { side: 'sell', instrumentId: state.selectedInstrumentId, type: 'market', qty: 100 }
        : { side: 'buy', instrumentId: state.selectedInstrumentId, type: 'limit', price: state.quotes[state.selectedInstrumentId].lastPrice, qty: 100 }
    return b.submitOrder(spec)
  }
  return null
}

const seen = []
let guard = 0
while (ch().beatId !== '1.6' && Number(ch().chapterId) === 1 && guard < 80) {
  guard += 1
  step()
  const s = ch()
  if (s.beatId === '1.5.5' || s.beatId === '1.5' || s.beatId === '1.6') {
    if (!seen.find((x) => x.label === s.beatId)) seen.push(probe(s.beatId))
  }
}
const atOneSix = probe('1.6(点击前)')
// 真实点击顶栏按钮（玩家的那条路）
const clicked = btn().click()
const afterClick = probe('1.6 点击后')

return {
  highlightTargetsDeclared: (ch().beat && ch().beat.highlight) || null,
  atOthers: seen.filter((x) => x.label !== '1.6'),
  atOneSix,
  afterClick: { ...afterClick, clicked },
}
