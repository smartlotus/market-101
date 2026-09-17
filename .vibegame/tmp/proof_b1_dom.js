/**
 * 修复轮 1 · B1 的浏览器端证明（真实 DOM 路径）。临时脚本，跑完即弃。
 *
 * 序列（**全程不用任何 dev\* 钩子**）：
 *   ① 第一章 → 第二章：只走宿主对外的方法（与 DOM 控件回调共用同一条运行时路径）
 *   ② 触发红线：`chapter.noteNav(9000)` —— 这正是宿主 `BrokerShell.refresh/advanceDay/submitOrder`
 *      喂 NAV 用的那个入口（runtime 的「NAV 变化的唯一入口」），不是 dev 钩子
 *   ③ 补救段**只用真实面板按钮**：document.querySelector(...).click() → PanelHost._runAction
 *   ④ 断言：段落后面板消失、解除暂停、回到被打断的节拍、节拍推进恢复、同章配额不再触发
 */
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const ch = () => st().chapter
const trace = []

// 前置：世界与章节进度都回到起点（都是产品里的重置入口，不是 dev 钩子），让本脚本可重复跑
b.reset()
b.chapter.resetChapterProgress()
b.refresh()

const reqDone = (s, id) => ((s.beatRequirements || []).find((r) => r.id === id) || {}).satisfied === true
const panelOuter = () => document.querySelector('[data-panel-id="panel.extraSegment"]')
const panelVisible = () => {
  const e = panelOuter()
  return !!e && e.style.display !== 'none' && e.classList.contains('ch-open')
}
const segmentButton = (actionId) =>
  document.querySelector(`[data-panel-id="panel.extraSegment"] button[data-action-id="${actionId}"]`)
const clickSegment = (actionId) => {
  const btn = segmentButton(actionId)
  if (!btn) return { ok: false, reason: 'no_button' }
  if (btn.disabled) return { ok: false, reason: 'button_disabled' }
  btn.click()
  return { ok: true }
}

function dispatch(r, beat, s) {
  if (r.kind === 'interact' || r.kind === 'advanceDay') return b.chapterAck(r.id)
  if (r.kind === 'read') {
    if (s.panelId !== r.panelId) b.chapterOpenPanel(r.panelId)
    b.chapterRead(r.panelId, Number(r.count || 1))
    if (r.mustClose) b.chapterClosePanel(r.panelId)
    return { ok: true }
  }
  if (r.kind === 'select') {
    if (r.instrumentId) return b.selectInstrument(r.instrumentId)
    const picked = b.sim.selectCheapestAffordable()
    return b.selectInstrument(picked)
  }
  if (r.kind === 'choice') {
    let pc = ch().pendingChoice
    if (!pc) {
      const p = (beat.panels || [])[0]
      if (p) b.chapterOpenPanel(p)
      pc = ch().pendingChoice
    }
    if (!pc) return { ok: false, reason: 'no_choice' }
    return b.chapterAnswer(pc.id, pc.correctKey || (pc.options[0] && pc.options[0].key))
  }
  if (r.kind === 'submit') {
    const expect = r.expect || {}
    const state = st()
    let spec
    if (expect.side === 'sell') {
      const pos = (state.positions || [])[0]
      spec = {
        side: 'sell',
        instrumentId: pos ? pos.instrumentId : state.selectedInstrumentId,
        type: 'market',
        qty: pos ? pos.qty : 100,
      }
    } else {
      const type = expect.type === 'market' ? 'market' : 'limit'
      const id = state.selectedInstrumentId
      spec = { side: 'buy', instrumentId: id, type, qty: 100, price: null }
      if (type === 'limit') spec.price = state.quotes[id].lastPrice
    }
    return b.submitOrder(spec)
  }
  return { ok: false, reason: 'unknown_kind:' + r.kind }
}

// ① 第一章 → 第二章（真实回调路径）
let guard = 0
while (Number(ch().chapterId) === 1 && guard < 200) {
  guard += 1
  const s = ch()
  if (s.chapterEndReached) {
    const r = b.chapterConfirm()
    trace.push(`confirm => ${JSON.stringify(r)}`)
    continue
  }
  const beat = s.beat || {}
  const todo = (beat.require || []).filter((r) => !reqDone(s, r.id))
  if (!todo.length) {
    trace.push(`wait ${s.beatId}`)
    continue
  }
  const r = todo[0]
  const res = dispatch(r, beat, s)
  trace.push(`${s.beatId} ${r.kind} ${r.id} => ${JSON.stringify(res && (res.ok !== undefined ? res.ok : res.reason))}`)
}
const afterCh1 = ch()
const entered = { chapterId: afterCh1.chapterId, beatId: afterCh1.beatId, steps: guard }

// ② 触发红线（runtime 的 NAV 入口；宿主自己就是这么喂的）
const openBefore = st().isMarketOpen
b.chapter.noteNav(9000)
b.refresh()
const hit = ch()
const panelState = {
  visible: panelVisible(),
  display: panelOuter() ? panelOuter().style.display : null,
  hasFinishButton: !!segmentButton('extra.finish'),
  hasTopUpButton: !!segmentButton('extra.topUp'),
  finishDisabled: segmentButton('extra.finish') ? segmentButton('extra.finish').disabled : null,
}

// ③ 只用真实按钮完成补救段
const clicks = []
for (let i = 0; i < 10 && ch().extraSegment; i += 1) {
  const stepBefore = ch().extraSegment ? ch().extraSegment.stepIndex : null
  const res = clickSegment('extra.finish')
  clicks.push({
    click: i + 1,
    stepBefore,
    stepAfter: ch().extraSegment ? ch().extraSegment.stepIndex : null,
    res,
    panelId: ch().panelId,
    segmentLeft: ch().extraSegment ? ch().extraSegment.kind : null,
  })
}
const done = ch()

// ④ 推进恢复：红线之后 2.1 照常可完成（走产品出口）
let resumed = null
if (done.beatId === '2.1' && !done.extraSegment) {
  if (openBefore) {
    const s2 = st()
    const res = b.submitOrder({
      side: 'buy',
      instrumentId: '600519',
      type: 'limit',
      price: s2.quotes['600519'].lastPrice,
      qty: 100,
    })
    resumed = { via: 'submitOrder', result: res && res.reasonCode, beatId: ch().beatId }
  }
  if (!resumed || ch().beatId !== '2.2') {
    const g = b.chapterGiveUp('2.1')
    resumed = { via: 'giveUp', ok: g && g.ok, beatId: ch().beatId, first: resumed }
  }
}

// 配额：同章第二次红线不再触发
b.chapter.noteNav(500)
b.refresh()
const second = ch()

return {
  enteredChapter2: entered,
  redLine: {
    redLineActive: hit.redLineActive,
    extraSegment: hit.extraSegment ? { kind: hit.extraSegment.kind, origin: hit.extraSegment.origin, steps: hit.extraSegment.steps.length } : null,
    panelId: hit.panelId,
    paused: hit.paused,
    interruptedBeatId: hit.interruptedBeatId,
    remedialUsedThisChapter: hit.remedialUsedThisChapter,
    moneyTier: hit.moneyTier,
  },
  panelDom: panelState,
  clicks,
  afterSegment: {
    extraSegment: done.extraSegment,
    panelId: done.panelId,
    paused: done.paused,
    redLineActive: done.redLineActive,
    interruptedBeatId: done.interruptedBeatId,
    beatId: done.beatId,
    panelStillVisible: panelVisible(),
    allRequiresUnsatisfied: (done.beatRequirements || []).every((r) => !r.satisfied),
  },
  resumed,
  quotaSecondRedLine: { extraSegment: second.extraSegment, panelId: second.panelId, moneyTier: second.moneyTier },
  trace,
}
