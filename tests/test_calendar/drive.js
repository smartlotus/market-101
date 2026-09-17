/**
 * 驱动脚本：交易日历（PRD §2.3 / §3.1 / Edge Cases）。
 *
 * plan.md Verification Plan 行：
 *   §2.3 日历：点「进入下一交易日」→ dayIndex+1、inGameDate+1 自然日、周末 isMarketOpen=false、行情/NAV 不变
 *   Edge Case 休市日持仓不重估：持仓下推进周六→周日，marketValue 与 unrealizedPnL 前后一致，NAV 不变
 *   Edge Case 连续休市：从周五起连续 advanceDay 两次 → 周六、周日均休市、dayIndex 连 +2，第三次才到周一
 *   §3.1 顶栏当日涨跌幅休市日保持 0：休市日 dayReturnPct == 0
 *
 * 起点 2026-01-05 周一。先在第 1 日买入（建立持仓），再推进到周五，然后跨周末。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}

const cap = (label) => { out[label] = b.runtimeState() }

try {
  b.reset()
  cap('day1')

  // §2.3 普通交易日推进：+1 自然日、序号 +1
  b.advanceDay()
  cap('day2')

  // 建立持仓（限价 = 涨停价 → 立即成交于最新价），供「休市日持仓不重估」使用
  const id = '601398'
  out.buyOrder = b.submitOrder({
    side: 'buy',
    instrumentId: id,
    type: 'limit',
    price: b.runtimeState().quotes[id].limitUp,
    qty: 1000,
  })
  cap('day2Bought')

  // 推进到周五（dayIndex 5 / 2026-01-09）
  for (let i = 0; i < 3; i++) b.advanceDay()
  cap('day5Friday')

  // 周六（连续休市第 1 天）
  b.advanceDay()
  cap('day6Saturday')

  // 周日（连续休市第 2 天）
  b.advanceDay()
  cap('day7Sunday')

  // 周一（休市结束）
  b.advanceDay()
  cap('day8Monday')

  out.instrumentId = id
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
