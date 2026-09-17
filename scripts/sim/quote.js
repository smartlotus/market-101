/**
 * 行情引擎 —— 纯算术模块（PRD §3.2 / §2.4，GDD News/Event System A 股列）。
 *
 * 每只标的当日：
 *   eventMove = drift + sentiment × magnitude × scale
 *   close     = close_prev × (1 + eventMove + noise)
 *   open      = close_prev × (1 + 0.5 × eventMove)
 *   wiggle    = 0.5 × |eventMove| + baseWiggle
 *   high      = max(open, close) × (1 + wiggle)
 *   low       = min(open, close) × (1 − wiggle)
 *
 * A 股参数：drift = +0.0003、scale = ±0.08、noise ∈ [−0.003, +0.003]、baseWiggle = 0.005。
 * 所有 OHLC 四舍五入到 ¥0.01。noise 是**可见杂波**（复盘会展示），只进 close，不进 eventMove。
 */

import { roundMoney } from './fees.js'
import { eventTargetsInstrument } from './eventDeck.js'

export const SENTIMENT_SIGN = { GOOD: 1, BAD: -1, NEUTRAL: 0 }

export const QUOTE_PARAMS = {
  A_SHARE: {
    drift: 0.0003,
    scale: 0.08,
    noiseRange: 0.003,
    baseWiggle: 0.005,
    slippagePct: 0.001, // 市价单滑点 0.1%
  },
}

function randomNoise(range) {
  return (Math.random() * 2 - 1) * range
}

/** 涨跌停价：基准价为上一交易日收盘价，四舍五入到 ¥0.01。 */
export function limitPrices(prevClose, limitPct) {
  const base = Number(prevClose) || 0
  const pct = Number(limitPct) || 0
  return {
    limitUp: roundMoney(base * (1 + pct)),
    limitDown: roundMoney(base * (1 - pct)),
  }
}

export class QuoteEngine {
  constructor(instruments = [], params = QUOTE_PARAMS.A_SHARE, { historyBars = 30 } = {}) {
    this.instruments = instruments
    this.params = params
    this.historyBars = historyBars
    this._states = new Map()
  }

  reset() {
    this.seedHistory()
    return this
  }

  /**
   * 预生成「上市以来」的 N 根历史日 K（PRD §2.4）。
   * 历史线用实盘同一套公式但只含 drift + 可见杂波（无事件），且**倒推**生成，
   * 保证最后一根历史收盘价 == 该标的起始价 —— 第 1 个交易日的 close_prev 就是它，图表连续无跳空。
   * 历史仅用于图表展示，不参与任何结算。
   */
  seedHistory() {
    this._states.clear()
    for (const inst of this.instruments) {
      const klines = this._buildHistory(Number(inst.startPrice) || 0)
      const last = klines[klines.length - 1] || null
      this._states.set(inst.id, {
        id: inst.id,
        prevClose: last ? last.close : roundMoney(inst.startPrice),
        lastPrice: last ? last.close : roundMoney(inst.startPrice),
        open: last ? last.open : roundMoney(inst.startPrice),
        high: last ? last.high : roundMoney(inst.startPrice),
        low: last ? last.low : roundMoney(inst.startPrice),
        close: last ? last.close : roundMoney(inst.startPrice),
        klines,
      })
    }
    return this
  }

  _buildHistory(endPrice) {
    const { drift, noiseRange, baseWiggle } = this.params
    const n = Math.max(0, this.historyBars)
    const closes = new Array(n)
    const noises = new Array(n)
    let carry = endPrice
    for (let i = n - 1; i >= 0; i--) {
      closes[i] = roundMoney(carry)
      noises[i] = randomNoise(noiseRange)
      carry = carry / (1 + drift + noises[i])
    }
    const bars = []
    for (let i = 0; i < n; i++) {
      const prevClose = i === 0 ? closes[0] : closes[i - 1]
      bars.push(this._makeBar({ prevClose, close: closes[i], eventMove: drift, noise: noises[i] }))
    }
    return bars
  }

  _makeBar({ prevClose, close, eventMove, noise }) {
    const open = roundMoney(prevClose * (1 + 0.5 * eventMove))
    const wiggle = 0.5 * Math.abs(eventMove) + this.params.baseWiggle
    const high = roundMoney(Math.max(open, close) * (1 + wiggle))
    const low = roundMoney(Math.min(open, close) * (1 - wiggle))
    // 四舍五入后仍保证 OHLC 自洽（影线不得插进实体里）
    return {
      prevClose: roundMoney(prevClose),
      open,
      high: Math.max(high, open, close),
      low: Math.min(low, open, close),
      close: roundMoney(close),
      eventMove,
      noise,
    }
  }

  /** 推进一日行情。休市日直接跳过（close 不变、不生成新 K 根）。 */
  advanceDay(event, isOpen = true) {
    if (!isOpen) return false
    for (const inst of this.instruments) {
      const st = this._states.get(inst.id)
      if (!st) continue
      const prevClose = st.close
      const affected = eventTargetsInstrument(event, inst.id)
      const sign = affected ? SENTIMENT_SIGN[event.sentiment] ?? 0 : 0
      const magnitude = affected ? Number(event.magnitude) || 0 : 0
      const eventMove = this.params.drift + sign * magnitude * this.params.scale
      const noise = randomNoise(this.params.noiseRange)
      const bar = this._makeBar({
        prevClose,
        close: prevClose * (1 + eventMove + noise),
        eventMove,
        noise,
      })
      st.klines.push(bar)
      st.prevClose = prevClose
      st.lastPrice = bar.close
      st.open = bar.open
      st.high = bar.high
      st.low = bar.low
      st.close = bar.close
    }
    return true
  }

  stateOf(instrumentId) {
    return this._states.get(instrumentId) || null
  }

  klinesFor(instrumentId) {
    const st = this._states.get(instrumentId)
    return st ? st.klines : []
  }

  /** 某标的当前的涨跌停价（基准价 = 上一交易日收盘价）。 */
  limitsFor(instrument) {
    const st = this._states.get(instrument.id)
    const prevClose = st ? st.prevClose : Number(instrument.startPrice) || 0
    return limitPrices(prevClose, instrument.limitPct)
  }

  /** Runtime 契约里的 `quotes` 映射。 */
  snapshot() {
    const out = {}
    for (const inst of this.instruments) {
      const st = this._states.get(inst.id)
      if (!st) continue
      const { limitUp, limitDown } = this.limitsFor(inst)
      const changeAbs = roundMoney(st.close - st.prevClose)
      const changePct = st.prevClose ? Math.round(((st.close - st.prevClose) / st.prevClose) * 1e6) / 1e6 : 0
      out[inst.id] = {
        lastPrice: roundMoney(st.lastPrice),
        prevClose: roundMoney(st.prevClose),
        open: roundMoney(st.open),
        high: roundMoney(st.high),
        low: roundMoney(st.low),
        close: roundMoney(st.close),
        changeAbs,
        changePct,
        limitUp,
        limitDown,
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
      this._states.set(inst.id, {
        id: inst.id,
        prevClose: roundMoney(st.prevClose),
        lastPrice: roundMoney(st.lastPrice),
        open: roundMoney(st.open),
        high: roundMoney(st.high),
        low: roundMoney(st.low),
        close: roundMoney(st.close),
        klines: Array.isArray(st.klines) ? st.klines.map((b) => ({ ...b })) : [],
      })
    }
    return this
  }
}
