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
    el('span', 'num', head, `${this.instruments.length} 只`)

    const list = el('div', 'watch-list', root)
    for (const inst of this.instruments) {
      const row = el('div', 'qrow', list)
      const l1 = el('div', 'l1', row)
      el('span', 'nm', l1, inst.name)
      const pct = el('span', 'pct num', l1, '—')
      const l2 = el('div', 'l2', row)
      el('span', '', l2, inst.code)
      const px = el('span', 'num', l2, '—')
      // 「1 手约 ¥XXX」列：派生值，不新增数据源
      const l3 = el('div', 'l3', row)
      const lot = el('span', 'lot num', l3, '—')
      const flag = el('span', 'lot-flag ch-hidden', l3, '')
      row.addEventListener('click', () => this.onSelect?.(inst.id))
      this._rows.set(inst.id, { row, pct, px, lot, flag })
    }
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
    for (const inst of this.instruments) {
      const view = this._rows.get(inst.id)
      if (!view) continue
      const q = quotes[inst.id]
      if (q) {
        setText(view.px, fmtNum(q.lastPrice))
        setText(view.pct, fmtPct(q.changePct))
        setDirClass(view.px, q.changeAbs)
        setDirClass(view.pct, q.changeAbs)
        this._renderLot(view, q, cash, lotLabel)
      }
      view.row.classList.toggle('sel', inst.id === state.selectedInstrumentId)
    }
  }

  /**
   * 「1 手约 ¥XXX」= 最新价 × 每手股数（PRD §3.4 修复 2，**不新增数据源**）。
   * 超资金只加视觉标记：行加 `over` 类、金额用拒单族色、末尾一行小字说明（PRD 修复 3）。
   */
  _renderLot(view, quote, cash, lotLabel) {
    const perLot = roundMoney(Number(quote.lastPrice) * LOT_SIZE)
    const cost = roundMoney(perLot + computeFee('A_SHARE', 'buy', perLot))
    const over = cash > 0 ? cost > cash : true
    setText(view.lot, `${lotLabel} ${fmtMoney(perLot)}`)
    view.lot.dataset.perLot = String(perLot)
    view.lot.classList.toggle('over', over)
    view.flag.classList.toggle('ch-hidden', !over)
    setText(view.flag, over ? OVER_FLAG : '')
    view.row.classList.toggle('over', over)
    view.row.dataset.affordable = over ? '0' : '1'
  }
}
