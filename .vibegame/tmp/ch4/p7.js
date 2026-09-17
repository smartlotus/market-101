// 补充：流程图走查的**真实 DOM 点击**路径（与配对游戏同一条：DOM → runtime.chapterFlowStep）
const b = sceneTree.nodes.get('broker')
const c = () => b.runtimeState().chapter
const R = {}
b.devGotoChapter(4)
b.devGotoBeat(4, '4.4')
b.chapterOpenPanel('panel.flowWalk')
const p = document.querySelector('#game-container .ch-scrim[data-panel-id="panel.flowWalk"]')
R.before = JSON.parse(JSON.stringify(c().flowProgress))
R.progTextBefore = p.querySelector('.fw-prog').textContent
p.querySelector('.fw-card[data-step-id="buy"]').click()
R.afterFirst = JSON.parse(JSON.stringify(c().flowProgress))
R.progTextAfter = document.querySelector('#game-container .ch-scrim[data-panel-id="panel.flowWalk"] .fw-prog').textContent
R.railAfter = Array.from(document.querySelectorAll('#game-container .ch-scrim[data-panel-id="panel.flowWalk"] .fw-step .lb')).map((e) => e.textContent)
p.querySelector('.fw-card[data-step-id="register"]').click()
R.afterWrongDom = JSON.parse(JSON.stringify(c().flowProgress))
R.lastResult = document
  .querySelector('#game-container .ch-scrim[data-panel-id="panel.flowWalk"] [data-block-type="flowWalk"]')
  .getAttribute('data-last-result')
return R
