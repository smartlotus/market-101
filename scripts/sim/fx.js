/**
 * 汇率系统 —— 纯算术模块（GDD `### 汇率系统 (FX)`）。
 *
 * 所有非 CNY 持仓经 `toCNY(amount, currency)` 折算入 NAV。汇率是**可见、可解释**的参数：
 * 只由带 `fxTarget` 的 MACRO / POLICY 事件驱动，外加极小且可见的杂波，**没有隐藏漂移**。
 *
 * 初始值（固定教学值）：HKD→CNY 0.9200 / USD→CNY 7.2000 / USDT→CNY 7.2000。
 * 日变动：rate = rate_prev × (1 + sentiment × magnitude × FX_SCALE + fxNoise)
 *   FX_SCALE = 0.03（单事件最大 ±3%）；fxNoise ∈ [−0.002, +0.002]（复盘展示为「汇率杂波」）。
 * 精度：存储与展示保留 4 位小数。
 *
 * 无 DOM、无 Phaser、不继承 Node：可被 `vibegame play eval` 直接 import 并断言。
 */

export const FX_SCALE = 0.03
export const FX_NOISE = 0.002
export const FX_DECIMALS = 4

/** 只跟踪这三种外币；CNY 恒为 1。 */
export const FX_INITIAL = { HKD: 0.92, USD: 7.2, USDT: 7.2 }

/** 会被汇率事件影响的事件类型（GDD：纯 COMPANY / INDUSTRY / BLACK_SWAN 不动汇率）。 */
const FX_EVENT_TYPES = ['MACRO', 'POLICY']

function round4(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const f = Math.pow(10, FX_DECIMALS)
  const r = Math.round(n * f + (n >= 0 ? 1e-9 : -1e-9)) / f
  return r === 0 ? 0 : r
}

function randomNoise() {
  return (Math.random() * 2 - 1) * FX_NOISE
}

export class FxBook {
  constructor({ initial = FX_INITIAL } = {}) {
    this.initialRates = { ...FX_INITIAL, ...initial }
    this.reset()
  }

  reset() {
    this.rates = { CNY: 1, ...this.initialRates }
    /** 上一交易日的汇率，供「今日变动」展示与复盘使用。 */
    this.prevRates = { ...this.rates }
    /** 最近一次汇率变动的解释（事件驱动才有值），复盘与新闻卡要显示它。 */
    this.lastMove = null
    return this
  }

  /** 1 单位 `currency` = 多少 CNY。 */
  rateOf(currency) {
    if (!currency || currency === 'CNY') return 1
    const r = this.rates[currency]
    return Number.isFinite(r) ? r : 1
  }

  /** 把该市场货币的金额折算成 CNY。 */
  toCNY(amount, currency) {
    const n = Number(amount) || 0
    return round4(n * this.rateOf(currency))
  }

  /** 今日相对上一日的变动比例（复盘展示「汇率杂波 ±X%」）。 */
  moveOf(currency) {
    if (!currency || currency === 'CNY') return 0
    const prev = Number(this.prevRates[currency])
    const now = Number(this.rates[currency])
    if (!Number.isFinite(prev) || !prev) return 0
    return Math.round(((now - prev) / prev) * 1e6) / 1e6
  }

  /**
   * 是否为「会移动汇率」的事件。
   * GDD：仅 `type ∈ {MACRO, POLICY}` **且**带 `fxTarget` 的事件。
   */
  static affects(event) {
    if (!event) return false
    if (FX_EVENT_TYPES.indexOf(event.type) < 0) return false
    return Boolean(event.fxTarget)
  }

  /**
   * 按当日事件更新汇率（GDD 公式）。无事件时汇率不变 —— 不引入任何隐藏漂移。
   * 返回本次变动记录（供事件卡显示「受影响的汇率：USD→CNY 7.2000 → 7.4160（事件驱动 +3.0%）」）。
   */
  applyEvent(event) {
    this.prevRates = { ...this.rates }
    if (!FxBook.affects(event)) {
      this.lastMove = null
      return null
    }
    const currency = String(event.fxTarget)
    if (!Object.prototype.hasOwnProperty.call(this.initialRates, currency)) {
      this.lastMove = null
      return null
    }
    const sign = event.sentiment === 'GOOD' ? 1 : event.sentiment === 'BAD' ? -1 : 0
    const magnitude = Number(event.magnitude) || 0
    const impact = sign * magnitude * FX_SCALE
    const noise = randomNoise()
    const before = this.rateOf(currency)
    const after = round4(before * (1 + impact + noise))
    this.rates[currency] = after
    this.lastMove = {
      currency,
      before,
      after,
      eventImpact: Math.round(impact * 1e6) / 1e6,
      noise: Math.round(noise * 1e6) / 1e6,
      eventId: event.id || null,
      headline: event.headline || null,
    }
    return this.lastMove
  }

  /**
   * 应用「汇率杂波」：无事件的日子汇率也不动（GDD 明确只有事件驱动），
   * 因此本方法仅在需要显式模拟杂波时使用（测试注入）。
   */
  applyNoiseOnly() {
    this.prevRates = { ...this.rates }
    const out = {}
    for (const currency of Object.keys(this.initialRates)) {
      const before = this.rateOf(currency)
      const after = round4(before * (1 + randomNoise()))
      this.rates[currency] = after
      out[currency] = { before, after }
    }
    this.lastMove = null
    return out
  }

  /** Runtime 契约里的 `fx` 映射。 */
  snapshot() {
    const out = { base: 'CNY', decimals: FX_DECIMALS, rates: {}, movePct: {} }
    out.rates.CNY = 1
    for (const currency of Object.keys(this.initialRates)) {
      out.rates[currency] = this.rateOf(currency)
      out.movePct[currency] = this.moveOf(currency)
    }
    out.lastMove = this.lastMove
    return out
  }

  toJSON() {
    return { rates: { ...this.rates }, prevRates: { ...this.prevRates }, lastMove: this.lastMove }
  }

  loadFrom(data) {
    if (!data) return this
    const rates = (data && data.rates) || null
    if (rates) {
      this.rates = { CNY: 1, ...this.initialRates }
      for (const currency of Object.keys(this.initialRates)) {
        const v = Number(rates[currency])
        if (Number.isFinite(v) && v > 0) this.rates[currency] = round4(v)
      }
    }
    const prev = (data && data.prevRates) || null
    if (prev) {
      this.prevRates = { ...this.rates }
      for (const currency of Object.keys(this.initialRates)) {
        const v = Number(prev[currency])
        if (Number.isFinite(v) && v > 0) this.prevRates[currency] = round4(v)
      }
    }
    this.lastMove = (data && data.lastMove) || null
    return this
  }
}

export default FxBook
