/**
 * 驱动脚本：事件池循环（PRD §3.3）。
 *
 * plan.md Verification Plan 行（lead 已按 auditor F1 修正）：
 *   注意开机已抽掉第 1 日的 1 件，即 drawnThisCycle === 1；
 *   再连续 devDrawEvent() **19 次** → usedIds 含 20 个互异 id（本轮用尽，cycle === 1）；
 *   再第 **20** 次 → cycle === 2、usedIds 长度回到 1、drawnThisCycle === 1
 *   （池空时先洗牌归零再计入本次抽签），且允许与上一轮重复。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}

try {
  b.reset()
  out.deckAfterReset = b.runtimeState().eventDeck

  const ids = []
  for (let i = 0; i < 19; i++) ids.push(b.devDrawEvent().id)
  out.idsAfter19 = ids
  out.deckAfter19 = b.runtimeState().eventDeck

  const twentieth = b.devDrawEvent()
  out.twentieth = { id: twentieth.id, headline: twentieth.headline, targets: twentieth.targets }
  out.deckAfter20 = b.runtimeState().eventDeck

  // 再抽一件：仍留在第 2 轮，usedIds 继续增长（第 2 轮内不重复）
  out.twentyFirst = { id: b.devDrawEvent().id }
  out.deckAfter21 = b.runtimeState().eventDeck
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
