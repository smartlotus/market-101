/**
 * PositionsView —— 持仓表（PRD §2.5 / §3.5）。
 *
 * 标的 / 数量 / 成本价 / 现价 / 浮动盈亏 / 可卖·锁定。
 * `lockedQty > 0` 时明确标出「T+1 锁定」，让玩家看懂为什么今天卖不掉 ——
 * 这是 T+1 规则唯一的可视入口，不能只靠被拒单时才知道。
 */

import { clear, el, fmtMoney, fmtNum, fmtSignedMoney, setDirClass, setText } from './kit.js'

const COLUMNS = ['标的', '数量', '成本价', '现价', '浮动盈亏', '可用']

export default class PositionsView {
  constructor(root, ui, cfg = {}) {
    this.instruments = cfg.instruments || []
    this.byId = new Map(this.instruments.map((i) => [i.id, i]))

    const head = el('div', 'pos-head', root)
    this.countEl = el('span', 'title', head, '持仓 0 笔')
    this.realizedEl = this._sum(head, '累计已实现')
    this.unrealizedEl = this._sum(head, '浮动盈亏')
    this.feesEl = this._sum(head, '累计费用')

    const header = el('div', 'ptable hd', root)
    for (const name of COLUMNS) el('span', '', header, name)

    this.bodyEl = el('div', 'pos-body', root)
  }

  _sum(parent, label) {
    const wrap = el('span', 'sum', parent)
    wrap.appendChild(document.createTextNode(`${label} `))
    const value = el('b', '', wrap, '—')
    return value
  }

  update(state) {
    const positions = state.positions || []
    const quotes = state.quotes || {}

    setText(this.countEl, `持仓 ${positions.length} 笔`)
    setText(this.realizedEl, fmtSignedMoney(state.realizedPnL))
    setDirClass(this.realizedEl, state.realizedPnL)
    setText(this.unrealizedEl, fmtSignedMoney(state.unrealizedPnL))
    setDirClass(this.unrealizedEl, state.unrealizedPnL)
    setText(this.feesEl, fmtMoney(state.feesPaid))

    clear(this.bodyEl)
    if (positions.length === 0) {
      el('div', 'pos-empty', this.bodyEl, '暂无持仓 · 用右侧下单面板买入你的第一只股票。')
      return
    }

    for (const position of positions) {
      const inst = this.byId.get(position.instrumentId)
      const q = quotes[position.instrumentId]
      const row = el('div', 'ptable rw', this.bodyEl)

      const nameCell = el('span', 'nm', row)
      nameCell.appendChild(
        document.createTextNode(`${inst ? inst.name : position.instrumentId} `),
      )
      el('em', '', nameCell, position.instrumentId)

      el('span', '', row, `${fmtNum(position.qty, 0)} 股`)
      el('span', '', row, fmtNum(position.avgCost))
      const px = el('span', '', row, q ? fmtNum(q.lastPrice) : '—')
      if (q) setDirClass(px, q.changeAbs)

      const pnl = el('span', '', row, fmtSignedMoney(position.unrealizedPnL))
      setDirClass(pnl, position.unrealizedPnL)

      const available = position.qty - position.lockedQty
      const availCell = el('span', '', row, `${fmtNum(available, 0)} 股`)
      if (position.lockedQty > 0) {
        el('span', 'lock', availCell, ` · 锁定(T+1) ${fmtNum(position.lockedQty, 0)}`)
      }
    }
  }
}
