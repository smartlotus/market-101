/**
 * 费用与货币精度 —— 纯算术模块。
 *
 * 无 DOM、无 Phaser、不继承 Node：可被 `vibegame play eval` 直接 import 并断言。
 * 公式来源：PRD §3.4 / GDD `computeFee`（A 股列）。
 */

const RULES = {
  A_SHARE: {
    currency: 'CNY',
    lotSize: 100,          // 1 手 = 100 股
    tick: 0.01,            // 价格最小变动 ¥0.01
    commissionRate: 0.00025,
    commissionMin: 5,
    transferFeeRate: 0.00001,
    stampDutyRate: 0.0005, // 印花税仅卖出收取
  },
}

export const LOT_SIZE = RULES.A_SHARE.lotSize
export const PRICE_TICK = RULES.A_SHARE.tick

export function marketRules(market) {
  const rules = RULES[market]
  if (!rules) throw new Error(`未知市场：${market}`)
  return rules
}

/**
 * 货币金额 / 价格统一四舍五入到 ¥0.01。
 * 全部存储、比较、展示前都必须过这一层，避免 0.30000000000000004 类浮点尾数外泄。
 */
export function roundMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const cents = n * 100
  const rounded = Math.round(cents + (cents >= 0 ? 1e-6 : -1e-6)) / 100
  return rounded === 0 ? 0 : rounded
}

/** 是否是 ¥0.01 的整数倍（价格精度校验用）。 */
export function isPriceTickAligned(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6
}

/**
 * A 股费用（PRD §3.4）：
 *   买入 = max(notional × 0.00025, 5) + notional × 0.00001
 *   卖出 = max(notional × 0.00025, 5) + notional × 0.0005 + notional × 0.00001
 * 返回四舍五入到 ¥0.01 的总费用。
 */
export function computeFee(market, side, notional) {
  const rules = marketRules(market)
  const base = Math.max(0, Number(notional) || 0)
  const commission = Math.max(base * rules.commissionRate, rules.commissionMin)
  const stampDuty = side === 'sell' ? base * rules.stampDutyRate : 0
  const transferFee = base * rules.transferFeeRate
  return roundMoney(commission + stampDuty + transferFee)
}

/**
 * 逐项费用明细（下单面板必须逐项展示：手续费 / 印花税 / 过户费）。
 * `total` 恒等于 computeFee 的结果；分项与总额若因四舍五入差 1 分，差额并入手续费，
 * 保证玩家看到的明细自身相加等于合计。
 */
export function feeBreakdown(market, side, notional) {
  const rules = marketRules(market)
  const base = Math.max(0, Number(notional) || 0)
  let commission = roundMoney(Math.max(base * rules.commissionRate, rules.commissionMin))
  const stampDuty = side === 'sell' ? roundMoney(base * rules.stampDutyRate) : 0
  const transferFee = roundMoney(base * rules.transferFeeRate)
  const total = computeFee(market, side, notional)
  const drift = roundMoney(total - (commission + stampDuty + transferFee))
  if (drift !== 0) commission = roundMoney(commission + drift)
  return { commission, stampDuty, transferFee, total }
}
