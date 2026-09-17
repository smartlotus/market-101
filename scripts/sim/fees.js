/**
 * 费用、精度与市场规则 —— 纯算术模块。
 *
 * 无 DOM、无 Phaser、不继承 Node：可被 `vibegame play eval` 直接 import 并断言。
 * 公式来源：PRD §3.4 / GDD `### Market & Instrument Rules` 七类市场逐条规则。
 *
 * 设计约束：
 *   1. A 股的费率与返回值必须与 Stage 0 完全一致（既有测试逐项断言）。
 *   2. 每个市场自带 `currency / lotSize / tick / limitPct / tPlus`，
 *      让上层（行情、撮合、下单面板）不必再散落 `if (market === ...)`。
 *   3. 费用一律以**该市场的计价货币**计算，再由调用方按当日汇率折算入 NAV。
 */

/** 计价货币 → 展示符号（UI 用；折算仍走 fx 模块）。 */
export const CURRENCY_SIGN = { CNY: '¥', HKD: 'HK$', USD: '$', USDT: 'USDT' }

/** 该市场的取值精度（价格最小变动价位）。 */
const TICK = { CNY: 0.01, HKD: 0.01, USD: 0.01, USDT: 0.0001 }

const RULES = {
  A_SHARE: {
    label: 'A 股',
    currency: 'CNY',
    lotSize: 100, // 1 手 = 100 股
    tick: 0.01,
    limitPct: 0.1, // 主板 ±10%
    tPlus: 1, // T+1
    commissionRate: 0.00025,
    commissionMin: 5,
    transferFeeRate: 0.00001,
    stampDutyRate: 0.0005, // 仅卖出
    stampDutySides: ['sell'],
  },
  ETF: {
    label: 'ETF（场内）',
    currency: 'CNY',
    lotSize: 100, // 1 手 = 100 份
    tick: 0.01,
    limitPct: 0.1,
    tPlus: 1,
    commissionRate: 0.00025,
    commissionMin: 5,
    // 免印花税、免过户费
  },
  FUND: {
    label: '公募基金（场外）',
    currency: 'CNY',
    lotSize: null, // 按金额申购，无「手」
    tick: 0.0001, // 净值精度
    limitPct: null, // 无涨跌停
    tPlus: 'nav', // 未知价交易：按 T 日收市后净值成交
    minAmount: 100, // 100 元起
    subscribeRate: 0.0015, // 申购费
    managementRate: 0.012, // 年化管理费，从净值里扣（隐形）
    redemptionTiers: [
      { maxDays: 7, rate: 0.015 }, // < 7 天
      { maxDays: 365, rate: 0.005 }, // 7–365 天
      { maxDays: null, rate: 0 }, // > 365 天
    ],
    redemptionSettleDays: 3, // 赎回款 T+3 到账（确定性）
    confirmDays: 1, // 申购 T+1 确认份额
  },
  HK: {
    label: '港股',
    currency: 'HKD',
    lotSize: 'per-instrument', // 每手股数不固定
    tick: 0.01,
    limitPct: null, // 无涨跌停
    tPlus: 0,
    commissionRate: 0.0005,
    commissionMin: 50,
    stampDutyRate: 0.0013,
    stampDutySides: ['buy', 'sell'], // 双边
    platformFee: 15, // 每笔固定 15 HKD
  },
  US: {
    label: '美股',
    currency: 'USD',
    lotSize: 1, // 1 股起
    fractionalMin: 0.001, // 支持碎股
    tick: 0.01,
    limitPct: null,
    tPlus: 0,
    commissionRate: 0, // 零佣金
    commissionMin: 0,
    platformFee: 0.99, // 每笔固定 0.99 USD
  },
  CRYPTO: {
    label: '加密货币',
    currency: 'USDT',
    lotSize: null,
    tick: 0.0001,
    limitPct: null, // 无涨跌停
    tPlus: 0,
    minAmount: 100, // 下单金额须 ≥ 100 元
    commissionRate: 0.001, // 0.1% 双边
  },
  OPTION: {
    label: '期权',
    currency: 'CNY',
    lotSize: 1, // 1 张
    multiplier: 10000, // 1 张 = 10000 份标的
    tick: 0.0001, // 权利金最小变动 0.0001/份
    limitPct: null,
    tPlus: 0,
    commissionRate: 0.0002,
    commissionMin: 1.5,
    exchangeFeePerLot: 1.6, // 交易所费 1.6 元/张
  },
}

/** 前向兼容：Stage 0 只在 A 股上跑，这两个常量仍指向 A 股。 */
export const LOT_SIZE = RULES.A_SHARE.lotSize
export const PRICE_TICK = RULES.A_SHARE.tick

export const MARKETS = Object.keys(RULES)

export function marketRules(market) {
  const rules = RULES[market]
  if (!rules) throw new Error(`未知市场：${market}`)
  return rules
}

/** 该市场的计价货币。 */
export function currencyOf(market) {
  return marketRules(market).currency
}

/** 该市场的价格最小变动价位。 */
export function tickOf(market) {
  return marketRules(market).tick
}

/**
 * 该标的的下单规则（把「按市场」与「按标的」两层合起来）。
 * `instrument` 可带 `lotSize`（港股逐标的每手股数）、`limitPct`（A 股/ETF 板块差异）。
 */
export function rulesFor(market, instrument = null) {
  const base = marketRules(market)
  const out = { ...base, market }
  const inst = instrument || {}
  if (base.lotSize === 'per-instrument') {
    out.lotSize = Number(inst.lotSize) || 100
    out.lotSizeIsPerInstrument = true
  }
  if (inst.limitPct !== undefined && inst.limitPct !== null) out.limitPct = Number(inst.limitPct)
  return out
}

/**
 * 货币金额 / 价格统一四舍五入到分位。
 * A 股按 ¥0.01；加密等低单价市场按 0.0001（见 roundTo）。
 */
export function roundMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const cents = n * 100
  const rounded = Math.round(cents + (cents >= 0 ? 1e-6 : -1e-6)) / 100
  return rounded === 0 ? 0 : rounded
}

/** 按给定位数四舍五入（加密 4 位、基金净值 4 位）。 */
export function roundTo(value, decimals) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const f = Math.pow(10, decimals)
  const r = Math.round(n * f + (n >= 0 ? 1e-9 : -1e-9)) / f
  return r === 0 ? 0 : r
}

/** 按该市场的 tick 四舍五入。 */
export function roundToTick(value, market) {
  const tick = tickOf(market)
  const decimals = tick >= 0.01 ? 2 : 4
  return roundTo(value, decimals)
}

/** 是否是 ¥0.01 的整数倍（A 股价格精度校验用，Stage 0 契约）。 */
export function isPriceTickAligned(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6
}

/** 是否是**该市场** tick 的整数倍。 */
export function isTickAligned(value, market) {
  const tick = tickOf(market)
  const n = Number(value)
  if (!Number.isFinite(n)) return false
  const q = n / tick
  return Math.abs(q - Math.round(q)) < 1e-6
}

/** 数量是否符合该市场的最小交易单位。返回 null 表示合规，否则返回可读原因键。 */
export function checkLot(market, qty, instrument = null) {
  const rules = rulesFor(market, instrument)
  const q = Number(qty)
  if (!Number.isFinite(q) || q <= 0) return 'qty_not_positive'
  if (rules.lotSize === null) return null // 按金额下单的市场（基金/加密）不校验「手」
  if (rules.fractionalMin !== undefined) {
    // 美股：整数股或碎股，最小 0.001 股，且必须是 0.001 的整数倍
    const steps = q / rules.fractionalMin
    if (Math.abs(steps - Math.round(steps)) > 1e-6) return 'lot'
    if (q < rules.fractionalMin) return 'lot'
    return null
  }
  const lot = Number(rules.lotSize) || 1
  if (Math.abs(q / lot - Math.round(q / lot)) > 1e-9) return 'lot'
  return null
}

/**
 * 单笔费用（PRD §3.4 的 A 股公式为主干，其余市场按其规则表扩展）。
 *
 * @param {string} market
 * @param {'buy'|'sell'} side
 * @param {number} notional  成交金额（**该市场计价货币**）
 * @param {object} [ctx]     `{ holdingDays, lots }`
 *        - `holdingDays`：基金赎回费的持有期档位
 *        - `lots`：期权按张计的交易所费
 */
export function computeFee(market, side, notional, ctx = {}) {
  const rules = marketRules(market)
  const base = Math.max(0, Number(notional) || 0)

  // 1) 场外基金：申购费 / 赎回费（按持有期），没有佣金概念
  if (rules.subscribeRate !== undefined) {
    if (side === 'buy') return roundMoney(base * rules.subscribeRate)
    return roundMoney(base * redemptionRateOf(market, ctx.holdingDays))
  }

  // 2) 其余市场：佣金（有下限）+ 印花税（分边）+ 过户费 + 平台费 + 交易所费
  const rate = Number(rules.commissionRate) || 0
  const floor = Number(rules.commissionMin) || 0
  const commission = rate > 0 ? Math.max(base * rate, floor) : 0
  const stampSides = rules.stampDutySides || []
  const stampDuty = stampSides.indexOf(side) >= 0 ? base * (Number(rules.stampDutyRate) || 0) : 0
  const transferFee = base * (Number(rules.transferFeeRate) || 0)
  const platformFee = Number(rules.platformFee) || 0
  const exchangeFee = (Number(rules.exchangeFeePerLot) || 0) * (Number(ctx.lots) || 0)
  return roundMoney(commission + stampDuty + transferFee + platformFee + exchangeFee)
}

/** 基金赎回费率（按持有天数落到档位上）。 */
export function redemptionRateOf(market, holdingDays) {
  const rules = marketRules(market)
  const tiers = rules.redemptionTiers || []
  const days = Number(holdingDays)
  if (!Number.isFinite(days) || days < 0) return tiers.length ? tiers[tiers.length - 1].rate : 0
  for (const t of tiers) {
    if (t.maxDays === null || t.maxDays === undefined) return t.rate
    if (days < t.maxDays) return t.rate
  }
  return 0
}

/**
 * 逐项费用明细（下单面板逐项展示）。
 * `total` 恒等于 computeFee 的结果；若分项相加因四舍五入差 1 分，差额并入手续费，
 * 保证玩家看到的明细自身相加等于合计。
 */
export function feeBreakdown(market, side, notional, ctx = {}) {
  const rules = marketRules(market)
  const base = Math.max(0, Number(notional) || 0)
  const items = []

  if (rules.subscribeRate !== undefined) {
    if (side === 'buy') {
      const subscribeFee = roundMoney(base * rules.subscribeRate)
      items.push({ key: 'subscribe', label: '申购费', amount: subscribeFee })
    } else {
      const rate = redemptionRateOf(market, ctx.holdingDays)
      const days = Number(ctx.holdingDays)
      const label = !Number.isFinite(days)
        ? '赎回费'
        : days < 7
          ? '赎回费（持有 < 7 天）'
          : days <= 365
            ? '赎回费（持有 7–365 天）'
            : '赎回费（持有 > 365 天）'
      items.push({ key: 'redemption', label, amount: roundMoney(base * rate) })
    }
  } else {
    const rate = Number(rules.commissionRate) || 0
    const floor = Number(rules.commissionMin) || 0
    const commission = rate > 0 ? roundMoney(Math.max(base * rate, floor)) : 0
    items.push(
      rules.commissionMin > 0
        ? { key: 'commission', label: `佣金（${rules.currency === 'CNY' ? '最低 ' + floor : '最低 ' + floor}）`, amount: commission }
        : { key: 'commission', label: '佣金', amount: commission },
    )
    const stampSides = rules.stampDutySides || []
    if (stampSides.indexOf(side) >= 0 && rules.stampDutyRate) {
      items.push({ key: 'stampDuty', label: '印花税', amount: roundMoney(base * rules.stampDutyRate) })
    }
    if (rules.transferFeeRate) {
      items.push({ key: 'transfer', label: '过户费', amount: roundMoney(base * rules.transferFeeRate) })
    }
    if (rules.platformFee) {
      items.push({ key: 'platform', label: '平台费', amount: roundMoney(rules.platformFee) })
    }
    if (rules.exchangeFeePerLot) {
      items.push({
        key: 'exchange',
        label: '交易所费',
        amount: roundMoney(rules.exchangeFeePerLot * (Number(ctx.lots) || 0)),
      })
    }
  }

  const total = computeFee(market, side, notional, ctx)
  const sum = items.reduce((a, b) => roundMoney(a + b.amount), 0)
  const drift = roundMoney(total - sum)
  if (drift !== 0 && items.length) {
    const commission = items.find((i) => i.key === 'commission' || i.key === 'subscribe' || i.key === 'redemption')
    if (commission) commission.amount = roundMoney(commission.amount + drift)
  }

  // Stage 0 兼容字段：A 股调用方读 commission / stampDuty / transferFee / total
  const pick = (k) => {
    const hit = items.find((i) => i.key === k)
    return hit ? hit.amount : 0
  }

  return {
    items,
    commission: pick('commission'),
    stampDuty: pick('stampDuty'),
    transferFee: pick('transfer'),
    total,
  }
}
