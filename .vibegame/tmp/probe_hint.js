const b = sceneTree.nodes.get('broker');
const C = () => b.runtimeState().chapter;
const root = document.querySelector('#chapter-root');
// 找所有可能承载「下一步」提示的元素
const hintish = Array.from(root.querySelectorAll('*')).filter((e) => {
  const t = (e.textContent || '');
  return e.children.length === 0 && /下一步|还差|需要|请|待完成|目标/.test(t) && t.length < 60;
}).map((e) => e.className + ' :: ' + (e.textContent || '').trim());
return JSON.stringify({
  beat: C().beatId,
  requirements: C().beatRequirements,
  reqKinds: C().requireKinds,
  goalCardText: (document.querySelector('#chapter-root .ch-card') || {}).textContent?.slice(0, 200),
  hintish: hintish.slice(0, 10),
}, null, 1);
