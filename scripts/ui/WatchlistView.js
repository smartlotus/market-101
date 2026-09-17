/**
 * WatchlistView —— 自选行情竖列（PRD §2.5 / §3.4）。
 *
 * 7 只标的各一行：名称 / 代码 / 最新价 / 涨跌幅 / 涨跌色；当前选中行高亮。
 * 点击某行即选中该标的（下单面板永远有目标 —— Edge Case「未选中标的」）。
 *
 * Stage 1 追加（PRD §3.4「修复已知缺陷的三条」2/3）：
 *   - 每行第三行显示 **「1 手约 ¥XXX」**：`最新价 × 每手股数` **派生**，不新增任何数据源；
 *   - 买不起的行把该金额标成「超出可用资金」：用拒单族色（`--reject`）**只做视觉强调**，
 *     不加禁用、不加遮罩（PRD R3）。判据与 `MarketSim.cheapestAffordableId()` /
 *     撮合的 `REJECT_1` 完全同一条：`1 手金额 + 手续费 > 可用资金`。
 *   - 默认高亮由运行时的 `selectCheapestAffordable()` 决定（`state.selectedInstrumentId`），
 *     本视图只做投影 —— 玩家手动点过的行不会被自动改回去（Edge Case 1.4 / R6）。
 */

import { LOT_SIZE, computeFee, roundMoney } from '../sim/fees.js'
import { el, fmtMoney, fmtNum, fmtPct, setDirClass, setText } from './kit.js'

/** 列标签来自本章数据（`beat.hints.lotCostColumnLabel`），此处只是缺省兜底。 */
const DEFAULT_LOT_LABEL = '1 手约'
const OVER_FLAG = '超出可用资金'

export default class WatchlistView {
  constructor(root, ui, cfg = {}) {
    this.instruments = cfg.instruments || []
    this.onSelect = null
    this.hints = cfg.hints || {}
    this._rows = new Map()

    const head = el('div', 'watch-head', root)
    el('span', '', head, '自选行情')
    this._countEl = el('span', 'num', head, `${this.instruments.length} 只`)

    this.list = el('div', 'watch-list', root)
    this._mounted = new Map() // instrumentId -> row（只含**已挂载**的行）
    this._rowSpec = new Map() // instrumentId -> { row, pct, px, lot, flag }（DOM 已建好，可能未挂载）

    // 行先全部建好但**不挂载**；由 `update()` 按已解锁市场决定挂谁、卸谁。
    // 不挂 = 不在 DOM 里 —— 不是置灰、不是隐藏（既不违反 R3，也不会被测试的行数统计数到）。
    for (const inst of this.instruments) this._buildRow(inst)
  }

  _buildRow(inst) {
    const row = el('div', 'qrow', null)
    row.dataset.instrumentId = inst.id
    const l1 = el('div', 'l1', row)
    el('span', 'nm', l1, inst.name)
    const pct = el('span', 'pct num', l1, '—')
    const l2 = el('div', 'l2', row)
    el('span', '', l2, inst.code)
    const px = el('span', 'num', l2, '—')
    const l3 = el('div', 'l3', row)
    const lot = el('span', 'lot num', l3, '—')
    const flag = el('span', 'lot-flag ch-hidden', l3, '')
    row.addEventListener('click', () => this.onSelect?.(inst.id))
    this._rowSpec.set(inst.id, { row, pct, px, lot, flag })
    return row
  }

  /**
   * 按已解锁市场挂载/卸载行。**未解锁的品种不出现在自选里**（逐层放出，避免信息过载），
   * 而不是「列出来但禁用」。
   */
  _syncUnlocked(unlockedMarkets) {
    if (!Array.isArray(unlockedMarkets)) return
    for (const inst of this.instruments) {
      const market = inst.market || 'A_SHARE'
      const should = unlockedMarkets.includes(market)
      const has = this._mounted.has(inst.id)
      const spec = this._rowSpec.get(inst.id)
      if (!spec) continue
      if (should && !has) {
        this.list.appendChild(spec.row)
        this._mounted.set(inst.id, spec.row)
      } else if (!should && has) {
        spec.row.remove()
        this._mounted.delete(inst.id)
      }
    }
    if (this._countEl) this._countEl.textContent = `${this._mounted.size} 只`
  }

  /** 本章节拍声明的列标签 / 提示文案（由宿主从 `config/chapters.json` 取来）。 */
  setHints(hints) {
    this.hints = hints && typeof hints === 'object' ? hints : {}
    return this.hints
  }

  update(state) {
    const quotes = state.quotes || {}
    const cash = Number(state.cash) || 0
    const lotLabel = this.hints.lotCostColumnLabel || DEFAULT_LOT_LABEL
    // 只展示**已解锁**的市场：未解锁的品种不挂进 DOM（逐层放出，避免信息过载）。
    this._syncUnlocked(Array.isArray(state.unlockedMarkets) ? state.unlockedMarkets : null)
    for (const inst of this.instruments) {
      const view = this._rowSpec.get(inst.id)
      if (!view) continue
      if (!this._mounted.has(inst.id)) continue // 未挂载的行不必更新
      const q = quotes[inst.id]
      if (q) {
        setText(view.px, fmtNum(q.lastPrice))
        setText(view.pct, fmtPct(q.changePct))
        setDirClass(view.px, q.changeAbs)
        setDirClass(view.pct, q.changeAbs)
        this._renderLot(view, inst, q, cash, lotLabel)
      }
      view.row.classList.toggle('sel', inst.id === state.selectedInstrumentId)
    }
  }

  /**
   * 「1 手约 ¥XXX」= 最新价 × **该市场该标的的每手股数**（PRD §3.4 修复 2，**不新增数据源**）。
   * 不能对所有标的套用 A 股的 100 股：港股小米 1 手 200 股、美股 1 股起、基金/加密按金额。
   * 超资金只加视觉标记：行加 `over` 类、金额用拒单族色、末尾一行小字说明（PRD 修复 3）。
   */
  _renderLot(view, inst, quote, cash, lotLabel) {
    const market = (quote && quote.market) || inst.market || 'A_SHARE'
    const currency = (quote && quote.currency) || inst.currency || 'CNY'
    const lot = inst.lotSize === null || inst.lotSize === undefined ? null : Number(inst.lotSize) || 1
    const unit = lot === null ? 1 : lot // 按金额下单的市场用 1 份作参考
    const perLot = roundMoney(Number(quote.lastPrice) * unit)
    const fee = computeFee(market, 'buy', perLot)
    const cost = roundMoney(perLot + fee)
    const over = cash > 0 ? cost > cash : true
    const suffix = currency === 'CNY' ? '' : currency === 'HKD' ? ' HK$' : currency === 'USD' ? ' $' : ''
    setText(view.lot, `${lotLabel} ${fmtMoney(perLot)}${suffix}`)
    view.lot.dataset.perLot = String(perLot)
    view.lot.classList.toggle('over', over)
    view.flag.classList.toggle('ch-hidden', !over)
    setText(view.flag, over ? OVER_FLAG : '')
    view.row.classList.toggle('over', over)
    view.row.dataset.affordable = over ? '0' : '1'
  }
}
