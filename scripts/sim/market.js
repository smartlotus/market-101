/**
 * MarketSim —— Stage 0 唯一门面（PRD §3 全流程）。
 *
 * 只做算术与状态，不碰 DOM、不继承 Node：
 *   - 每日子时序（§3.1）：抽事件 → 算行情 → 玩家在**已反映事件的价格**上交易
 *   - 每日结算（§3.5）：行情推进 / 持仓重估 / 解除 T+1 / 撤单 / 净值记录
 *   - 下单与撮合 + 费用 + 拒单（§3.4）
 *
 * 全部可断言状态经 snapshot() 透出给宿主 Node 的 runtimeState()。
 */

import { Account } from './account.js'
import { Calendar } from './calendar.js'
import { EventDeck, toPublicEvent } from './eventDeck.js'
import { QUOTE_PARAMS, QuoteEngine } from './quote.js'
import { LOT_SIZE, PRICE_TICK, computeFee, isPriceTickAligned, roundMoney } from './fees.js'
export const MARKET = 'A_SHARE'

/** 拒单原因码（与 GDD 拒单表编号一致；#5 期权 / #9 基金属后续 Stage，Stage 0 不可达）。 */
export const REJECT = {
  FUNDS: 'REJECT_1',
  LIMIT: 'REJECT_2',
  CLOSED: 'REJECT_3',
  T1: 'REJECT_4',
  LOT: 'REJECT_6',
  TICK: 'REJECT_7',
  SHARES: 'REJECT_8',
  QTY: 'REJECT_10',
}

/** 玩家可见中文文案（PRD §3.4 拒单表，逐字照录）。 */
export const REJECT_TEXT = {
  CLOSED: '今天该市场休市，无法下单',
  T1: 'A 股实行 T+1，今日买入需下个交易日才能卖出',
  LOT: `A 股最小交易单位为 ${LOT_SIZE} 股（1 手）`,
  TICK: `价格需为 ¥${PRICE_TICK.toFixed(2)} 的整数倍`,
  SHARES: '可用持仓不足，无法卖出',
  QTY: '委托数量必须大于 0',
}

function money2(value) {
  return roundMoney(value).toFixed(2)
}

export class MarketSim {
  constructor({ instruments = [], events = [], config = {} } = {}) {
    this.instruments = instruments
    this._instrumentById = new Map(instruments.map((i) => [i.id, i]))
    this.config = {
      initialCash: 100000,
      startDate: '2026-01-05',
      historyBars: 30,
      defaultInstrumentId: instruments[0] ? instruments[0].id : null,
      // Stage 1（plan 决策 8）：裸构造 / eval 单测保持 Stage 0 行为（开局即第 1 交易日）。
      // BrokerShell 传 false → 开局落在「未开户、¥0、日期未推进」，第一个交易日会话
      // 由节拍 1.3 入金后的 beginFirstDay() 开启。
      autoEnterFirstDay: true,
      ...config,
    }
    this.market = MARKET
    this.params = QUOTE_PARAMS[MARKET]
    this.calendar = new Calendar({ startDate: this.config.startDate })
    this.deck = new EventDeck(events)
    this._eventById = new Map(
      (Array.isArray(events) ? events : []).filter((e) => e && e.id).map((e) => [e.id, e]),
    )
    this.quotes = new QuoteEngine(instruments, this.params, { historyBars: this.config.historyBars })
    this.account = new Account({ initialCash: this.config.initialCash, market: this.market })
    this.reset()
  }

  // === 生命周期 ===

  /**
   * 世界重启：日历 / 事件池 / 行情 / 账户全部回到起点。
   * `autoEnterFirstDay` 决定开局的「世界状态」：
   *   true （默认，Stage 0 沙盒语义）→ 开户 + 入金 + 开启第 1 个交易日会话
   *   false（Stage 1 章节语义，PRD §2.1）→ 未开户、`cash=0`、日期未推进、`navHistory=[]`
   * 「重置账户」（PRD §3.6）不是本方法，见 `resetAccount()`。
   */
  reset() {
    this.calendar.reset()
    this.deck.reset()
    this.quotes.seedHistory()
    this.account.reset()
    this.pendingOrders = []
    this._nextOrderId = 1
    this.lastOrder = null
    this.currentEvent = null
    this.selectedInstrumentId = this.config.defaultInstrumentId
    this.navHistory = []
    this.navStartOfDay = 0
    this.dayOpen = false
    this.nextEventQueue = []
    this.directedDrawn = []
    if (this.config.autoEnterFirstDay) this._openSandboxSession()
    return this
  }

  // === 定向事件（PRD §3.8）===

  /** 声明本章的定向事件优先队列（按声明顺序，在开市日优先于随机抽签消耗）。 */
  setDirectedEventQueue(ids = []) {
    this.nextEventQueue = (Array.isArray(ids) ? ids : []).filter((id) => this._eventById.has(id))
    return this.nextEventQueue
  }

  /** 把某件事件钉到**下一次**开市日（插队首；节拍点名事件用，PRD §3.8 硬要求）。 */
  pinDirectedEvent(id) {
    if (!this._eventById.has(id)) return false
    this.nextEventQueue = [id, ...this.nextEventQueue.filter((q) => q !== id)]
    return true
  }

  /** 开户 + 入金 + 开启第 1 个交易日会话（Stage 0 开局态，幂等）。 */
  _openSandboxSession() {
    this.account.open()
    this.account.fund(this.config.initialCash)
    this.beginFirstDay()
    return this
  }

  /**
   * dev 钩子：进入与 Stage 0 沙盒**完全一致**的合法状态（Lead R2）。
   * 该状态是产品的第三种模式（PRD §3.2 `sandbox`），不是测试专用 hack。
   * 默认选中标的取标的表首行（= Stage 0 的 `defaultInstrumentId` 语义），
   * 以便 Stage 0 的回归断言逐字保持不变。
   */
  devSkipToSandbox({ instrumentId = null } = {}) {
    this.config.autoEnterFirstDay = true
    this.reset()
    this.selectInstrument(instrumentId || (this.instruments[0] && this.instruments[0].id) || null)
    return this
  }

  // === 逐拍生命周期（PRD §3.4）===

  /** 节拍 1.2「同意并开户」。 */
  openAccount() {
    return this.account.open()
  }

  /** 节拍 1.3「入金 ¥100,000」（初始本金，**不是**外来入金）。 */
  fundInitial() {
    if (this.account.funded) return false
    this.account.fund(this.config.initialCash)
    return true
  }

  /**
   * 节拍 1.3 之后开启第一个交易日会话（抽事件 → 算行情 → 记一笔净值）。
   * 在本方法之前任何 `advanceDay()` 都只是「开局」，不是推进。
   */
  beginFirstDay() {
    if (this.dayOpen) return false
    this._enterDay()
    this._recordNav()
    this.dayOpen = true
    return true
  }

  /**
   * 纯读取：账户可用资金能买得起的最低价款（PRD §3.4 缺陷修复 1）。
   * 与 `selectCheapestAffordable()` 共用同一份判据，避免「产品规则」出现两套实现。
   */
  cheapestAffordableId() {
    const quotes = this.quotes.snapshot()
    let best = null
    let cheapest = null
    for (const inst of this.instruments) {
      const q = quotes[inst.id]
      if (!q) continue
      const perLot = roundMoney(q.lastPrice * LOT_SIZE)
      if (!cheapest || perLot < cheapest.perLot) cheapest = { id: inst.id, perLot }
      const cost = roundMoney(perLot + computeFee(this.market, 'buy', perLot))
      if (cost > this.account.cash) continue
      if (!best || perLot < best.perLot) best = { id: inst.id, perLot }
    }
    // 兜底（理论上不可达：¥100,000 总能买起最低价款）：退化为全场最低价款，
    // 保证「默认高亮」永远有值，不给玩家一个空白的下单目标。
    const pick = best || cheapest
    return pick ? pick.id : null
  }

  /** 账户可用资金能买得起的最低价款（PRD §3.4 缺陷修复 1）。返回选中标 id。 */
  selectCheapestAffordable() {
    const pick = this.cheapestAffordableId()
    if (pick) this.selectedInstrumentId = pick
    return this.selectedInstrumentId
  }

  /** 每章进场前清理章内残留（PRD §3.7）：撤掉未成交挂单、解除 T+1 锁定。 */
  clearResidualState() {
    this._cancelAllPendingOrders()
    this.account.clearT1Locks()
    this.lastOrder = null
    return this
  }

  /**
   * 「重置账户」（PRD §3.6，Stage 0 已有）：清空持仓 + `cash = ¥100,000`；
   * 行情 / 日历 / 净值曲线 / 章节进度 / 词典 / 导师关系**全部保留**。
   * 净增现金算**外来入金**（`amount` 为 0 表示 NAV 已高于本金，不倒扣）。
   */
  resetAccount() {
    const navBefore = this.account.nav(this.quotes.snapshot())
    const injection = roundMoney(Math.max(0, this.config.initialCash - navBefore))
    this._cancelAllPendingOrders()
    this.account.clearPositions()
    this.account.clearT1Locks()
    this.account.fund(this.config.initialCash)
    this.lastOrder = null
    return { navBefore, injection }
  }

  /** 「一键补足本金」（PRD §3.6）：`cash += ¥100,000 − NAV`，持仓与净值曲线全保留。 */
  topUpCapital() {
    const navBefore = this.account.nav(this.quotes.snapshot())
    const injection = roundMoney(Math.max(0, this.config.initialCash - navBefore))
    this.account.credit(injection)
    return { navBefore, injection }
  }

  /**
   * 进入当日（§3.1 步骤 1–2）：抽事件 → 立即据此算当日 K 线与最新价。
   * 当日起点净值在**生成当日行情之前**记录 = 上一交易日收盘净值，
   * 于是顶栏「当日涨跌幅」就是玩家今日的真实盈亏（含行情波动与交易成本）。
   * 第 1 个交易日没有持仓，起点净值即 ¥100,000 现金（Edge Case「NAV 的起点」）。
   */
  _enterDay() {
    this.navStartOfDay = this.account.nav(this.quotes.snapshot())
    const isOpen = this.calendar.isMarketOpen
    // 休市日不抽事件（§3.1），行情也整体冻结，定向队列同样不动
    let event = null
    if (isOpen) {
      // 定向事件优先队列（PRD §3.8）：开市日优先于随机抽签消耗，走的是 Stage 0
      // 已有的 `devSetEvent` 同一条路径（forceEvent → drawNext），不改抽签机制与牌堆计数。
      const queuedId = this.nextEventQueue.shift()
      if (queuedId) {
        const spec = this._eventById.get(queuedId)
        if (spec) {
          this.deck.forceEvent(spec)
          this.directedDrawn.push(queuedId)
        }
      }
      event = this.deck.drawNext()
    }
    this.currentEvent = toPublicEvent(event)
    this.quotes.advanceDay(event, isOpen)
  }

  /** 点击「进入下一交易日」：结算（§3.5）→ 进入下一自然日 → 回到 §3.1 步骤 1。 */
  advanceDay() {
    // 第一个交易日会话由节拍 1.3 入金后的 beginFirstDay() 开启（PRD §2.1：
    // 节拍 0–1.5 期间日期不推进）。未开启时本调用只是「开局」，不是「推进」。
    if (!this.dayOpen) {
      this.beginFirstDay()
      return this
    }
    this._cancelAllPendingOrders() // 结算第 4 步：当日有效，跨日未成交自动撤销
    this.account.clearT1Locks()    // 结算第 3 步：解除 T+1
    this.calendar.advance()
    this._enterDay()               // 结算第 1 步行情推进 + 第 2 步持仓重估（派生量随快照重算）
    this._recordNav()              // 结算第 5 步：净值记录（休市日 NAV 不变也照样记一笔）
    this.lastOrder = null
    return this
  }

  /**
   * 结算第 5 步（PRD §3.5）：把当日 NAV 写入净值历史序列，供 Stage 4 净值曲线消费。
   * 进入当日时当日收盘价已定（§3.1 步骤 2），故此处记下的即该日收盘净值；
   * 休市日行情冻结、NAV 不变，仍按「每推进一日记一笔」写入。金额一律 ¥0.01。
   */
  _recordNav() {
    this.navHistory.push(roundMoney(this.account.nav(this.quotes.snapshot())))
    return this.navHistory
  }

  _cancelAllPendingOrders() {
    for (const order of this.pendingOrders) {
      if (order.frozenCash > 0) this.account.releaseCash(order.frozenCash)
      if (order.lockedQty > 0) this.account.unlockShares(order.instrumentId, order.lockedQty)
    }
    this.pendingOrders = []
  }

  // === 交互 ===

  selectInstrument(instrumentId) {
    if (this._instrumentById.has(instrumentId)) this.selectedInstrumentId = instrumentId
    return this.selectedInstrumentId
  }

  /** 下单（§3.4）。spec = { side, instrumentId, type: 'limit'|'market', price, qty } */
  submitOrder(spec = {}) {
    const side = spec.side === 'sell' ? 'sell' : 'buy'
    const type = spec.type === 'market' ? 'market' : 'limit'
    const instrumentId = spec.instrumentId || this.selectedInstrumentId
    const rawQty = Number(spec.qty)
    const qty = Number.isFinite(rawQty) ? rawQty : 0
    const rawPrice = spec.price
    const price = rawPrice === null || rawPrice === undefined || rawPrice === '' ? null : Number(rawPrice)

    const instrument = this._instrumentById.get(instrumentId)
    if (!instrument) throw new Error(`submitOrder: 未知标的 "${instrumentId}"`)

    const reject = (reasonCode, rejectText) => {
      this.lastOrder = {
        accepted: false,
        status: 'rejected',
        reasonCode,
        rejectText,
        side,
        instrumentId,
        fillPrice: null,
        qty,
        fee: 0,
        notional: 0,
      }
      return this.lastOrder
    }

    if (!this.calendar.isMarketOpen) return reject(REJECT.CLOSED, REJECT_TEXT.CLOSED)
    if (!Number.isFinite(rawQty) || qty <= 0) return reject(REJECT.QTY, REJECT_TEXT.QTY)
    if (qty % LOT_SIZE !== 0) return reject(REJECT.LOT, REJECT_TEXT.LOT)
    if (type === 'limit' && (!Number.isFinite(price) || price <= 0 || !isPriceTickAligned(price))) {
      return reject(REJECT.TICK, REJECT_TEXT.TICK)
    }

    const state = this.quotes.stateOf(instrumentId)
    const lastPrice = roundMoney(state.lastPrice)
    const { limitUp, limitDown } = this.quotes.limitsFor(instrument)
    if (type === 'limit' && (price > limitUp || price < limitDown)) {
      return reject(REJECT.LIMIT, `委托价超出今日涨跌停区间（¥${money2(limitDown)} – ¥${money2(limitUp)}）`)
    }

    // 成交价推导：限价成交取优 min(限价, 对手价)，保证成交价不差于限价；未触发则挂起。
    let fillPrice
    let pending = false
    if (type === 'market') {
      const slip = this.params.slippagePct
      fillPrice = roundMoney(side === 'buy' ? lastPrice * (1 + slip) : lastPrice * (1 - slip))
    } else {
      const triggered = side === 'buy' ? lastPrice <= price : lastPrice >= price
      if (triggered) {
        fillPrice = roundMoney(Math.min(price, lastPrice))
      } else {
        fillPrice = roundMoney(price)
        pending = true
      }
    }

    const notional = roundMoney(fillPrice * qty)
    const fee = computeFee(this.market, side, notional)
    const needed = roundMoney(notional + fee)

    if (side === 'sell') {
      const position = this.account.getPosition(instrumentId)
      if (!position || position.qty < qty) return reject(REJECT.SHARES, REJECT_TEXT.SHARES)
      if (this.account.availableQty(instrumentId) < qty) {
        // 差额来自当日买入的 T+1 锁定 → 报 #4；仅被挂单占用 → 报 #8
        return position.t1LockedQty > 0
          ? reject(REJECT.T1, REJECT_TEXT.T1)
          : reject(REJECT.SHARES, REJECT_TEXT.SHARES)
      }
    } else if (this.account.cash < needed) {
      return reject(
        REJECT.FUNDS,
        `可用资金不足，还差 ¥${money2(needed - this.account.cash)}（含手续费）`,
      )
    }

    if (!pending) {
      if (side === 'buy') this.account.buy(instrumentId, qty, fillPrice)
      else this.account.sell(instrumentId, qty, fillPrice)
      this.lastOrder = {
        accepted: true,
        status: 'filled',
        reasonCode: 'OK',
        rejectText: '',
        side,
        instrumentId,
        fillPrice,
        qty,
        fee,
        notional,
      }
      return this.lastOrder
    }

    // 挂起：限价买冻结 fillPrice × Q + fee，限价卖锁定该部分持仓
    const order = {
      id: `O${String(this._nextOrderId++).padStart(4, '0')}`,
      side,
      instrumentId,
      limitPrice: fillPrice,
      qty,
      frozenCash: side === 'buy' ? needed : 0,
      lockedQty: side === 'sell' ? qty : 0,
    }
    if (order.frozenCash > 0) this.account.freezeCash(order.frozenCash)
    if (order.lockedQty > 0) this.account.lockShares(instrumentId, order.lockedQty)
    this.pendingOrders.push(order)
    this.lastOrder = {
      accepted: true,
      status: 'pending',
      reasonCode: 'OK',
      rejectText: '',
      side,
      instrumentId,
      fillPrice,
      qty,
      fee,
      notional,
    }
    return this.lastOrder
  }

  // === 白盒测试钩子（plan.md 决策 8）===

  /** 固定下一日（或下一次抽签）的事件，用于确定性驱动价格公式断言。 */
  devSetEvent(spec) {
    this.deck.forceEvent(spec)
    return toPublicEvent(spec)
  }

  /** 直接抽一次事件并返回，用于在不推进交易日的前提下断言事件池循环。 */
  devDrawEvent() {
    return toPublicEvent(this.deck.drawNext())
  }

  // === 派生量 ===

  klinesFor(instrumentId) {
    return this.quotes.klinesFor(instrumentId)
  }

  limitsFor(instrumentId) {
    const instrument = this._instrumentById.get(instrumentId)
    if (!instrument) return { limitUp: 0, limitDown: 0 }
    return this.quotes.limitsFor(instrument)
  }

  // === Runtime 状态契约 ===

  snapshot() {
    const quotes = this.quotes.snapshot()
    const nav = this.account.nav(quotes)
    const dayReturn = roundMoney(nav - this.navStartOfDay)
    const dayReturnPct = this.navStartOfDay
      ? Math.round((dayReturn / this.navStartOfDay) * 1e6) / 1e6
      : 0
    return {
      dayIndex: this.calendar.dayIndex,
      inGameDate: this.calendar.inGameDate,
      weekdayLabel: this.calendar.weekdayLabel,
      isMarketOpen: this.calendar.isMarketOpen,
      calendarClosedReason: this.calendar.closedReason,
      cash: roundMoney(this.account.cash),
      frozenCash: roundMoney(this.account.frozenCash),
      positions: this.account.positions(quotes),
      realizedPnL: roundMoney(this.account.realizedPnL),
      unrealizedPnL: this.account.unrealizedPnL(quotes),
      marketValue: this.account.totalMarketValue(quotes),
      feesPaid: roundMoney(this.account.feesPaid),
      // —— Stage 1 追加（既有 27 字段名/类型/语义一律不变，plan 决策 7）——
      accountOpened: this.account.opened,
      accountFunded: this.account.funded,
      dayOpen: this.dayOpen,
      tradedNotional: roundMoney(this.account.totalNotional),
      NAV: nav,
      dayReturn,
      dayReturnPct,
      navHistory: [...this.navHistory],
      selectedInstrumentId: this.selectedInstrumentId,
      quotes,
      currentEvent: this.currentEvent,
      lastOrder: this.lastOrder,
      pendingOrders: this.pendingOrders.map((o) => ({ ...o })),
      canSubmitOrder: this.calendar.isMarketOpen && Boolean(this.selectedInstrumentId),
      eventDeck: this.deck.state(),
    }
  }

  // === 存档（节拍级存档 = 世界快照，plan 决策 6）===

  toJSON() {
    return {
      market: this.market,
      selectedInstrumentId: this.selectedInstrumentId,
      dayOpen: this.dayOpen,
      navStartOfDay: roundMoney(this.navStartOfDay),
      navHistory: [...this.navHistory],
      nextOrderId: this._nextOrderId,
      lastOrder: this.lastOrder ? { ...this.lastOrder } : null,
      pendingOrders: this.pendingOrders.map((o) => ({ ...o })),
      currentEvent: this.currentEvent ? { ...this.currentEvent } : null,
      nextEventQueue: [...this.nextEventQueue],
      directedDrawn: [...this.directedDrawn],
      account: this.account.toJSON(),
      calendar: this.calendar.toJSON(),
      deck: this.deck.toJSON(),
      quotes: this.quotes.toJSON(),
    }
  }

  loadFrom(data) {
    if (!data) return this
    this.account.loadFrom(data.account)
    this.calendar.loadFrom(data.calendar)
    this.deck.loadFrom(data.deck)
    this.quotes.loadFrom(data.quotes)
    this.selectedInstrumentId = data.selectedInstrumentId || this.config.defaultInstrumentId
    this.dayOpen = Boolean(data.dayOpen)
    this.navStartOfDay = roundMoney(data.navStartOfDay)
    this.navHistory = Array.isArray(data.navHistory) ? data.navHistory.map((v) => roundMoney(v)) : []
    this._nextOrderId = Number(data.nextOrderId) || 1
    this.lastOrder = data.lastOrder ? { ...data.lastOrder } : null
    this.pendingOrders = Array.isArray(data.pendingOrders) ? data.pendingOrders.map((o) => ({ ...o })) : []
    this.currentEvent = data.currentEvent ? { ...data.currentEvent } : null
    this.nextEventQueue = Array.isArray(data.nextEventQueue)
      ? data.nextEventQueue.filter((id) => this._eventById.has(id))
      : []
    this.directedDrawn = Array.isArray(data.directedDrawn)
      ? data.directedDrawn.filter((id) => this._eventById.has(id))
      : []
    return this
  }
}

export default MarketSim
