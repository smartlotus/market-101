// 第四章驱动 4/5：4.4 流程图走查 —— 错序只让这一步不算：不重置已走步骤、不计数、不写任何状态
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const c = () => st().chapter
const R = {}
const panel = () => document.querySelector('#game-container .ch-scrim[data-panel-id="panel.flowWalk"]')
const flow = () => JSON.parse(JSON.stringify(c().flowProgress.orderFlow || { index: 0, done: [] }))
const snap = (tag) => ({ tag, beatId: c().beatId, req: c().beatRequirements.map((r) => r.id + '=' + r.satisfied), flow: flow() })

R.dom = (() => {
  const p = panel()
  if (!p) return null
  return {
    open: p.classList.contains('ch-open'),
    prompt: p.querySelector('.fw-prompt') ? p.querySelector('.fw-prompt').textContent : null,
    progText: p.querySelector('.fw-prog') ? p.querySelector('.fw-prog').textContent : null,
    empty: p.querySelector('.fw-empty') ? p.querySelector('.fw-empty').textContent : null,
    pool: Array.from(p.querySelectorAll('.fw-card .lb')).map((e) => e.textContent),
    poolIds: Array.from(p.querySelectorAll('.fw-card')).map((e) => e.getAttribute('data-step-id')),
    canvasOrImg: p.querySelectorAll('canvas, img').length,
    unresolved: Array.from(p.querySelectorAll('[data-ch-unresolved]')).length,
  }
})()

R.start = snap('4.4 起点')

// ① 开局先点错一步（顺序里的第 4 步）—— 必须一整章状态零变化
{
  const before = JSON.stringify(c())
  R.wrongFirst = b.chapterFlowStep('orderFlow', 'clearing')
  const after = JSON.stringify(c())
  R.wrongFirstStateUnchanged = before === after
}
R.afterWrongFirst = snap('4.4 错序第一步之后')
R.stillNoSteps = flow().index === 0 && flow().done.length === 0

// ② 走对前三步
R.steps1 = [b.chapterFlowStep('orderFlow', 'buy'), b.chapterFlowStep('orderFlow', 'broker'), b.chapterFlowStep('orderFlow', 'match')]
R.afterThree = snap('4.4 走对三步')

// ③ 中间再故意错一步（该点 clearing，却点 custody）—— 已走的三步一步都不能被重置
R.wrongMiddle = b.chapterFlowStep('orderFlow', 'custody')
R.afterWrongMiddle = snap('4.4 中间错序之后')
R.keptThree = flow().index === 3 && JSON.stringify(flow().done) === JSON.stringify(['buy', 'broker', 'match'])
R.wrongNotRecorded = !flow().done.includes('custody')

// ④ 走完剩下的四步
R.steps2 = [
  b.chapterFlowStep('orderFlow', 'clearing'),
  b.chapterFlowStep('orderFlow', 'custody'),
  b.chapterFlowStep('orderFlow', 'register'),
  b.chapterFlowStep('orderFlow', 'regulate'),
]
R.after44 = snap('4.4 走完')
R.rail = (() => {
  const p = document.querySelector('#game-container .ch-scrim[data-panel-id="panel.flowWalk"]')
  return p ? { steps: Array.from(p.querySelectorAll('.fw-step .lb')).map((e) => e.textContent), hasCuo: p.innerText.includes('错') } : null
})()
return R
