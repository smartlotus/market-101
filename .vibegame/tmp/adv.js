const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
// 点掉当前所有可见的主按钮（章末/对话推进）
const btns = Array.from(document.querySelectorAll('#chapter-root button'))
  .filter((x) => x.offsetParent !== null && /开始|继续|下一步|知道了|看完了|收下/.test(x.textContent || ''));
for (const btn of btns.slice(0, 1)) btn.click();
return JSON.stringify({
  beat: C().beatId, shellMode: C().shellMode,
  goalVisible: !!document.querySelector('#chapter-root .ch-card'),
  btns: Array.from(document.querySelectorAll('#chapter-root button'))
    .filter((x) => x.offsetParent !== null)
    .map((x) => (x.textContent || '').slice(0, 14)).slice(0, 8),
});
