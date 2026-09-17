// F4 / F5 / F6 / F1 证明 —— 全部走公开路径与真实 DOM。
const b = sceneTree.nodes.get('broker')
const S = () => b.runtimeState()
const C = () => S().chapter
const out = {}

// ── F5：快照的评级记录键名 = plan 的 `chapterGrades`，旧名 `grades` 已不再暴露
const snap = C()
out.F5 = {
  hasChapterGrades: Object.prototype.hasOwnProperty.call(snap, 'chapterGrades'),
  chapterGrades: snap.chapterGrades,
  legacyGradesKeyStillPresent: Object.prototype.hasOwnProperty.call(snap, 'grades'),
}

// ── F6：riskLine 的阈值来自 MONEY_TIERS（数据里只剩占位符，正文由运行时代入）
const tiers = snap.moneyTiers
const rawRisk = snap.copy.riskLine
out.F6 = { tiers, rawRiskLine: rawRisk, hardcodedInData: rawRisk.includes('10,000') }

// ── F4：结业评定面板上的免责声明（真实 DOM）
b.openNavStanding()
b.refresh()
const panel = document.querySelector('#chapter-root [data-role="nav-standing"]')
const disc = panel && panel.querySelector('[data-role="standing-disclaimer"]')
out.F4 = {
  panelOpen: !!(panel && !panel.classList.contains('ch-hidden')),
  disclaimerText: disc ? disc.textContent : null,
  expected: snap.copy.standingDisclaimer,
  rendered: !!disc,
  matchesData: !!disc && disc.textContent === snap.copy.standingDisclaimer,
  // 面板上确实还画着公式与档位（不是只多了一行空壳）
  hasTier: !!(panel && panel.querySelector('[data-role="standing-tier"]')),
  hasNavFinal: !!(panel && panel.querySelector('[data-role="standing-nav-final"]')),
}
const closer = panel && panel.querySelector('.hd .ch-btn')
if (closer) closer.click()
b.refresh()

// ── F6 续：freeDay 里触线那句的实际文本必须与 MONEY_TIERS 对齐
try { window.localStorage.removeItem('market-101.save.v1') } catch (e) {}
b.devSkipToSandbox()
b.setMode('freeDay')
b.sim.account.clearPositions()
b.sim.account.fund(9000)
b.advanceDay()
const spoken = C().mentor.line || ''
out.F6.freeDayLine = spoken
out.F6.freeDaySource = C().mentor.source
out.F6.expectedAmountText = '¥' + String(tiers.yellow).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// ── F1：存档白名单里不再有 `suspendedPanelId`（且没有任何运行时代码写它）
let whitelist = null
try {
  const mod = await import('/scripts/chapter/saveStore.js')
  whitelist = mod.saveWhitelistKeys()
} catch (e) {
  whitelist = 'IMPORT_FAILED: ' + e.message
}
out.F1 = {
  whitelistHasSuspended: Array.isArray(whitelist) ? whitelist.includes('chapter.suspendedPanelId') : null,
  whitelistChapterKeys: Array.isArray(whitelist) ? whitelist.filter((k) => k.startsWith('chapter.')) : whitelist,
  snapshotMentionsIt: JSON.stringify(C()).includes('suspendedPanelId'),
}

out.checks = {
  F5_snapshotUsesChapterGrades: out.F5.hasChapterGrades && !out.F5.legacyGradesKeyStillPresent,
  F6_dataHasNoLiteralThreshold: out.F6.hardcodedInData === false && rawRisk.includes('{amount}'),
  F6_spokenLineUsesTierValue: spoken.includes(out.F6.expectedAmountText),
  F4_disclaimerRendered: out.F4.rendered && out.F4.matchesData,
  F1_whitelistClean: out.F1.whitelistHasSuspended === false,
}

return out
