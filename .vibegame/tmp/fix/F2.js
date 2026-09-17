// F2 证明 —— freeDay 下「结业评定数字 = 净值曲线末点」+「纯行情触线开口」。
// 全程只调用与 DOM 同一条回调路径的公开 API（setMode / submitOrder / advanceDay）。
const b = sceneTree.nodes.get('broker')
const S = () => b.runtimeState()
const C = () => S().chapter
const out = {}

// ── 0. 干净开局：开户 + 入金 ¥100,000 + 第 1 个交易日（Stage 0 沙盒同态），再切 freeDay
try { window.localStorage.removeItem('market-101.save.v1') } catch (e) {}
b.devSkipToSandbox()
b.setMode('freeDay')

// ── 1. 买一笔，让 NAV 真的会随行情动（否则曲线是恒线，证明没有意义）
const quotes = S().quotes || {}
const px = (quotes['601398'] || {}).lastPrice
const order = b.submitOrder({ side: 'buy', instrumentId: '601398', qty: 200, type: 'limit', price: px })
out.order = { accepted: order && order.accepted, reasonCode: order && order.reasonCode, price: px }

const read = () => {
  const s = b.sim.snapshot()
  const st = C().graduationStanding
  const hist = s.navHistory || []
  return {
    mode: C().mode,
    histLen: hist.length,
    // 面板净值曲线的数据源（NavStandingView._series = state.navHistory）
    curveLast: hist.length ? hist[hist.length - 1] : null,
    simNAV: s.NAV,
    // 面板上印出来的两个数字（NAV_final / 调整后累计收益）
    navFinal: st.finalNav,
    adjustedCumReturn: st.adjustedCumReturn,
    injectionsTotal: st.injectionsTotal,
    tier: st.tier,
  }
}

out.before = read()

// ── 2. freeDay 推进 6 个交易日：**不**下单、**不**补足、**不**重置
const days = []
for (let i = 0; i < 6; i += 1) {
  b.advanceDay()
  days.push(read())
}
out.days = days
out.after = read()

out.checks = {
  inFreeDay: out.after.mode === 'freeDay',
  curveGrew: out.after.histLen > out.before.histLen,
  // NAV 真的变了 → 这个证明不是「恒线也相等」的假绿
  navActuallyMoved: out.after.navFinal !== out.before.navFinal,
  // 推进期间曲线逐日真的在动（不同取值的点数 > 1）
  curveMovedDuringFreeDay: new Set(days.map((d) => d.curveLast)).size > 1,
  // ★ F2 本体：面板的 NAV_final 与同一面板曲线末点逐字相等（每一天都相等）
  navFinalEqualsCurveLast: out.after.navFinal === out.after.curveLast,
  everyDayConsistent: days.every((d) => d.navFinal === d.curveLast),
  // 与市场层 NAV 同口径
  navFinalEqualsSimNAV: out.after.navFinal === out.after.simNAV,
  // 没有发生任何外来入金 → 上面的一致性不是靠补钱凑出来的
  injectionsUnchanged: out.after.injectionsTotal === out.before.injectionsTotal,
}

// ── 3. 纯行情下跌触线：NAV 由**市场层**降下来（不经过任何下单 / 补足 / 重置），
//       然后照常推进一个交易日 —— 警示线必须在这次推进上开口。
out.beforeDrop = read()
b.sim.account.clearPositions()
b.sim.account.fund(9000) // 直接改世界状态：章层此刻还「不知道」（lastNav 仍是上一日的高位）
out.staleBeforeAdvance = { reportedNav: C().graduationStanding.finalNav, line: C().mentor.line, source: C().mentor.source }
b.advanceDay() // 一次普通的「进入下一交易日」，没有任何玩家操作
const afterDrop = {
  line: C().mentor.line,
  source: C().mentor.source,
  nav: C().graduationStanding.finalNav,
  curveLast: b.sim.snapshot().navHistory.slice(-1)[0],
  hist: C().mentorHistory.slice(-1),
}
out.drop = afterDrop
out.checks.riskWarningFiredOnDayAdvance =
  typeof afterDrop.line === 'string' && afterDrop.line.length > 0 && afterDrop.source === 'riskWarning'
out.checks.riskWarningBelowLine = afterDrop.nav < 10000
out.checks.riskWarningMatchesCurve = afterDrop.nav === afterDrop.curveLast

return out
