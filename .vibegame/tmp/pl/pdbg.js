const all = Array.from(document.querySelectorAll('#game-container > div'));
return {
  n: all.length,
  cls: all.map(e=>e.id+'|'+e.className),
  idPanel: !!document.getElementById('vg-menu-panel'),
  q1: document.querySelectorAll('#game-container .ch-scrim').length,
  q2: document.querySelectorAll('.ch-scrim.ch-open').length,
  q3: document.querySelectorAll('#game-container .ch-scrim.ch-open').length,
  panelId: sceneTree.nodes.get('broker').runtimeState().chapter.panelId,
  tag: document.getElementById('vg-menu-panel') ? document.getElementById('vg-menu-panel').tagName : null,
};
