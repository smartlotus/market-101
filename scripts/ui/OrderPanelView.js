/**
 * OrderPanelView —— 下单面板（PRD §2.5 / §3.4 / §3.4 节拍 1.5）。
 *
 * 买入/卖出切换 · 限价输入 + 市价选项 · 数量（按手）· 可买/可卖提示 ·
 * 成交金额 / 手续费 / 印花税 / 过户费 / 预计支出收入的**逐项**明细 · 提交按钮。
 *
 * 休市时整个下单区禁用，并把「今天该市场休市，无法下单」直接摆在面板上，
 * 不让玩家以为按钮坏了。估算用的费用公式与撮合侧共用同一份 `computeFee`，绝不各写一套。
 *
 * ---- Stage 1 追加（plan Scripts 行 82）----
 *   1. **节拍预填**：本拍数据声明 `prefill` 时（第一章 1.5 `{type:'limit', priceRef:'lastPrice',
 *      qtyLots:1}`），按「限价 / 价格 = 最新价 / 1 手」预填，逐项明细立刻算好。
 *      只在**进入该拍时应用一次**，绝不覆盖玩家自己改过的输入。
 *   2. **非阻断超资金提示**（PRD Edge Case 1.4 / R6）：`1 手金额 + 手续费 > 可用资金` 时，
 *      在提交按钮上方给一行提示（文案来自本章 `hints.unaffordableNote`）+ 一个
 *      「回到买得起的那只」按钮（`onPickAffordable`）。**不改玩家输入的数量、不只禁用提交**——
 *      玩家仍可自己提交（此时拒单 #1 属于玩家主动越界）。
 *      没有声明 `hints.unaffordableNote` 的章（第二章：撞墙式教学）不出现该提示。
 *   3. **提交锁 + 幂等**（PRD Edge Case 1.5）：提交期间重复点击被吞掉；成交后**同一笔**
 *      （标的/方向/类型/价格/数量全同）再次点击是**幂等空操作**，按钮显示「已买入」。
 *      改了参数即可继续下单；世界被重置后由宿主调 `clearFilledOrders()` 清空历史，
 *      否则重玩时会买不动。键**故意不含节拍**（见 `_orderKey`）。
 *
 * 不做的事：不用禁用按钮 / 灰行 / 遮罩来引导玩家（PRD R3）；上面第 3 条的锁只防重复提交。
 * 超资金提示出现时给面板加 `.tight`（只收紧行距），保证它不会把面板撑出 506px 的固定高度。
 */

import { LOT_SIZE, computeFee, feeBreakdown, roundMoney } from '../sim/fees.js'
import { el, fmtMoney, fmtNum, setText } from './kit.js'

/** 文案模板里的 `{amount}` 由本视图代入（模板本身来自数据）。 */
function fillTemplate(text, vars) {
  if (typeof text !== 'string') return ''
  return text.replace(/\{(\w+)\}/g, (m, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : m,
  )
}

export default class OrderPanelView {
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.instruments = cfg.instruments || []
    this.byId = new Map(this.instruments.map((i) => [i.id, i]))
    this.slippagePct = cfg.slippagePct ?? 0.001
    this.onSubmit = null
    this.onPickAffordable = null
    this.hints = cfg.hints || {}

    this.side = 'buy'
    this.priceMode = 'limit'
    this._priceInstrumentId = null
    this._state = null
    this._inst = null
    this._q = null
    this._prefillBeatId = null
    this._submitting = false
    this._filledKeys = new Set()

    // 买 / 卖
    const sideSeg = el('div', 'seg', root)
    this.buyBtn = el('button', 'buy on', sideSeg, '买入')
    this.sellBtn = el('button', 'sell', sideSeg, '卖出')
    this.buyBtn.type = 'button'
    this.sellBtn.type = 'button'
    this.buyBtn.addEventListener('click', () => this._setSide('buy'))
    this.sellBtn.addEventListener('click', () => this._setSide('sell'))

    // 限价 / 市价
    const modeSeg = el('div', 'seg small', root)
    this.limitBtn = el('button', 'on', modeSeg, '限价')
    this.marketBtn = el('button', '', modeSeg, '市价')
    this.limitBtn.type = 'button'
    this.marketBtn.type = 'button'
    this.limitBtn.addEventListener('click', () => this._setMode('limit'))
    this.marketBtn.addEventListener('click', () => this._setMode('market'))

    // 价格
    const priceField = el('div', 'field', root)
    el('span', 'lab', priceField, '价格')
    this.priceInput = el('input', '', priceField)
    this.priceInput.type = 'text'
    this.priceInput.inputMode = 'decimal'
    this.priceInput.autocomplete = 'off'
    el('span', 'unit', priceField, '元')
    this.priceInput.addEventListener('input', () => this._renderEstimate())

    // 数量
    const qtyField = el('div', 'field', root)
    el('span', 'lab', qtyField, '数量')
    this.qtyInput = el('input', '', qtyField)
    this.qtyInput.type = 'text'
    this.qtyInput.inputMode = 'numeric'
    this.qtyInput.autocomplete = 'off'
    this.qtyInput.value = String(LOT_SIZE)
    el('span', 'unit', qtyField, '股')
    this.qtyInput.addEventListener('input', () => this._renderEstimate())

    const hints = el('div', 'hint', root)
    this.buyHint = el('span', '', hints, '')
    this.sellHint = el('span', '', hints, '')

    el('div', 'hr', root)

    this.rowNotional = this._kv(root, '成交金额')
    this.rowCommission = this._kv(root, '手续费')
    this.rowStamp = this._kv(root, '印花税')
    this.rowTransfer = this._kv(root, '过户费')
    const totalRow = this._kv(root, '预计支出', 'total')
    this.rowTotalLabel = totalRow.label
    this.rowTotal = totalRow.value

    this.resultEl = el('div', 'result', root)

    // 超资金：非阻断提示 + 「回到买得起的那只」（PRD Edge Case 1.4 / R6）
    this.overEl = el('div', 'overhint ch-hidden', root)
    this.overText = el('span', '', this.overEl, '')
    this.overBtn = el('button', 'ghost', this.overEl, '')
    this.overBtn.type = 'button'
    this.overBtn.addEventListener('click', () => this.onPickAffordable?.())

    this.submitBtn = el('button', 'submit', root, '买入 100 股')
    this.submitBtn.type = 'button'
    this.submitBtn.addEventListener('click', () => this._submit())

    this.noteEl = el('div', 'hint', root)
    this._lotNoteEl = el('span', '', this.noteEl, '')
    this._renderLotNote()
  }

  _kv(parent, label, extra = '') {
    const row = el('div', `kv ${extra}`.trim(), parent)
    const key = el('span', '', row, label)
    const value = el('span', 'v', row, '—')
    return { label: key, value }
  }

  /** 本章节拍声明的文案（由宿主从 `config/chapters.json` 取来，视图不编文案）。 */
  setHints(hints) {
    this.hints = hints && typeof hints === 'object' ? hints : {}
    return this.hints
  }

  /**
   * 世界被重置后（Stage 0 `reset` / 「重置账户」/「重置章节进度」）必须调用：
   * 清掉幂等历史与预填记忆 —— 否则重玩第一章时「买入」会被上一局的「已买入」吞掉，
   * 且 1.5 的节拍预填不再生效。
   */
  clearFilledOrders() {
    this._filledKeys.clear()
    this._prefillBeatId = null
    this.root.dataset.prefillBeat = ''
  }

  _setSide(side) {
    this.side = side
    this.buyBtn.classList.toggle('on', side === 'buy')
    this.sellBtn.classList.toggle('on', side === 'sell')
    this._renderEstimate()
  }

  _setMode(mode) {
    this.priceMode = mode
    this.limitBtn.classList.toggle('on', mode === 'limit')
    this.marketBtn.classList.toggle('on', mode === 'market')
    this.priceInput.disabled = mode === 'market'
    this._renderEstimate()
  }

  // === 提交（含提交锁与幂等）===

  /**
   * 本笔委托的身份：**标的 / 方向 / 类型 / 价格 / 数量**（故意不含 `beatId`）。
   *
   * 不含节拍是必须的：第一章 1.5 成交会立刻把节拍推到 1.5.5（概念卡），
   * 玩家的第二次点击落在**新拍**上 —— 若把 `beatId` 计入身份，两次点击就成了两笔不同的
   * 委托，幂等失效、会真的买两遍。参数一改身份就变，所以「改了参数继续下单」不受影响。
   */
  _orderKey(spec) {
    const price = spec.type === 'market' ? 'mkt' : Number(spec.price).toFixed(2)
    return [spec.instrumentId, spec.side, spec.type, price, spec.qty].join('|')
  }

  _submit() {
    if (!this._inst || this._submitting) return null
    const spec = {
      side: this.side,
      instrumentId: this._inst.id,
      type: this.priceMode,
      price: this.priceMode === 'market' ? null : Number(this.priceInput.value),
      qty: Number(this.qtyInput.value),
    }
    // 幂等：这一笔已经成交过 → 不重复下单（PRD Edge Case 1.5）
    if (this._filledKeys.has(this._orderKey(spec))) return null

    this._submitting = true
    this.submitBtn.dataset.locked = '1'
    this.submitBtn.disabled = true
    let result = null
    try {
      result = this.onSubmit?.(spec) ?? null
    } finally {
      this._submitting = false
      delete this.submitBtn.dataset.locked
    }
    if (result && result.accepted === true && result.status === 'filled') {
      // 记下这一笔的身份 → 之后再点同一笔（按钮显示「已买入」）不再重复下单。
      this._filledKeys.add(this._orderKey(spec))
    }
    this._renderEstimate()
    return result
  }

  // === 预填（节拍 1.5）===

  /**
   * 按本拍 `prefill` 预填一次：限价 / 价格 = 最新价 / 1 手 / 明细逐项。
   * 以 `beatId` 记忆，保证「进拍时填一次、之后不覆盖玩家输入」。
   */
  _applyPrefill(state, q) {
    const beat = (state && state.chapter && state.chapter.beat) || null
    const prefill = beat && beat.prefill
    if (!prefill || !beat.id || this._prefillBeatId === beat.id) return false
    this._prefillBeatId = beat.id
    if (prefill.type === 'limit' || prefill.type === 'market') {
      this.priceMode = prefill.type
      this.limitBtn.classList.toggle('on', prefill.type === 'limit')
      this.marketBtn.classList.toggle('on', prefill.type === 'market')
      this.priceInput.disabled = prefill.type === 'market'
    }
    const lots = Number(prefill.qtyLots)
    if (Number.isFinite(lots) && lots > 0) this.qtyInput.value = String(lots * this._lot())
    if (prefill.priceRef === 'lastPrice' && q) this.priceInput.value = Number(q.lastPrice).toFixed(2)
    this.root.dataset.prefillBeat = beat.id
    return true
  }

  update(state) {
    const inst = this.byId.get(state.selectedInstrumentId)
    if (!inst) return
    const q = (state.quotes || {})[inst.id]
    if (!q) return

    this._state = state
    this._inst = inst
    this._q = q

    this._applyPrefill(state, q)
    this._renderLotNote()

    // 切换标的时把价格输入重置为新标的最新价；不覆盖玩家正在输入的内容
    if (this._priceInstrumentId !== inst.id) {
      this._priceInstrumentId = inst.id
      this.priceInput.value = q.lastPrice.toFixed(2)
    }

    this._renderEstimate()
  }

  /** 交易单位说明：按市场说清自己的规则（不再一律写「A 股 1 手 = 100 股」）。 */
  _renderLotNote() {
    if (!this._lotNoteEl) return
    const market = this._market()
    const lot = this._lot()
    let text
    if (market === 'US') text = '美股 1 股起，支持碎股（最小 0.001 股）· 成交价不差于你的委托价'
    else if (market === 'HK') text = `港股每手股数不固定，这只 1 手 = ${lot} 股 · 成交价不差于你的委托价`
    else if (market === 'FUND') text = '场外基金按金额申购，100 元起 · 按当日收市后净值成交（未知价交易）'
    else if (market === 'CRYPTO') text = '加密货币按金额下单，100 元起 · 7×24 交易、无涨跌停'
    else if (market === 'ETF') text = `ETF 按「手」委托，1 手 = ${lot} 份 · 成交价不差于你的委托价`
    else text = `A 股按「手」委托，1 手 = ${lot} 股 · 成交价不差于你的委托价`
    setText(this._lotNoteEl, text)
  }

  /** 当前标的的市场（不再对所有标的套用 A 股）。 */
  _market() {
    return (this._q && this._q.market) || (this._inst && this._inst.market) || 'A_SHARE'
  }

  /** 当前标的的计价货币。 */
  _currency() {
    return (this._q && this._q.currency) || (this._inst && this._inst.currency) || 'CNY'
  }

  /** 当前标的的每手股数；按金额下单的市场（基金 / 加密）用 1 作参考单位。 */
  _lot() {
    // 构造期还没标的：退回 A 股的 1 手（Stage 0/1 既有缺省），首次 update 后即按标的纠正
    if (!this._inst) return LOT_SIZE
    const l = this._inst.lotSize
    return l === null || l === undefined ? 1 : Number(l) || 1
  }

  /** 该市场的货币符号（成交明细与提示里的金额用）。 */
  _sign() {
    return { CNY: '¥', HKD: 'HK$', USD: '$', USDT: 'USDT ' }[this._currency()] || ''
  }

  _renderEstimate() {
    const state = this._state
    const inst = this._inst
    const q = this._q
    if (!state || !inst || !q) return

    const market = this.priceMode === 'market'
    this.priceInput.disabled = market

    const side = this.side
    const qty = Number(this.qtyInput.value)
    const basis = this._basisPrice(state, q)

    // 可买 / 可卖提示
    const position = (state.positions || []).find((p) => p.instrumentId === inst.id)
    const sellable = position ? position.qty - position.lockedQty : 0
    const perLot = basis ? roundMoney(basis * this._lot()) : 0
    const perLotCost = perLot ? roundMoney(perLot + computeFee(this._market(), 'buy', perLot)) : 0
    const maxLots = perLotCost > 0 ? Math.floor(state.cash / perLotCost) : 0
    setText(this.buyHint, `可买约 ${maxLots} ${this._market() === 'US' ? '股' : '手'}`)
    setText(this.sellHint, `可卖 ${sellable} 股`)

    // 逐项明细
    const validQty = Number.isFinite(qty) && qty > 0
    if (!basis || !validQty) {
      setText(this.rowNotional.value, '—')
      setText(this.rowCommission.value, '—')
      setText(this.rowStamp.value, '—')
      setText(this.rowTransfer.value, '—')
      setText(this.rowTotal, '—')
    } else {
      const notional = roundMoney(basis * qty)
      const bd = feeBreakdown(this._market(), side, notional)
      setText(this.rowNotional.value, fmtMoney(notional))
      setText(this.rowCommission.value, fmtMoney(bd.commission))
      setText(this.rowStamp.value, side === 'sell' ? fmtMoney(bd.stampDuty) : '卖出时收')
      setText(this.rowTransfer.value, fmtMoney(bd.transferFee))
      setText(
        this.rowTotal,
        side === 'buy' ? fmtMoney(notional + bd.total) : fmtMoney(notional - bd.total),
      )
    }
    setText(this.rowTotalLabel, side === 'buy' ? '预计支出' : '预计收入')

    this._renderOverHint(state, q, side)

    // 提交按钮：字面 + 「已买入」幂等态（不禁用 —— 幂等由回调吞掉重复提交实现）
    const spec = {
      side,
      instrumentId: inst.id,
      type: this.priceMode,
      price: market ? null : Number(this.priceInput.value),
      qty,
    }
    const filled = this._filledKeys.has(this._orderKey(spec))
    const qtyLabel = validQty ? `${fmtNum(qty, 0)} 股` : '—'
    const verb = side === 'buy' ? '买入' : '卖出'
    this.submitBtn.textContent = filled ? `已${verb}` : `${verb} ${qtyLabel}`
    this.submitBtn.classList.toggle('sell', side === 'sell')
    this.submitBtn.classList.toggle('done', filled)
    this.submitBtn.disabled = !state.canSubmitOrder
    this.submitBtn.dataset.idempotent = filled ? '1' : '0'

    this._renderResult(state)
  }

  /**
   * 「1 手约 ¥X 超出可用资金」非阻断提示（PRD Edge Case 1.4）：
   * 判据与撮合 `REJECT_1` 同一条（1 手金额 + 手续费 > 可用资金）；
   * 文案与按钮字面来自本章 `hints`。**不改数量、不禁用提交、不加遮罩。**
   */
  _renderOverHint(state, q, side) {
    const note = this.hints.unaffordableNote || ''
    const perLot = roundMoney(Number(q.lastPrice) * this._lot())
    const cost = roundMoney(perLot + computeFee(this._market(), 'buy', perLot))
    const over = side === 'buy' && Boolean(note) && cost > Number(state.cash)
    this.overEl.classList.toggle('ch-hidden', !over)
    // 提示出现时收紧面板行距：本拍可能同时显示「超资金提示 + 拒单回执」，不收紧会撑出 506px 面板
    this.root.classList.toggle('tight', over)
    if (!over) return
    setText(this.overText, fillTemplate(note, { amount: fmtNum(perLot, 0) }))
    const backLabel = this.hints.backToAffordableLabel || ''
    setText(this.overBtn, backLabel)
    this.overBtn.classList.toggle('ch-hidden', !backLabel)
    this.overBtn.dataset.perLot = String(perLot)
  }

  /** 估算用的成交价：与撮合同一套推导（市价含滑点；限价取 min(限价, 最新价)） */
  _basisPrice(state, q) {
    if (this.priceMode === 'market') {
      return roundMoney(this.side === 'buy' ? q.lastPrice * (1 + this.slippagePct) : q.lastPrice * (1 - this.slippagePct))
    }
    const price = Number(this.priceInput.value)
    if (!Number.isFinite(price) || price <= 0) return null
    return this.side === 'buy' ? roundMoney(Math.min(price, q.lastPrice)) : roundMoney(price)
  }

  _renderResult(state) {
    const last = state.lastOrder
    this.resultEl.classList.remove('ok', 'warn', 'bad', 'show')

    if (last && !last.accepted) {
      this.resultEl.classList.add('bad', 'show')
      this.resultEl.textContent = `委托被拒：${last.rejectText}`
      return
    }
    if (last && last.status === 'pending') {
      this.resultEl.classList.add('warn', 'show')
      this.resultEl.textContent = `已挂单：${last.side === 'buy' ? '买入' : '卖出'} ${fmtNum(last.qty, 0)} 股 @ ${fmtNum(last.fillPrice)} 元。当日有效，未成交则下一交易日自动撤销并释放冻结。`
      return
    }
    if (last && last.status === 'filled') {
      this.resultEl.classList.add('ok', 'show')
      this.resultEl.textContent = `已成交：${last.side === 'buy' ? '买入' : '卖出'} ${fmtNum(last.qty, 0)} 股 @ ${fmtNum(last.fillPrice)} 元，费用 ${fmtMoney(last.fee)}`
      return
    }
    if (!state.isMarketOpen) {
      this.resultEl.classList.add('warn', 'show')
      this.resultEl.textContent = '今天该市场休市，无法下单。点「下一日（休市）」继续走日历。'
    }
  }
}
