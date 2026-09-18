/**
 * 期权子系统 —— 纯算术模块（GDD `### Options Subsystem`）。
 *
 * 设计原则：**透明可手算**，玩家必须能看见「价格为什么动」。因此刻意放弃
 * Black-Scholes / 波动率曲面 / 美式提前行权 / 实物交割，改用：
 *   欧式现金交割 + 线性时间衰减 + 平值因子
 *
 * 定价（对每个合约，给定标的价 S、行权价 K、剩余天数 D、生命周期 D0、波动情景因子 volFactor）：
 *   moneyness = |S − K| / K
 *   atmFactor = clamp(1 − moneyness / 0.2, 0, 1)        // 平值最高，偏离 20% 外归零
 *   timeValue = K × 0.02 × (D / D0) × atmFactor × volFactor
 *   intrinsic = call ? max(0, S − K) : max(0, K − S)
 *   premiumPerShare = intrinsic + timeValue
 *   premiumTotal    = premiumPerShare × MULTIPLIER       // 1 张 = 10000 份标的
 *
 * 期权链：唯一标的 50ETF（510050）。恒有 3 个未到期序列（近月/次月/季月，D0 ∈ {30,60,90}），
 * 每序列 5 档行权价 × CALL/PUT = 10 张合约，共 30 张。序列走到 D=0 结算后立即以当前标的价
 * 重新取档、D0 重置，保证场上始终 3 个序列。
 *
 * 到期：实值 → 自动现金行权（买方收 intrinsic × MULTIPLIER）；虚值/平值 → 作废，
 * 买方损失全部权利金。**买方最大亏损 = 权利金**；卖方本作不开放。
 *
 * 无 DOM、无 Phaser、不继承 Node：可被 `vibegame play eval` 直接 import 并断言。
 */

import { roundMoney, roundTo } from './fees.js'

/** 1 张 = 10000 份标的（GDD 合约规格）。 */
export const OPTION_MULTIPLIER = 10000
/** 时间价值的年化系数（GDD 公式里的 0.02）。 */
export const TIME_VALUE_RATE = 0.02
/** 平值因子的归零距离：偏离行权价 20% 以外时间价值归零。 */
export const ATM_SPAN = 0.2
/** 三个到期序列的生命周期（交易日）。 */
export const SERIES_D0 = [30, 60, 90]
export const SERIES_NAMES = ['近月', '次月', '季月']
/** 行权价档位（相对合约上市时标的价 S0 的倍数）。 */
export const STRIKE_STEPS = [0.8, 0.9, 1.0, 1.1, 1.2]

/** 按价位取整：<¥3 取 0.05、¥3–10 取 0.1、>¥10 取 0.5（GDD 原文）。 */
export function roundStrike(k) {
  const n = Number(k) || 0
  if (n < 3) return roundTo(Math.round(n / 0.05) * 0.05, 2)
  if (n <= 10) return roundTo(Math.round(n / 0.1) * 0.1, 2)
  return roundTo(Math.round(n / 0.5) * 0.5, 2)
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

/**
 * 单张合约的定价（GDD 公式，逐字实现）。
 * @returns { intrinsize, timeValue, premiumPerShare, premiumTotal, moneyness, atmFactor, leverage, notional }
 */
export function priceOption({ spot, strike, daysLeft, d0, volFactor = 1, type = 'CALL' }) {
  const S = Number(spot) || 0
  const K = Number(strike) || 0
  const D = Math.max(0, Number(daysLeft) || 0)
  const D0 = Math.max(1, Number(d0) || 1)
  const vf = Number.isFinite(Number(volFactor)) && Number(volFactor) > 0 ? Number(volFactor) : 1
  const call = type !== 'PUT'

  const moneyness = K > 0 ? Math.abs(S - K) / K : 0
  const atmFactor = clamp(1 - moneyness / ATM_SPAN, 0, 1)
  const timeValue = roundTo(K * TIME_VALUE_RATE * (D / D0) * atmFactor * vf, 4)
  const intrinsic = call ? Math.max(0, S - K) : Math.max(0, K - S)
  const premiumPerShare = roundTo(intrinsic + timeValue, 4)
  const premiumTotal = roundMoney(premiumPerShare * OPTION_MULTIPLIER)
  const notional = roundMoney(S * OPTION_MULTIPLIER)
  const leverage = premiumTotal > 0 ? Math.round((notional / premiumTotal) * 100) / 100 : 0
  return {
    intrinsic: roundTo(intrinsic, 4),
    timeValue,
    premiumPerShare,
    premiumTotal,
    moneyness: Math.round(moneyness * 1e6) / 1e6,
    atmFactor: Math.round(atmFactor * 1e6) / 1e6,
    notional,
    leverage,
    // 价内/价外/平值：相对距离小于 0.5% 视为平值
    moneyStatus: intrinsic > 0 ? '实值' : (moneyness <= 0.005 ? '平值' : '虚值'),
  }
}

export class OptionChain {
  /**
   * @param {object} cfg `{ underlyingId, spotOf: () => number, events }`
   *        `spotOf()` 返回当前标的价（由宿主提供，保证与行情引擎同源）。
   */
  constructor({ underlyingId = '510050', spotOf = () => 0 } = {}) {
    this.underlyingId = underlyingId
    this.spotOf = typeof spotOf === 'function' ? spotOf : () => Number(spotOf) || 0
    this.reset()
  }

  reset() {
    this.series = []
    this.positions = []
    this._seq = 0
    const s0 = this.spotOf()
    for (let i = 0; i < SERIES_D0.length; i += 1) {
      this.series.push(this._makeSeries(i, SERIES_D0[i], s0))
    }
    return this
  }

  _makeSeries(index, d0, spot) {
    const strikes = STRIKE_STEPS.map((m) => roundStrike(spot * m))
    const uniq = [...new Set(strikes)].sort((a, b) => a - b)
    const contracts = []
    for (const K of uniq) {
      for (const type of ['CALL', 'PUT']) {
        this._seq += 1
        contracts.push({
          id: `OPT${String(this._seq).padStart(4, '0')}`,
          seriesIndex: index,
          seriesName: SERIES_NAMES[index],
          type,
          strike: K,
          d0,
          daysLeft: d0,
        })
      }
    }
    return { id: `S${index + 1}-${this._seq}`, index, name: SERIES_NAMES[index], d0, daysLeft: d0, contracts }
  }

  /** 当前标的价。 */
  get spot() {
    return roundTo(this.spotOf(), 4)
  }

  /** 波动情景因子：由当日事件给的强度决定（0.5–2.0），默认 1。 */
  volFactorOf(event) {
    if (!event) return 1
    const mag = Number(event.magnitude) || 0
    const sentiment = event.sentiment === 'NEUTRAL' ? 0 : 1
    const raw = 0.5 + mag * 2.5 * (sentiment ? 1 : 0)
    return Math.round(clamp(raw, 0.5, 2) * 100) / 100
  }

  /** 全部合约（含实时定价）。 */
  contractList(event = null) {
    const S = this.spot
    const vf = this.volFactorOf(event)
    const out = []
    for (const s of this.series) {
      for (const c of s.contracts) {
        const p = priceOption({ spot: S, strike: c.strike, daysLeft: c.daysLeft, d0: c.d0, volFactor: vf, type: c.type })
        out.push({ ...c, ...p, underlyingId: this.underlyingId, spot: S, volFactor: vf })
      }
    }
    return out
  }

  contractById(id) {
    for (const s of this.series) {
      const c = s.contracts.find((x) => x.id === id)
      if (c) return c
    }
    return null
  }

  /** 平值那一档（教学中「找出平值」用）：与现价最接近的行权价，CALL/PUT 各一张。 */
  atmContracts(event = null) {
    const list = this.contractList(event)
    if (!list.length) return []
    const S = this.spot
    let best = Infinity
    for (const c of list) best = Math.min(best, Math.abs(c.strike - S))
    return list.filter((c) => Math.abs(c.strike - S) === best)
  }

  /** 买入开仓（仅买方）。返回成交明细或失败原因。 */
  buy({ contractId, lots = 1, cash = 0, dayIndex = 1, event = null }) {
    const c = this.contractById(contractId)
    if (!c) return { ok: false, reason: 'unknown_contract' }
    if (c.daysLeft <= 0) return { ok: false, reason: 'expired' }
    const n = Math.floor(Number(lots) || 0)
    if (n <= 0) return { ok: false, reason: 'lots' }
    const p = priceOption({
      spot: this.spot, strike: c.strike, daysLeft: c.daysLeft, d0: c.d0,
      volFactor: this.volFactorOf(event), type: c.type,
    })
    const premiumPaid = roundMoney(p.premiumTotal * n)
    if (premiumPaid > cash) return { ok: false, reason: 'funds', need: premiumPaid, have: roundMoney(cash) }
    if (premiumPaid <= 0) return { ok: false, reason: 'worthless' }
    const lot = {
      contractId,
      underlyingId: this.underlyingId,
      type: c.type,
      strike: c.strike,
      seriesName: c.seriesName,
      d0: c.d0,
      lots: n,
      premiumPaid,
      premiumPerShare: p.premiumPerShare,
      openedDay: dayIndex,
      status: 'open',
    }
    this.positions.push(lot)
    return {
      ok: true, lot, premiumPaid, contract: c, premiumPerShare: p.premiumPerShare,
      leverage: p.leverage, notional: p.notional, moneyStatus: p.moneyStatus,
    }
  }

  /** 持仓（含实时浮盈浮亏与当前定价）。 */
  openPositions(event = null) {
    const S = this.spot
    const vf = this.volFactorOf(event)
    return this.positions
      .filter((p) => p.status === 'open')
      .map((p) => {
        const c = this.contractById(p.contractId)
        const daysLeft = c ? c.daysLeft : 0
        const cur = priceOption({ spot: S, strike: p.strike, daysLeft, d0: p.d0, volFactor: vf, type: p.type })
        const valueNow = roundMoney(cur.premiumTotal * p.lots)
        return {
          ...p,
          daysLeft,
          currentPremiumPerShare: cur.premiumPerShare,
          intrinsic: cur.intrinsic,
          timeValue: cur.timeValue,
          valueNow,
          unrealizedPnL: roundMoney(valueNow - p.premiumPaid),
          moneyStatus: cur.moneyStatus,
          leverage: cur.leverage,
        }
      })
  }

  /**
   * 推进一个交易日：所有未到期合约 D−=1；走完 D=0 的序列立即结算并按当前价补新序列。
   * @returns 本日结算结果列表
   */
  advanceDay({ event = null, dayIndex = 1 } = {}) {
    const S = this.spot
    for (const s of this.series) {
      s.daysLeft -= 1
      for (const c of s.contracts) c.daysLeft -= 1
    }
    const settled = []
    const expired = this.series.filter((s) => s.daysLeft <= 0)
    for (const s of expired) {
      const expiredIds = s.contracts.map((c) => c.id)
      // 结算：逐持仓按到期日内在价值现金交割
      for (const p of this.positions) {
        if (p.status !== 'open' || expiredIds.indexOf(p.contractId) < 0) continue
        const intrinsic = p.type === 'CALL' ? Math.max(0, S - p.strike) : Math.max(0, p.strike - S)
        const proceeds = roundMoney(intrinsic * OPTION_MULTIPLIER * p.lots)
        const exercised = intrinsic > 0
        p.status = exercised ? 'exercised' : 'expired'
        p.settleDay = dayIndex
        p.settleIntrinsic = roundTo(intrinsic, 4)
        p.settleProceeds = proceeds
        p.settlePnL = roundMoney(proceeds - p.premiumPaid)
        settled.push({
          contractId: p.contractId, lots: p.lots, type: p.type, strike: p.strike,
          exercised, intrinsic: roundTo(intrinsic, 4), proceeds,
          premiumPaid: p.premiumPaid, pnl: p.settlePnL,
        })
      }
      // 序列作废 → 以**当前**标的价重建，并整体前移（近月补新、次月→近月、季月→次月）
      const idx = s.index
      this.series = this.series.filter((x) => x !== s)
      const fresh = this._makeSeries(idx, SERIES_D0[idx], S)
      this.series.push(fresh)
      this.series.sort((a, b) => a.index - b.index)
    }
    return settled
  }

  /** 已结算（到期）的历史，供复盘与教学回看。 */
  settledPositions() {
    return this.positions.filter((p) => p.status !== 'open').map((p) => ({ ...p }))
  }

  /** Runtime 契约里的 `options` 映射。 */
  snapshot(event = null) {
    const list = this.contractList(event)
    return {
      underlyingId: this.underlyingId,
      underlyingSpot: this.spot,
      multiplier: OPTION_MULTIPLIER,
      volFactor: this.volFactorOf(event),
      series: this.series.map((s) => ({
        name: s.name, d0: s.d0, daysLeft: s.daysLeft,
        contracts: list.filter((c) => c.seriesName === s.name).map((c) => ({
          id: c.id, type: c.type, strike: c.strike, daysLeft: c.daysLeft,
          intrinsic: c.intrinsic, timeValue: c.timeValue,
          premiumPerShare: c.premiumPerShare, premiumTotal: c.premiumTotal,
          moneyStatus: c.moneyStatus, leverage: c.leverage,
        })),
      })),
      positions: this.openPositions(event),
      settled: this.settledPositions(),
    }
  }

  // === 存档 ===

  toJSON() {
    return {
      series: this.series.map((s) => ({
        id: s.id, index: s.index, name: s.name, d0: s.d0, daysLeft: s.daysLeft,
        contracts: s.contracts.map((c) => ({ ...c })),
      })),
      positions: this.positions.map((p) => ({ ...p })),
      seq: this._seq,
    }
  }

  loadFrom(data) {
    if (!data || !Array.isArray(data.series) || !data.series.length) return this
    this.series = data.series.map((s) => ({
      id: s.id, index: Number(s.index) || 0, name: s.name,
      d0: Number(s.d0) || 30, daysLeft: Number(s.daysLeft) || 0,
      contracts: (s.contracts || []).map((c) => ({ ...c })),
    }))
    this.positions = Array.isArray(data.positions) ? data.positions.map((p) => ({ ...p })) : []
    this._seq = Number(data.seq) || this._seq
    return this
  }
}

export default OptionChain
