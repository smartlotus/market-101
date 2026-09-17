// 第四章驱动 3/5：4.3 配对游戏（本章核心互动）—— 错配不写任何状态、无限重试、不记次数
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const c = () => st().chapter
const R = {}
const panel = () => document.querySelector('#game-container .ch-scrim[data-panel-id="panel.matchGame"]')
const prog = () => JSON.parse(JSON.stringify(c().matchProgress.institutions || { pairsDone: [] }))
const reqs = () => c().beatRequirements.map((r) => r.id + '=' + r.satisfied)
const snap = (tag) => ({
  tag,
  beatId: c().beatId,
  req: reqs(),
  pairsDone: prog().pairsDone,
  completedBeats: c().completedBeats,
  mentorLine: c().mentor.line,
})

R.dom = (() => {
  const p = panel()
  if (!p) return null
  return {
    open: p.classList.contains('ch-open'),
    prompt: p.querySelector('.mg-prompt') ? p.querySelector('.mg-prompt').textContent : null,
    progText: p.querySelector('.mg-prog') ? p.querySelector('.mg-prog').textContent : null,
    cards: Array.from(p.querySelectorAll('.mg-card')).map((e) => e.textContent),
    cardIds: Array.from(p.querySelectorAll('.mg-card')).map((e) => e.getAttribute('data-card-id')),
    targets: Array.from(p.querySelectorAll('.mg-target .t')).map((e) => e.textContent),
    canvasOrImg: p.querySelectorAll('canvas, img').length,
    unresolved: Array.from(p.querySelectorAll('[data-ch-unresolved]')).length,
  }
})()

R.start = snap('4.3 起点')

// ① 第一次配：走真实 DOM 点击（选中卡 → 点职责）
{
  const p = panel()
  p.querySelector('.mg-card[data-card-id="exchange"]').click()
  R.domPick = { pickedCard: p.getAttribute('data-picked-card') }
  p.querySelector('.mg-target[data-target-key="t.exchange"]').click()
}
R.afterDomPair = snap('4.3 DOM 配成第一对')

// ② 第二次配：走运行时钩子（与 DOM 同一条路径）
R.pairBroker = b.chapterMatch('institutions', 'broker', 't.broker')
R.afterTwo = snap('4.3 配成两对')

// ③ 故意配错一次：一张还没配的卡配到别人的职责上 —— 必须什么都不改
const beforeWrong = JSON.stringify({ p: prog(), r: reqs(), beat: c().beatId })
R.wrongPair = b.chapterMatch('institutions', 'bank', 't.broker')
const afterWrong = JSON.stringify({ p: prog(), r: reqs(), beat: c().beatId })
R.wrongPairStateUnchanged = beforeWrong === afterWrong
R.afterWrong = snap('4.3 错配之后')
R.noErrorCounter = !Object.keys(c()).some((k) => /err|wrong|fail|mistake/i.test(k))
R.pairNotRecorded = !prog().pairsDone.includes('bank')

// ④ 再故意错一次（同一张卡 + 不存在的目标），措辞与计数都不该出现
R.wrongPairAgain = b.chapterMatch('institutions', 'bank', 't.nonexistent')
R.afterWrongAgain = snap('4.3 再错一次之后')

// ⑤ 把剩下四对配完
R.pairs = [
  b.chapterMatch('institutions', 'bank', 't.bank'),
  b.chapterMatch('institutions', 'clearing', 't.clearing'),
  b.chapterMatch('institutions', 'regulator', 't.regulator'),
  b.chapterMatch('institutions', 'fundManager', 't.fundManager'),
]
R.finalPair = R.pairs[R.pairs.length - 1]
R.after43 = snap('4.3 完成')

// ⑥ 面板文案里不得出现「错」字样
{
  const p = document.querySelector('#game-container .ch-scrim[data-panel-id="panel.matchGame"]')
  R.panelTextHasCuo = p ? p.innerText.includes('错') : null
}
return R
