/**
 * 驱动脚本：重置账户（PRD §4）。
 *
 * plan.md Verification Plan 行：
 *   §4 重置：交易后 reset() → cash=100000 / frozenCash=0 / positions=[] / realizedPnL=0 /
 *            dayIndex=1 / 行情重生成
 *
 * 先把状态弄「脏」：成交过（realizedPnL ≠ 0）、有持仓、有冻结资金与挂单、已推进日历、净值序列变长。
 */
const b = sceneTree.nodes.get('broker')
// Stage 1 前置（Lead R2）：本任务把开局改成「未开户、cash=0、节拍 1.0」，而本测试断言的是
// Stage 0 的沙盒态（开局即可交易）。devSkipToSandbox() 进入的是产品第三种模式 `sandbox`，
// 与 Stage 0 沙盒完全一致 —— 是合法状态，不是测试专用 hack。
b.devSkipToSandbox()

const out = {}
const ID = '601398'
const snap = () => b.runtimeState()

try {
  b.reset()
  out.initial = snap() // 干净基线：重置后应当与它同形（行情随机故不逐值相等）
  b.selectInstrument(ID)
  out.defaultInstrument = b.runtimeState().selectedInstrumentId

  // 1) 成交一轮，制造 realizedPnL ≠ 0
  let s = snap()
  out.buy1 = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 100 })
  b.advanceDay()
  s = snap()
  out.sell1 = b.submitOrder({ side: 'sell', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitDown, qty: 100 })

  // 2) 再买入建立持仓
  s = snap()
  out.buy2 = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitUp, qty: 200 })

  // 3) 挂一笔不成交的限价买单，制造 frozenCash > 0 与 pendingOrders
  s = snap()
  out.pending = b.submitOrder({ side: 'buy', instrumentId: ID, type: 'limit', price: s.quotes[ID].limitDown, qty: 100 })

  out.dirty = snap()

  // 4) 重置
  out.clean = b.reset()
} catch (e) {
  out.fatal = String((e && e.stack) || e)
}

return out
