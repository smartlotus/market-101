/**
 * 行情引擎 —— 纯算术模块（PRD §3.2 / §2.4，GDD `### News / Event System` 七类市场列）。
 *
 * 每只标的当日：
 *   eventMove = drift + sentiment × magnitude × scale
 *   close     = close_prev × (1 + eventMove + noise)
 *   open      = close_prev × (1 + 0.5 × eventMove)
 *   wiggle    = 0.5 × |eventMove| + baseWiggle
 *   high      = max(open, close) × (1 + wiggle)
 *   low       = min(open, close) × (1 − wiggle)
 *
 * 参数按市场不同（GDD 表）：
 *   A股/ETF   drift +0.0003 / scale ±0.08 / noise ±0.003 / wiggle 0.005
 *   港股      drift +0.0002 / scale ±0.12 / noise ±0.004 / wiggle 0.008
 *   美股      drift +0.0003 / scale ±0.10 / noise ±0.003 / wiggle 0.006
 *   公募基金  drift +0.0003（随跟踪标的） / scale ±0.06 / noise ±0.001 / wiggle 0.003
 *   加密货币  drift 0        / scale ±0.25 / noise ±0.015 / wiggle 0.020
 *
 * 场外基金不按 OHLC 波动，而是按**净值**走：
 *   NAV_t = NAV_{t-1} × (1 + 跟踪标的当日 eventMove + 跟踪误差噪声)
 *   跟踪误差 ∈ [−0.001, +0.001]；无跟踪标的的基金用自身的 `navVolatility`。
 *
 * 所有价格四舍五入到该市场的**最小变动价位**（A股/港股/美股 0.01，加密/基金 0.0001）。
 * `noise` 是**可见杂波**（复盘会展示），只进 `close`，不进 `eventMove`。
 */

import { roundMoney, roundToTick, tickOf } from './fees.js'
import { eventTargetsInstrument } from './eventDeck.js'

export const SENTIMENT_SIGN = { GOOD: 1, BAD: -1, NEUTRAL: 0 }

export const QUOTE_PARAMS = {
  A_SHARE: { drift: 0.0003, scale: 0.08, noiseRange: 0.003, baseWiggle: 0.005, slippagePct: 0.001 },
  ETF: { drift: 0.0003, scale: 0.08, noiseRange: 0.003, baseWiggle: 0.005, slippagePct: 0.001 },
  HK: { drift: 0.0002, scale: 0.12, noiseRange: 0.004, baseWiggle: 0.008, slippagePct: 0.001 },
  US: { drift: 0.0003, scale: 0.1, noiseRange: 0.003, baseWiggle: 0.006, slippagePct: 0.001 },
  CRYPTO: { drift: 0, scale: 0.25, noiseRange: 0.015, baseWiggle: 0.02, slippagePct: 0.001 },
  FUND: { drift: 0.0003, scale: 0.06, noiseRange: 0.001, baseWiggle: 0.003, slippagePct: 0 },
  OPTION: { drift: 0.0003, scale: 0.08, noiseRange: 0.003, baseWiggle: 0.005, slippagePct: 0.001 },
}

/** 场外基金的跟踪误差带宽（GDD：`fundNoise = 均匀随机 ∈ [−0.001, +0.001]`）。 */
export const FUND_TRACK_NOISE = 0.001

function randomNoise(range) {
  return (Math.random() * 2 - 1) * range
}

function paramsFor(market) {
  return QUOTE_PARAMS[market] || QUOTE_PARAMS.A_SHARE
}

/** 涨跌停价：基准价为上一交易日收盘价，四舍五入到该市场最小变动价位。 */
export function limitPrices(prevClose, limitPct, market = 'A_SHARE') {
  const base = Number(prevClose) || 0
  const pct = Number(limitPct) || 0
  return {
    limitUp: roundToTick(base * (1 + pct), market),
    limitDown: roundToTick(base * (1 - pct), market),
  }
}

export class QuoteEngine {
  constructor(instruments = [], params = null, { historyBars = 30 } = {}) {
    this.instruments = instruments
    this.params = params || QUOTE_PARAMS.A_SHARE
    this.historyBars = historyBars
    this._states = new Map()
  }

  reset() {
    this.seedHistory()
    return this
  }

  instrumentationOf() {
    return null
  }

  instrumentOf(instrumentId) {
    return this.instruments.find((i) => i.id === instrumentId) || null
  }

  marketOf(instrumentId) {
    const inst = this.instrumentOf(instrumentId)
    return inst ? inst.market || 'A_SHARE' : 'A_SHARE'
  }

  /** 预生成「上市以来」的 N 根历史日 K（PRD §2.4），倒推生成，末根收盘 = 起始价。 */
  seedHistory() {
    this._states.clear()
    for (const inst of this.instruments) {
      const market = inst.market || 'A_SHARE'
      const klines = this._buildHistory(Number(inst.startPrice) || 0, market)
      const last = klines[klines.length - 1] || null
      const start = roundToTick(inst.startPrice, market)
      this._states.set(inst.id, {
        id: inst.id,
        market,
        prevClose: last ? last.close : start,
        lastPrice: last ? last.close : start,
        open: last ? last.open : start,
        high: last ? last.high : start,
        low: last ? last.low : start,
        close: last ? last.close : start,
        klines,
      })
    }
    return this
  }

  _buildHistory(endPrice, market) {
    const p = paramsFor(market)
    const n = Math.max(0, this.historyBars)
    const closes = new Array(n)
    const noises = new Array(n)
    let carry = endPrice
    for (let i = n - 1; i >= 0; i -= 1) {
      closes[i] = roundToTick(carry, market)
      noises[i] = randomNoise(p.noiseRange)
      carry = carry / (1 + p.drift + noises[i])
    }
    const bars = []
    for (let i = 0; i < n; i += 1) {
      const prevClose = i === 0 ? closes[0] : closes[i - 1]
      bars.push(this._makeBar({ prevClose, close: closes[i], eventMove: p.drift, noise: noises[i], market }))
    }
    return bars
  }

  _makeBar({ prevClose, close, eventMove, noise, market }) {
    const p = paramsFor(market)
    const round = (v) => roundToTick(v, market)
    const open = round(prevClose * (1 + 0.5 * eventMove))
    const wiggle = 0.5 * Math.abs(eventMove) + p.baseWiggle
    const high = round(Math.max(open, close) * (1 + wiggle))
    const low = round(Math.min(open, close) * (1 - wiggle))
    const c = round(close)
    // 四舍五入后仍保证 OHLC 自洽（影线不得插进实体里）
    return {
      prevClose: round(prevClose),
      open,
      high: Math.max(high, open, c),
      low: Math.min(low, open, c),
      close: c,
      eventMove,
      noise,
    }
  }

  /**
   * 推进一日行情。
   * @param {object|null} event   当日事件
   * @param {boolean|function} isOpen 全体开市布尔，或 `(market) => boolean` 按市场判断
   */
  advanceDay(event, isOpen = true) {
    const openFor = typeof isOpen === 'function' ? isOpen : () => Boolean(isOpen)
    const moved = {}

    // 先算所有非基金标的的当日净驱动，供场外基金「跟踪」使用
    const eventMoveByInstrument = {}
    for (const inst of this.instruments) {
      const market = inst.market || 'A_SHARE'
      if (!this._states.has(inst.id)) continue
      const p = paramsFor(market)
      const affected = eventTargetsInstrument(event, inst.id)
      const sign = affected ? SENTIMENT_SIGN[event.sentiment] ?? 0 : 0
      const magnitude = affected ? Number(event.magnitude) || 0 : 0
      eventMoveByInstrument[inst.id] = p.drift + sign * magnitude * p.scale
    }

    for (const inst of this.instruments) {
      const market = inst.market || 'A_SHARE'
      if (!openFor(market)) continue
      const st = this._states.get(inst.id)
      if (!st) continue

      if (market === 'FUND') {
        // 场外基金：按净值走（未知价交易的定价基础）
        const trackedId = inst.trackedInstrumentId
        const tracked = trackedId ? eventMoveByInstrument[trackedId] : null
        const base = tracked !== null && tracked !== undefined
          ? tracked
          : (Number(inst.navVolatility) || 0)
        const fundNoise = randomNoise(FUND_TRACK_NOISE)
        const prev = st.close
        const next = roundToTick(prev * (1 + base + fundNoise), market)
        st.klines.push({
          prevClose: roundToTick(prev, market),
          open: roundToTick(prev, market),
          high: Math.max(prev, next),
          low: Math.min(prev, next),
          close: next,
          eventMove: base,
          noise: fundNoise,
        })
        st.prevClose = roundToTick(prev, market)
        st.lastPrice = next
        st.open = roundToTick(prev, market)
        st.high = Math.max(prev, next)
        st.low = Math.min(prev, next)
        st.close = next
        moved[inst.id] = true
        continue
      }

      const p = paramsFor(market)
      const prevClose = st.close
      const eventMove = eventMoveByInstrument[inst.id] ?? p.drift
      const noise = randomNoise(p.noiseRange)
      const bar = this._makeBar({
        prevClose,
        close: prevClose * (1 + eventMove + noise),
        eventMove,
        noise,
        market,
      })
      st.klines.push(bar)
      st.prevClose = prevClose
      st.lastPrice = bar.close
      st.open = bar.open
      st.high = bar.high
      st.low = bar.low
      st.close = bar.close
      moved[inst.id] = true
    }
    return moved
  }

  stateOf(instrumentId) {
    return this._states.get(instrumentId) || null
  }

  klinesFor(instrumentId) {
    const st = this._states.get(instrumentId)
    return st ? st.klines : []
  }

  /** 某标的当前的涨跌停价（基准价 = 上一交易日收盘价）。无涨跌停的市场返回 null。 */
  limitsFor(instrument) {
    if (!instrument) return { limitUp: null, limitDown: null }
    const market = instrument.market || 'A_SHARE'
    const pct = instrument.limitPct
    if (pct === null || pct === undefined) return { limitUp: null, limitDown: null }
    const st = this._states.get(instrument.id)
    const prevClose = st ? st.prevClose : Number(instrument.startPrice) || 0
    return limitPrices(prevClose, pct, market)
  }

  /** Runtime 契约里的 `quotes` 映射。 */
  snapshot() {
    const out = {}
    for (const inst of this.instruments) {
      const st = this._states.get(inst.id)
      if (!st) continue
      const market = inst.market || 'A_SHARE'
      const { limitUp, limitDown } = this.limitsFor(inst)
      const changeAbs = roundToTick(st.close - st.prevClose, market)
      const changePct = st.prevClose
        ? Math.round(((st.close - st.prevClose) / st.prevClose) * 1e6) / 1e6
        : 0
      out[inst.id] = {
        market,
        currency: inst.currency || 'CNY',
        lastPrice: roundToTick(st.lastPrice, market),
        prevClose: roundToTick(st.prevClose, market),
        open: roundToTick(st.open, market),
        high: roundToTick(st.high, market),
        low: roundToTick(st.low, market),
        close: roundToTick(st.close, market),
        changeAbs,
        changePct,
        limitUp,
        limitDown,
        tick: tickOf(market),
        klinesCount: st.klines.length,
      }
    }
    return out
  }

  // === 存档（含 K 线，量级很小；plan 决策 6）===

  toJSON() {
    const states = {}
    for (const [id, st] of this._states) {
      states[id] = {
        id: st.id,
        market: st.market,
        prevClose: st.prevClose,
        lastPrice: st.lastPrice,
        open: st.open,
        high: st.high,
        low: st.low,
        close: st.close,
        klines: st.klines.map((b) => ({ ...b })),
      }
    }
    return { states }
  }

  loadFrom(data) {
    if (!data || !data.states) return this
    this._states = new Map()
    for (const inst of this.instruments) {
      const st = data.states[inst.id]
      if (!st) continue
      const market = inst.market || 'A_SHARE'
      this._states.set(inst.id, {
        id: inst.id,
        market,
        prevClose: roundToTick(st.prevClose, market),
        lastPrice: roundToTick(st.lastPrice, market),
        open: roundToTick(st.open, market),
        high: roundToTick(st.high, market),
        low: roundToTick(st.low, market),
        close: roundToTick(st.close, market),
        klines: Array.isArray(st.klines) ? st.klines.map((b) => ({ ...b })) : [],
      })
    }
    return this
  }
}

export { roundMoney }
