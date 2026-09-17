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

import { computeFee, roundMoney, roundTo } from './fees.js'

export class Account {
  constructor({ initialCash = 100000, market = 'A_SHARE', fx = null } = {}) {
    this.initialCash = roundMoney(initialCash)
    this.market = market
    /** 汇率账本（FxBook）。**只为折算服务**，不参与任何评级判定。 */
    this.fx = fx
    this.reset()
  }

  setFx(fx) {
    this.fx = fx || null
    return this
  }

  /** 1 单位该货币 = 多少 CNY（无汇率账本时退化为 1，即 Stage 0/1/2 的纯 CNY 行为）。 */
  rateFor(currency) {
    if (!currency || currency === 'CNY') return 1
    if (!this.fx) return 1
    return this.fx.rateOf(currency)
  }

  /** 把该货币金额折算成 CNY。 */
  toCNY(amount, currency) {
    return roundTo((Number(amount) || 0) * this.rateFor(currency), 4)
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

  /**
   * 买入。
   * @param {object} [opts] `{ market, currency, tPlus }`
   *   - 费用按该市场的规则算（**以该市场计价货币计**），再折算成 CNY 从现金扣。
   *   - `tPlus === 1` 才锁 T+1（T+0 市场买入即可卖）。
   *   - 记录买入时的汇率 `buyRate`，供复盘拆分「股价贡献 / 汇率贡献」。
   */
  buy(id, qty, fillPrice, opts = {}) {
    const market = opts.market || this.market || 'A_SHARE'
    const currency = opts.currency || 'CNY'
    const tPlus = opts.tPlus === undefined ? 1 : opts.tPlus
    const rate = this.rateFor(currency)
    const price = roundMoney(fillPrice)
    const notional = roundMoney(price * qty)
    const fee = computeFee(market, 'buy', notional)
    const debitCNY = roundMoney((notional + fee) * rate)
    this.cash = roundMoney(this.cash - debitCNY)
    this.feesPaid = roundMoney(this.feesPaid + fee * rate)
    this.totalNotional = roundMoney(this.totalNotional + notional * rate)

    const lockQty = tPlus === 1 ? qty : 0
    const existing = this._positions.get(id)
    if (existing) {
      const totalCost = existing.avgCost * existing.qty + price * qty
      existing.qty += qty
      existing.avgCost = roundMoney(totalCost / existing.qty)
      existing.t1LockedQty += lockQty
      // 加权平均买入汇率（按成本权重），供汇率贡献拆分
      const wOld = existing.avgCost > 0 ? (existing.qty - qty) : 0
      const wNew = qty
      existing.buyRate = roundTo(
        (existing.buyRate * wOld + rate * wNew) / Math.max(1, wOld + wNew), 6)
    } else {
      this._positions.set(id, {
        instrumentId: id,
        market,
        currency,
        qty,
        avgCost: price,
        buyRate: roundTo(rate, 6),
        t1LockedQty: lockQty,
        orderLockedQty: 0,
      })
    }
    return { notional, fee, debitCNY, rate }
  }

  /**
   * 卖出。卖出所得按**当前**汇率折回 CNY —— 汇率变动会真实影响这笔的钱，
   * 这就是「汇率风险」的教学落点。
   */
  sell(id, qty, fillPrice, opts = {}) {
    const p = this._positions.get(id)
    if (!p) return { notional: 0, fee: 0, creditCNY: 0, rate: 1 }
    const market = opts.market || p.market || this.market || 'A_SHARE'
    const currency = opts.currency || p.currency || 'CNY'
    const rate = this.rateFor(currency)
    const price = roundMoney(fillPrice)
    const notional = roundMoney(price * qty)
    const fee = computeFee(market, 'sell', notional)
    const creditCNY = roundMoney((notional - fee) * rate)
    this.cash = roundMoney(this.cash + creditCNY)
    this.feesPaid = roundMoney(this.feesPaid + fee * rate)
    this.totalNotional = roundMoney(this.totalNotional + notional * rate)
    this.realizedPnL = roundMoney(this.realizedPnL + (price - p.avgCost) * qty * rate - fee * rate)

    p.qty -= qty
    if (p.qty <= 0) this._positions.delete(id)
    return { notional, fee, creditCNY, rate }
  }

  // === 结算 ===

  /** 结算第 3 步：A 股买入次日解除 T+1 锁定。 */
  clearT1Locks() {
    for (const p of this._positions.values()) p.t1LockedQty = 0
  }

  // === 派生量（每帧重算，永不持久化）===

  /** 单只持仓的市值（**折成 CNY**）。 */
  marketValueOf(id, quotes) {
    const p = this._positions.get(id)
    const q = quotes?.[id]
    if (!p || !q) return 0
    const currency = q.currency || p.currency || 'CNY'
    const rate = this.rateFor(currency)
    return roundMoney(q.lastPrice * p.qty * rate)
  }

  /** 单只持仓的市值（**原始货币**，UI 展示「原始价 / 折人民币」两栏用）。 */
  marketValueNative(id, quotes) {
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
      const currency = (q && q.currency) || p.currency || 'CNY'
      const rate = this.rateFor(currency)
      const marketValue = roundMoney(lastPrice * p.qty * rate)
      list.push({
        instrumentId: p.instrumentId,
        market: (q && q.market) || p.market || 'A_SHARE',
        currency,
        rate,
        qty: p.qty,
        avgCost: roundMoney(p.avgCost),
        lockedQty: p.t1LockedQty + p.orderLockedQty,
        marketValue,
        // 成本项用**买入时的汇率**（buyRate）锁定，市值项用**当前汇率** ——
        // 否则汇率影响会在两端同时出现而自行抵消，汇率贡献恒为 0。
        // 于是恒有：priceContribution + fxContribution === unrealizedPnL
        fxContribution: roundMoney(p.avgCost * p.qty * (rate - p.buyRate)),
        priceContribution: roundMoney((lastPrice - p.avgCost) * p.qty * rate),
        unrealizedPnL: roundMoney(lastPrice * p.qty * rate - p.avgCost * p.qty * p.buyRate),
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
      const currency = (q && q.currency) || p.currency || 'CNY'
      const rate = this.rateFor(currency)
      // 同上：成本按买入汇率锁定，市值按当前汇率
      sum += lastPrice * p.qty * rate - p.avgCost * p.qty * p.buyRate
    }
    return roundMoney(sum)
  }

  /** NAV = 可用资金 + 冻结资金 + Σ 持仓市值（**全部折成 CNY**） */
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
        market: p.market || 'A_SHARE',
        currency: p.currency || 'CNY',
        qty: p.qty,
        avgCost: roundMoney(p.avgCost),
        buyRate: roundTo(p.buyRate === undefined ? 1 : p.buyRate, 6),
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
        market: p.market || 'A_SHARE',
        currency: p.currency || 'CNY',
        qty: Number(p.qty) || 0,
        avgCost: roundMoney(p.avgCost),
        buyRate: roundTo(p.buyRate === undefined ? 1 : p.buyRate, 6),
        t1LockedQty: Number(p.t1LockedQty) || 0,
        orderLockedQty: Number(p.orderLockedQty) || 0,
      })
    }
    return this
  }
}
