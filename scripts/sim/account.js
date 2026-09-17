/**
 * 账户与成交算术 —— 纯算术模块（PRD §2.1 / §3.4 / §3.5）。
 *
 * 买入：cash -= (fillPrice × Q + fee)
 *       newAvg = (oldQty × oldAvg + Q × fillPrice) / (oldQty + Q)   // avgCost 不含费
 * 卖出：cash += (fillPrice × Q − fee)
 *       realizedPnL += (fillPrice − avgCost) × Q − fee
 *
 * 锁仓分两笔账：
 *   t1LockedQty   当日买入、T+1 未解禁（结算第 3 步清零）
 *   orderLockedQty 限价卖挂单占用（撤单时释放）
 * 对外只暴露 `lockedQty = t1LockedQty + orderLockedQty`（Runtime 契约字段）。
 */

import { computeFee, roundMoney } from './fees.js'

export class Account {
  constructor({ initialCash = 100000, market = 'A_SHARE' } = {}) {
    this.initialCash = roundMoney(initialCash)
    this.market = market
    this.reset()
  }

  /**
   * 回到「未开户、¥0」（Stage 1 开局状态，PRD §2.1）。
   * Stage 0 的「开局即有 ¥100,000」现在由 `fund()` 显式产生（节拍 1.3「入金」）。
   */
  reset() {
    this.cash = 0
    this.frozenCash = 0
    this.realizedPnL = 0
    this.feesPaid = 0
    this.totalNotional = 0
    this.opened = false
    this.funded = false
    this._positions = new Map()
    return this
  }

  // === 开户 / 入金（Stage 1 节拍 1.2 / 1.3）===

  /** 节拍 1.2「同意并开户」：账户建立，但仍是 ¥0。 */
  open() {
    this.opened = true
    return this.opened
  }

  /**
   * 节拍 1.3「入金 ¥100,000」：初始本金入账。
   * **不是外来入金**（PRD §3.3 `I` 的口径只含「补足本金 / 重置账户」）。
   */
  fund(amount) {
    this.cash = roundMoney(amount)
    this.funded = true
    return this.cash
  }

  /** 清空持仓（「重置账户」用，PRD §3.6）；不动资金与账本。 */
  clearPositions() {
    this._positions.clear()
    return this
  }

  /** 入账现金（外来入金：补足本金 / 重置账户）。 */
  credit(amount) {
    this.cash = roundMoney(this.cash + (Number(amount) || 0))
    return this.cash
  }

  // === 持仓读取 ===

  getPosition(id) {
    return this._positions.get(id) || null
  }

  get lockedQtyTotal() {
    let sum = 0
    for (const p of this._positions.values()) sum += p.t1LockedQty + p.orderLockedQty
    return sum
  }

  /** 可卖数量 = 持仓 − 当日买入锁定 − 挂单占用。 */
  availableQty(id) {
    const p = this._positions.get(id)
    if (!p) return 0
    return p.qty - p.t1LockedQty - p.orderLockedQty
  }

  // === 资金冻结 ===

  freezeCash(amount) {
    const value = roundMoney(amount)
    this.cash = roundMoney(this.cash - value)
    this.frozenCash = roundMoney(this.frozenCash + value)
  }

  releaseCash(amount) {
    const value = roundMoney(amount)
    this.frozenCash = roundMoney(this.frozenCash - value)
    this.cash = roundMoney(this.cash + value)
  }

  // === 挂单占股 ===

  lockShares(id, qty) {
    const p = this._positions.get(id)
    if (!p) return
    p.orderLockedQty += qty
  }

  unlockShares(id, qty) {
    const p = this._positions.get(id)
    if (!p) return
    p.orderLockedQty = Math.max(0, p.orderLockedQty - qty)
  }

  // === 成交 ===

  buy(id, qty, fillPrice) {
    const price = roundMoney(fillPrice)
    const notional = roundMoney(price * qty)
    const fee = computeFee(this.market, 'buy', notional)
    this.cash = roundMoney(this.cash - notional - fee)
    this.feesPaid = roundMoney(this.feesPaid + fee)
    this.totalNotional = roundMoney(this.totalNotional + notional)

    const existing = this._positions.get(id)
    if (existing) {
      const totalCost = existing.avgCost * existing.qty + price * qty
      existing.qty += qty
      existing.avgCost = roundMoney(totalCost / existing.qty)
      existing.t1LockedQty += qty
    } else {
      this._positions.set(id, {
        instrumentId: id,
        qty,
        avgCost: price,
        t1LockedQty: qty,
        orderLockedQty: 0,
      })
    }
    return { notional, fee }
  }

  sell(id, qty, fillPrice) {
    const p = this._positions.get(id)
    if (!p) return { notional: 0, fee: 0 }
    const price = roundMoney(fillPrice)
    const notional = roundMoney(price * qty)
    const fee = computeFee(this.market, 'sell', notional)
    this.cash = roundMoney(this.cash + notional - fee)
    this.feesPaid = roundMoney(this.feesPaid + fee)
    this.totalNotional = roundMoney(this.totalNotional + notional)
    this.realizedPnL = roundMoney(this.realizedPnL + (price - p.avgCost) * qty - fee)

    // 可卖部分已经排除了 t1LockedQty / orderLockedQty，故卖出只动 qty，不动锁定数：
    // 锁定股数天然恒 <= qty（可卖 = qty − 锁定），qty 归零时锁定必然已为 0。
    p.qty -= qty
    // 卖出归零：不留 qty = 0 的空条目
    if (p.qty <= 0) this._positions.delete(id)
    return { notional, fee }
  }

  // === 结算 ===

  /** 结算第 3 步：A 股买入次日解除 T+1 锁定。 */
  clearT1Locks() {
    for (const p of this._positions.values()) p.t1LockedQty = 0
  }

  // === 派生量（每帧重算，永不持久化）===

  marketValueOf(id, quotes) {
    const p = this._positions.get(id)
    const q = quotes?.[id]
    if (!p || !q) return 0
    return roundMoney(q.lastPrice * p.qty)
  }

  positions(quotes) {
    const list = []
    for (const p of this._positions.values()) {
      const q = quotes?.[p.instrumentId]
      const lastPrice = q ? q.lastPrice : p.avgCost
      const marketValue = roundMoney(lastPrice * p.qty)
      list.push({
        instrumentId: p.instrumentId,
        qty: p.qty,
        avgCost: roundMoney(p.avgCost),
        lockedQty: p.t1LockedQty + p.orderLockedQty,
        marketValue,
        unrealizedPnL: roundMoney(lastPrice * p.qty - p.avgCost * p.qty),
      })
    }
    return list
  }

  totalMarketValue(quotes) {
    let sum = 0
    for (const p of this._positions.values()) sum += this.marketValueOf(p.instrumentId, quotes)
    return roundMoney(sum)
  }

  unrealizedPnL(quotes) {
    let sum = 0
    for (const p of this._positions.values()) {
      const q = quotes?.[p.instrumentId]
      const lastPrice = q ? q.lastPrice : p.avgCost
      sum += lastPrice * p.qty - p.avgCost * p.qty
    }
    return roundMoney(sum)
  }

  /** NAV = 可用资金 + 冻结资金 + Σ 持仓市值 */
  nav(quotes) {
    return roundMoney(this.cash + this.frozenCash + this.totalMarketValue(quotes))
  }

  // === 存档（Stage 1 节拍级存档，plan 决策 6）===

  toJSON() {
    return {
      cash: roundMoney(this.cash),
      frozenCash: roundMoney(this.frozenCash),
      realizedPnL: roundMoney(this.realizedPnL),
      feesPaid: roundMoney(this.feesPaid),
      totalNotional: roundMoney(this.totalNotional),
      opened: this.opened,
      funded: this.funded,
      positions: [...this._positions.values()].map((p) => ({
        instrumentId: p.instrumentId,
        qty: p.qty,
        avgCost: roundMoney(p.avgCost),
        t1LockedQty: p.t1LockedQty,
        orderLockedQty: p.orderLockedQty,
      })),
    }
  }

  loadFrom(data) {
    if (!data) return this
    this.cash = roundMoney(data.cash)
    this.frozenCash = roundMoney(data.frozenCash)
    this.realizedPnL = roundMoney(data.realizedPnL)
    this.feesPaid = roundMoney(data.feesPaid)
    this.totalNotional = roundMoney(data.totalNotional)
    this.opened = Boolean(data.opened)
    this.funded = Boolean(data.funded)
    this._positions = new Map()
    for (const p of data.positions || []) {
      this._positions.set(p.instrumentId, {
        instrumentId: p.instrumentId,
        qty: Number(p.qty) || 0,
        avgCost: roundMoney(p.avgCost),
        t1LockedQty: Number(p.t1LockedQty) || 0,
        orderLockedQty: Number(p.orderLockedQty) || 0,
      })
    }
    return this
  }
}
