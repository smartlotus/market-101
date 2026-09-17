// 第四章驱动 5/5：4.5 不判对错的选择题 → 4.6 三条坏消息词条 → 4.7 章末
//                       + 章末面板 + 确认 → freeDay；并直接证明「不评级 / 不插补救段」
const b = sceneTree.nodes.get('broker')
const st = () => b.runtimeState()
const c = () => st().chapter
const R = { trace: [] }
const openPanels = () =>
  Array.from(document.querySelectorAll('#game-container .ch-scrim.ch-open')).map((e) => e.getAttribute('data-panel-id'))
const panelText = (id) => {
  const p = document.querySelector('#game-container .ch-scrim[data-panel-id="' + id + '"]')
  return p ? p.innerText.replace(/\s+/g, ' ') : null
}
const snap = (tag) => {
  const row = {
    tag,
    beatId: c().beatId,
    req: c().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    panelId: c().panelId,
    openPanels: openPanels(),
    endPhase: c().endPhase,
    chapterEndReached: c().chapterEndReached,
    rating: c().rating,
    extraSegment: c().extraSegment,
    remedialUsedThisChapter: c().remedialUsedThisChapter,
    redLineActive: c().redLineActive,
    mode: c().mode,
  }
  R.trace.push(row)
  return row
}

// ── 4.5：两道选项都推进、都不判错 ─────────────────────────────────────────────
R.choice45 = (() => {
  const ch = c().pendingChoice
  return {
    id: ch.id,
    question: ch.question,
    correctKey: ch.correctKey,
    options: ch.options.map((o) => o.key),
    feedbackByOption: ch.feedbackByOption,
  }
})()
R.answer45a = b.chapterAnswer('4.5.ifNoRule', 'same')
R.after45a = snap('4.5 选了「太平的时候看不出区别」')
R.answer45b = (() => {
  b.devGotoBeat(4, '4.5')
  b.chapterOpenPanel('panel.ifNoRule')
  const r = b.chapterAnswer('4.5.ifNoRule', 'used')
  return r
})()
R.after45b = snap('4.5 重进后再选「钱可能被拿去用」')

// ── 4.6：三条坏消息词条（读满 + 关面板）──────────────────────────────────────
R.after46enter = (() => {
  b.devGotoBeat(4, '4.6')
  b.chapterOpenPanel('panel.badNews')
  return snap('4.6 起点')
})()
R.badNewsDom = (() => {
  const p = document.querySelector('#game-container .ch-scrim[data-panel-id="panel.badNews"]')
  if (!p) return null
  return {
    cards: Array.from(p.querySelectorAll('[data-concept-key]')).map((e) => e.getAttribute('data-concept-key')),
    names: Array.from(p.querySelectorAll('.ch-card-blk .hd .t')).map((e) => e.textContent),
    canvasOrImg: p.querySelectorAll('canvas, img').length,
    missing: Array.from(p.querySelectorAll('[data-ch-missing]')).length,
    unresolved: Array.from(p.querySelectorAll('[data-ch-unresolved]')).length,
    text: p.innerText.replace(/\s+/g, ' ').slice(0, 320),
  }
})()
b.chapterRead('panel.badNews', 1)
b.chapterClosePanel('panel.badNews')
R.after46partial = snap('4.6 只读 1 条就关（不应满足）')
b.chapterOpenPanel('panel.badNews')
b.chapterRead('panel.badNews', 2)
b.chapterClosePanel('panel.badNews')
R.after46 = snap('4.6 读满 3 条并关面板')

// ── 4.7：章末（台词逐字 + 对话层的「继续」）──────────────────────────────────
R.after47enter = (() => {
  b.devGotoBeat(4, '4.7')
  return snap('4.7 起点')
})()
R.beat47 = {
  mentorLine: c().mentor.line,
  mentorTiming: (c().beat.mentor[0] || {}).timing,
  verdict: c().verdict || null,
  endOfChapter: c().beat.endOfChapter === true,
}
R.continueButton = (() => {
  const btn = document.querySelector('#chapter-root [data-require-id="4.7.finish"]')
  return btn ? btn.textContent : null
})()
b.chapterAck('4.7.finish')
R.after47 = snap('4.7 完成（章末）')
R.chapterEndDom = {
  confirmOpen: openPanels(),
  confirmText: panelText('panel.confirm'),
}

// ── 红线在本章空转（不建段、不开面、不出声）──────────────────────────────────
R.redLineProbe = (() => {
  const before = JSON.stringify(c().extraSegment)
  const ok = b.chapter.triggerRedLine()
  return { returned: ok, before, after: JSON.stringify(c().extraSegment), redLineActive: c().redLineActive, endPhase: c().endPhase }
})()

// ── 章末确认 → freeDay；本章无评级、无加演/补救 ────────────────────────────────
R.confirm = b.chapterConfirm()
R.afterConfirm = snap('确认后')
R.final = {
  chapterId: c().chapterId,
  mode: c().mode,
  endPhase: c().endPhase,
  unlockedChapters: c().unlockedChapters,
  grades: c().grades,
  injectionsTotal: c().injectionsTotal,
  extraSegment: c().extraSegment,
  rating: c().rating,
  remedialUsedThisChapter: c().remedialUsedThisChapter,
  redLineActive: c().redLineActive,
  nextChapter: c().nextChapter,
  unlockedInstruments: c().unlockedInstruments,
}
return R
