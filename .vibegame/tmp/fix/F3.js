// F3 证明 —— 静音开着时：①第 3 次起被拒单的兜底安慰语**照常出现**（未被静音吞掉，且经唯一闸门）；
//             ②他主动补的提示（黄档 proactiveHint）**被静音吞掉**（对照，证明静音确实生效）。
// 全程走公开 API（devGotoBeat / setMuted / submitOrder / chapter.noteNav），与 DOM 同一条路径。
const b = sceneTree.nodes.get('broker')
const S = () => b.runtimeState()
const C = () => S().chapter
const L = () => C().mentor.line
const out = {}

// ── 0. 有账户（能下单）的干净章内状态，然后进入第二章 2.1
//      （2.1 的 submit 条件期望 REJECT_1；我们用 REJECT_6「非 100 股整数倍」落到**非期望**那一支）
try { window.localStorage.removeItem('market-101.save.v1') } catch (e) {}
b.devSkipToSandbox()
const comfort = C().copy.giveUpExhaustedLine
out.comfortText = comfort

// ── 1. 静音 ON：连交 5 次非期望拒单，兜底安慰语必须照常出现
b.setMuted(true)
b.resetChapterProgress()
b.devGotoBeat(2, '2.1')
const base = { mode: C().mode, beatId: C().beatId, muted: C().mentor.muted, line: L() }
const attempts = []
for (let i = 0; i < 5; i += 1) {
  const r = b.submitOrder({ side: 'buy', instrumentId: '601398', qty: 150, type: 'limit', price: 10.4 })
  attempts.push({ i: i + 1, reasonCode: r && r.reasonCode, accepted: r && r.accepted, line: L(), source: C().mentor.source })
}
const tail = C().mentorHistory.slice(-1)[0] || {}
out.base = base
out.attempts = attempts
out.historyTail = tail
out.checks = {
  mutedIsOn: C().mentor.muted === true,
  // ★ F3 本体：静音下兜底安慰语照常出现
  comfortSurvivesMute: attempts[attempts.length - 1].line === comfort,
  comfortSourceIsBeat: attempts[attempts.length - 1].source === 'beat',
  comfortRecordedInHistory: tail.line === comfort && tail.source === 'beat',
  rejectReasonIsLot: attempts.every((a) => a.reasonCode === 'REJECT_6'),
  beatUnchanged: C().beatId === '2.1',
}

// ── 2. 对照（静音 ON）：他主动补的黄档提示必须被吞掉
b.resetChapterProgress()
b.devGotoBeat(2, '2.1')
const beforeHint = L()
b.chapter.noteNav(20000) // 黄档（¥10,000 ≤ NAV < ¥50,000），不触红线
out.volunteerHintMuted = { before: beforeHint, after: L(), source: C().mentor.source, tier: C().moneyTier }
out.checks.volunteerHintSuppressedByMute = out.volunteerHintMuted.after === null
out.checks.hintTierWasYellow = out.volunteerHintMuted.tier === 'yellow'

// ── 3. 反向对照（静音 OFF）：同一句提示出现 → 上一步确实是被静音吞掉，而不是路径不通
b.resetChapterProgress()
b.devGotoBeat(2, '2.1')
b.setMuted(false)
b.chapter.noteNav(20000)
out.volunteerHintUnmuted = { after: L(), source: C().mentor.source }
out.checks.volunteerHintAppearsWhenUnmuted = typeof out.volunteerHintUnmuted.after === 'string' && out.volunteerHintUnmuted.after.length > 0
out.checks.volunteerHintSourceIsProactive = out.volunteerHintUnmuted.source === 'proactiveHint'

// ── 4. 反向对照（静音 OFF）：兜底安慰语照样出现 → 它的出现与静音无关
b.resetChapterProgress()
b.devGotoBeat(2, '2.1')
let r2 = null
for (let i = 0; i < 3; i += 1) r2 = b.submitOrder({ side: 'buy', instrumentId: '601398', qty: 150, type: 'limit', price: 10.4 })
out.comfortUnmuted = { line: L(), source: C().mentor.source, reasonCode: r2 && r2.reasonCode }
out.checks.comfortAlsoAppearsUnmuted = out.comfortUnmuted.line === comfort

return out
