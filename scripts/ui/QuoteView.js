/**
 * QuoteView —— 行情主区（PRD §2.5 / §3.1）。
 *
 * 内容：选中标的表头（板块 / 涨跌停 / T+1 标识）+ 最新价与涨跌额涨跌幅 + **日 K 线图** + 当日新闻卡。
 *
 * K 线图是**纯 DOM/CSS 蜡烛**（architect 决策 D1）：每根 = 一个 div（影线 div + 实体 div），
 * 涨跌用 class `dir-up` / `dir-down` 上色，价格轴刻度与最新价都是叠加的 DOM 文本。
 * 不使用 <canvas>、不使用 Phaser，满足 `Phaser.Text` 禁令与 `dom-css-digit-hud` 契约。
 */

import { LOT_SIZE } from '../sim/fees.js'
import { QUOTE_PARAMS } from '../sim/quote.js'
import { eventTargetsInstrument } from '../sim/eventDeck.js'
import { clear, dirClass, el, fmtNum, fmtPct, fmtSigned, setDirClass, setText } from './kit.js'

const TYPE_LABELS = {
  COMPANY: '公司',
  INDUSTRY: '行业',
  MACRO: '宏观',
  POLICY: '政策',
  BLACK_SWAN: '黑天鹅',
}
const SENTIMENT_LABELS = { GOOD: '利好', BAD: '利空', NEUTRAL: '中性' }
const SENTIMENT_SIGN = { GOOD: 1, BAD: -1, NEUTRAL: 0 }

const GRID_STEPS = 3

function pct(ratio, digits = 2) {
  return `${(Number(ratio) * 100).toFixed(digits)}%`
}

export default class QuoteView {
  constructor(root, ui, cfg = {}) {
    this.instruments = cfg.instruments || []
    this.byId = new Map(this.instruments.map((i) => [i.id, i]))
    this.klinesFor = cfg.klinesFor || (() => [])
    this.params = cfg.params || QUOTE_PARAMS.A_SHARE
    this.maxBars = cfg.maxBars || 40

    // --- 表头 ---
    const head = el('div', 'mid-head', root)
    this.nameEl = el('span', 'mid-name', head, '—')
    this.subEl = el('span', 'mid-sub', head, '')

    // --- 价格行 ---
    const priceRow = el('div', 'mid-price', root)
    this.pxEl = el('span', 'px num', priceRow, '—')
    this.chgAbsEl = el('span', 'chg num', priceRow, '—')
    this.chgPctEl = el('span', 'chg num', priceRow, '—')
    this.rangeEl = el('span', 'range', priceRow, '')

    // --- K 线 ---
    this.chartEl = el('div', 'chart', root)
    el('div', 'chart-caption', this.chartEl, '日K')
    this.plotEl = el('div', 'chart-plot', this.chartEl)
    this.gutterEl = el('div', 'chart-gutter', this.chartEl)
    this.emptyEl = el('div', 'chart-empty', this.chartEl, '暂无足够的 K 线数据')
    this.emptyEl.style.display = 'none'

    // --- 新闻卡 ---
    this.newsEl = el('div', 'news', root)
    const newsHead = el('div', 'news-head', this.newsEl)
    this.newsTag = el('span', 'news-tag', newsHead, '新闻')
    this.newsTitle = el('span', 'news-title', newsHead, '')
    this.newsWhy = el('div', 'news-why', this.newsEl)
    this.newsMentor = el('div', 'news-mentor', this.newsEl)
  }

  update(state) {
    const inst = this.byId.get(state.selectedInstrumentId) || this.instruments[0]
    if (!inst) return
    const q = (state.quotes || {})[inst.id]
    if (!q) return

    setText(this.nameEl, inst.name)
    setText(
      this.subEl,
      `${inst.code} · ${inst.board} · T+1（今日买入明日起可卖） · ${LOT_SIZE} 股/手 · 涨跌幅限制 ±${(inst.limitPct * 100).toFixed(0)}%`,
    )

    setText(this.pxEl, fmtNum(q.lastPrice))
    setText(this.chgAbsEl, fmtSigned(q.changeAbs))
    setText(this.chgPctEl, fmtPct(q.changePct))
    setDirClass(this.pxEl, q.changeAbs)
    setDirClass(this.chgAbsEl, q.changeAbs)
    setDirClass(this.chgPctEl, q.changeAbs)
    setText(
      this.rangeEl,
      `今日区间 ${fmtNum(q.low)} – ${fmtNum(q.high)} · 涨停 ${fmtNum(q.limitUp)} / 跌停 ${fmtNum(q.limitDown)}`,
    )

    this._renderChart(inst, q)
    this._renderNews(state, inst, q)
  }

  // === K 线 ===

  _renderChart(inst, q) {
    const bars = this.klinesFor(inst.id).slice(-this.maxBars)
    clear(this.plotEl)
    clear(this.gutterEl)

    if (bars.length < 2) {
      // 理论不可达（已预生成 30 根历史 K），仍给空状态文案而非报错
      this.emptyEl.style.display = 'flex'
      return
    }
    this.emptyEl.style.display = 'none'

    let hi = -Infinity
    let lo = Infinity
    for (const bar of bars) {
      if (bar.high > hi) hi = bar.high
      if (bar.low < lo) lo = bar.low
    }
    const span = hi - lo
    const pad = span > 0 ? span * 0.06 : Math.max(hi * 0.01, 1)
    const top = hi + pad
    const bottom = lo - pad
    // 端点刻度自身带 translateY(-50%)，若 value 映射到 0%/100% 会被 .chart 的
    // overflow:hidden 裁掉半个字高（价格轴是教学内容，不能裁）。故把整条绘图带
    // 上下各内缩 INSET%。网格线、蜡烛、最新价线全部共用 yPct，内缩后仍严格对齐。
    const INSET = 6
    const yPct = (value) => {
      const raw = ((top - value) / (top - bottom)) * 100
      return INSET + (raw * (100 - 2 * INSET)) / 100
    }

    // 横向参考线 + 右侧价格轴刻度（叠加 DOM 文本，不是 canvas）
    for (let i = 0; i < GRID_STEPS; i++) {
      const value = bottom + ((top - bottom) * i) / (GRID_STEPS - 1)
      const at = `${yPct(value).toFixed(2)}%`
      el('div', 'chart-gridline', this.plotEl).style.top = at
      el('div', 'chart-glabel', this.gutterEl, fmtNum(value)).style.top = at
    }

    // 蜡烛：影线 + 实体，涨红跌绿由 CSS class 决定
    const slot = 100 / bars.length
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i]
      const dir = bar.close > bar.open ? 'dir-up' : bar.close < bar.open ? 'dir-down' : 'dir-flat'
      const candle = el('div', `k-candle ${dir}`, this.plotEl)
      candle.style.left = `${(slot * (i + 0.5)).toFixed(3)}%`
      candle.style.width = `${slot.toFixed(3)}%`

      const wickTop = yPct(bar.high)
      const wick = el('div', 'k-wick', candle)
      wick.style.top = `${wickTop.toFixed(2)}%`
      wick.style.height = `${Math.max(0.6, yPct(bar.low) - wickTop).toFixed(2)}%`

      const bodyTop = yPct(Math.max(bar.open, bar.close))
      const body = el('div', 'k-body', candle)
      body.style.top = `${bodyTop.toFixed(2)}%`
      body.style.height = `${Math.max(0.6, yPct(Math.min(bar.open, bar.close)) - bodyTop).toFixed(2)}%`
    }

    // 最新价参考线 + 价格标签
    const lastAt = `${yPct(q.lastPrice).toFixed(2)}%`
    const dir = dirClass(q.changeAbs)
    el('div', `chart-lastline ${dir}`, this.plotEl).style.top = lastAt
    el('div', `chart-lastlabel num ${dir}`, this.gutterEl, fmtNum(q.lastPrice)).style.top = lastAt
  }

  // === 新闻卡 ===

  _renderNews(state, inst, q) {
    const event = state.currentEvent
    if (!event) {
      setText(this.newsTag, state.isMarketOpen ? '新闻 · 无' : '休市')
      setText(this.newsTitle, state.isMarketOpen ? '今日没有新的新闻' : '今日休市，行情冻结')
      setText(
        this.newsWhy,
        state.isMarketOpen
          ? '没有新闻的日子，价格只随市场杂波小幅波动 —— 这才是大多数交易日的常态。'
          : '周末不交易：价格停在上一个交易日的收盘价，持仓也不重估。点「下一日（休市）」继续走日历。',
      )
      this.newsMentor.style.display = 'none'
      clear(this.newsMentor)
      return
    }

    setText(this.newsTag, `新闻 · ${TYPE_LABELS[event.type] || event.type}`)
    setText(this.newsTitle, event.headline)
    this.newsWhy.replaceChildren(...this._whyNodes(inst, q, event))
    this.newsMentor.style.display = ''
    clear(this.newsMentor)
    el('span', 'who', this.newsMentor, '周老师：')
    this.newsMentor.appendChild(document.createTextNode(event.mentorLine || ''))
  }

  /** 「为什么价格会动」：把当日公式拆给玩家看（信息透明，绝不藏随机） */
  _whyNodes(inst, q, event) {
    const { drift, scale, noiseRange } = this.params
    // 是否全场事件一律由 sim 层判定（哨兵字面量与展开逻辑只在 scripts/sim/eventDeck.js）
    const affected = eventTargetsInstrument(event, inst.id)
    const text = (value) => document.createTextNode(value)
    const emphasis = (value) => el('b', dirClass(value), null, fmtPct(value))

    if (!affected) {
      return [
        text(
          `这条新闻不涉及 ${inst.name}，它的价格只随长期偏置 +${pct(drift)} 与市场杂波（±${pct(noiseRange, 1)}）微幅波动 → 今日收盘 `,
        ),
        emphasis(q.changePct),
        text('。'),
      ]
    }

    const sign = SENTIMENT_SIGN[event.sentiment] ?? 0
    const magnitude = Number(event.magnitude) || 0
    const eventMove = drift + sign * magnitude * scale
    const signText = SENTIMENT_LABELS[event.sentiment] || event.sentiment

    return [
      text(
        `${signText} × 强度 ${magnitude.toFixed(2)} × 单事件最大冲击 ±${pct(scale, 1)} = 当日净驱动 `,
      ),
      el('b', '', null, `${fmtSigned(eventMove * 100, 2)}%`),
      text(`；再叠加市场杂波（±${pct(noiseRange, 1)}）→ ${inst.name} 今日收盘 `),
      emphasis(q.changePct),
      text('。这条消息已经被价格算进去了 —— 你现在要判断的是「这个价格值不值得买卖」。'),
    ]
  }
}
