/**
 * 驱动脚本：行情推进公式（PRD §3.2）+ 当前事件可观察（§3.1）。
 *
 * plan.md Verification Plan 行：
 *   §3.2 行情公式：close ≈ prevClose×(1+eventMove+noise)，噪声容差 ±0.003；
 *        open = prevClose×(1+0.5×eventMove)；limitUp/limitDown = round(prevClose×(1±limitPct),0.01)
 *   §3.1 当前事件可观察（价格公式可对照）
 *
 * noise 是随机杂波，故先 `devSetEvent` 固定事件，再用噪声容差断言（plan 决策 D5）。
 * 事件只打 601398（GOOD / magnitude 0.5）→ eventMove 确定，且可顺带断言其他标的未串扰。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}
const TARGET = '601398'
const OTHER = '600519'

try {
  b.reset()
  // §3.1 当日事件可观察（第 1 日开机即抽一件）
  out.day1Event = b.runtimeState().currentEvent

  b.devSetEvent({
    id: 'DEV_QUOTE',
    type: 'COMPANY',
    targets: [TARGET],
    sentiment: 'GOOD',
    magnitude: 0.5,
    fxTarget: null,
    headline: 'dev 固定事件：仅用于公式断言',
    mentorLine: 'dev 导师点评',
    conceptKeys: [],
  })

  const before = b.runtimeState()
  b.advanceDay()
  const after = b.runtimeState()

  out.formula = {
    targetId: TARGET,
    otherId: OTHER,
    eventId: 'DEV_QUOTE',
    sentiment: 'GOOD',
    magnitude: 0.5,
    beforeClose: before.quotes[TARGET].close,
    beforeKlines: before.quotes[TARGET].klinesCount,
    targetQuote: after.quotes[TARGET],
    otherQuote: after.quotes[OTHER],
    afterKlines: after.quotes[TARGET].klinesCount,
    currentEvent: after.currentEvent,
    dayIndex: after.dayIndex,
    isMarketOpen: after.isMarketOpen,
  }
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
