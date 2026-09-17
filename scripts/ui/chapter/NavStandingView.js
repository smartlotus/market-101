/**
 * NavStandingView —— 净值曲线 + 结业评定（PRD §6）。
 *
 * **净值曲线**：折线**全部由 DOM / CSS / SVG 绘制**（无 `<canvas>`、无 Phaser）。
 *   - 轴标签与数值**全是 DOM 文本**（左侧 y 轴刻度、下方 x 轴交易日刻度、参考线标签、
 *     图例里的最新值与起始线值）—— SVG 内部**不放任何文字**，只画网格、参考线与折线。
 *   - 必经**¥100,000 起始线**（金额取自运行时注入的初始本金，视图不写字面量）。
 *   - 数据源 = `sim.snapshot().navHistory`：**每推进一个交易日记一笔**，休市日 NAV 不变也记，
 *     因此折线在休市日**天然是平的** —— 本视图**不跳过、不插值、不抽样**（点序 = 采样序）。
 *   - **空数据 / 只有一个点**：只画参考线（一个点时就多画一个点），**不报错、不留空白**。
 *
 * **结业评定**：三档（优秀 / 良好 / 结业）**都是结业**，判定与公式全在
 * `scripts/chapter/standing.js`（纯函数模块）里；本视图只把 `graduationStanding` 摊开，
 * 逐项显示 `(NAV_final − Σ全部外来入金 − 初始本金) / 初始本金` 的代入值 ——
 * 「不得用结论掩盖算法」同样适用于结业评定。
 *
 * 三档**只**在证书上的一行字、导师的收场话、评级记录表的完整度上不同：本视图因此
 * **不读任何解锁字段**，也不改变任何内容与可玩性（评定是派生量，不写回任何东西）。
 * 结业**典礼场景与其美术是 Stage 5**，本视图只把「证书上的一行字 / 导师的收场话」显示出来，
 * 不建任何典礼画面（留缝）。
 */

import { clear, el, fmtMoney, fmtPct } from '../kit.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_W = 1000
const SVG_H = 260
/** 点数超过这个量级时只画抽样圆点（折线本身仍然画**全部**采样点，绝不跳过数据）。 */
const DOT_MAX = 200

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value))
  return node
}

const ICON_CLOSE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'

const FALLBACK_TITLE = '净值与结业评定'
const SPEAKER = '老周'

export default class NavStandingView {
  /**
   * @param {HTMLElement} root 常驻卡层的挂载点（本视图只借它找 `#chapter-root`，不放入口按钮）
   * @param {object}      ui   引擎 UiLayer
   * @param {object}      cfg  `{ runtime, chapters }`
   */
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null
    this.chapters = Array.isArray(cfg.chapters) ? cfg.chapters : (cfg.chapters && cfg.chapters.chapters) || []
    this._lastState = null
    this._signature = null

    const mountRoot = (root && root.closest && root.closest('#chapter-root')) || (ui && ui.root) || root
    this.panelEl = el('div', 'ch-dict ch-nav ch-hidden', mountRoot)
    this.panelEl.dataset.role = 'nav-standing'

    el('div', 'veil', this.panelEl)
    const sheet = el('div', 'sheet', this.panelEl)
    const head = el('div', 'hd', sheet)
    this.titleEl = el('div', 't', head, FALLBACK_TITLE)
    el('div', 'spacer', head)
    this.closeBtn = el('button', 'ch-btn ghost sm', head)
    this.closeBtn.type = 'button'
    this.closeBtn.innerHTML = ICON_CLOSE
    this.closeBtn.addEventListener('click', () => this.close())

    this.bodyEl = el('div', 'body nav-body', sheet)

    this.panelEl.addEventListener('click', (event) => {
      if (event.target === this.panelEl || event.target.classList.contains('veil')) this.close()
    })
  }

  // === 开关 ===

  isOpen() {
    return !this.panelEl.classList.contains('ch-hidden')
  }

  open() {
    this.panelEl.classList.remove('ch-hidden')
    if (this._lastState) this._render(this._lastState)
    return this
  }

  close() {
    this.panelEl.classList.add('ch-hidden')
    return this
  }

  toggle() {
    return this.isOpen() ? this.close() : this.open()
  }

  // === 渲染 ===

  update(state) {
    this._lastState = state
    if (!this.isOpen()) return
    this._render(state)
  }

  /** 采样序列 = `navHistory` 原样（点序 = 采样序；休市日那一笔重复值就是平的那一段）。 */
  _series(state) {
    const raw = Array.isArray(state.navHistory) ? state.navHistory : []
    return raw.map(Number).filter(Number.isFinite)
  }

  _render(state) {
    const ch = chapterOf(state)
    const copy = (ch.copy && ch.copy.standing) || {}
    // 免责声明按 plan 的落点放在**顶层** `copy.standingDisclaimer`（不在 `copy.standing` 子树里）
    const disclaimer = (ch.copy && ch.copy.standingDisclaimer) || ''
    const standing = ch.graduationStanding || null
    const series = this._series(state)

    const signature = [
      series.length,
      series.length ? series[series.length - 1] : '',
      series.length ? series[0] : '',
      standing ? standing.tier : '',
      standing ? standing.injectionsTotal : '',
      standing ? standing.gradedCount : '',
      standing ? standing.adjustedCumReturn : '',
    ].join('|')
    if (signature === this._signature) return
    this._signature = signature

    this.titleEl.textContent = copy.title || FALLBACK_TITLE
    clear(this.bodyEl)
    this._renderChart(copy, standing, series)
    this._renderStanding(copy, standing, disclaimer)
  }

  _section(title) {
    const sec = el('div', 'nav-sec', this.bodyEl)
    if (title) el('div', 'sec-hd', sec, String(title))
    return sec
  }

  // ---------------- 净值曲线（DOM/CSS/SVG，无 canvas）----------------

  _renderChart(copy, standing, series) {
    const sec = this._section(copy.navTitle)
    const ref = Number(standing && standing.initialCapital) || 0
    const n = series.length

    const values = ref > 0 ? series.concat([ref]) : series.slice()
    let min = values.length ? Math.min(...values) : 0
    let max = values.length ? Math.max(...values) : 0
    if (!(max > min)) {
      const pad = Math.abs(max) * 0.05 || 1
      min -= pad
      max += pad
    }
    const pad = (max - min) * 0.08
    min -= pad
    max += pad
    const yOf = (value) => SVG_H - ((value - min) / (max - min)) * SVG_H
    const xOf = (index) => (n <= 1 ? SVG_W / 2 : (index / (n - 1)) * SVG_W)

    const chart = el('div', 'navchart', sec)
    chart.dataset.role = 'nav-chart'
    chart.dataset.points = String(n)
    chart.dataset.reference = String(ref)
    if (copy.navSeriesLabel) chart.dataset.seriesLabel = String(copy.navSeriesLabel)
    if (n === 0) chart.dataset.empty = 'true'
    if (n === 1) chart.dataset.single = 'true'

    // y 轴刻度（DOM 文本）
    const yaxis = el('div', 'yaxis', chart)
    const yMax = el('span', 'y-max num', yaxis, fmtMoney(max))
    yMax.dataset.role = 'nav-y-max'
    const yMin = el('span', 'y-min num', yaxis, fmtMoney(min))
    yMin.dataset.role = 'nav-y-min'

    const plot = el('div', 'plot', chart)
    const svg = svgEl('svg', {
      class: 'svg',
      viewBox: `0 0 ${SVG_W} ${SVG_H}`,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
      focusable: 'false',
    })
    // 网格（三条水平线，纯装饰）
    for (const ratio of [0, 0.5, 1]) {
      svg.appendChild(
        svgEl('line', {
          class: 'grid',
          x1: 0,
          y1: ratio * SVG_H,
          x2: SVG_W,
          y2: ratio * SVG_H,
          'vector-effect': 'non-scaling-stroke',
        }),
      )
    }
    // **¥100,000 起始线**（金额来自注入的初始本金）
    if (ref > 0) {
      const refLine = svgEl('line', {
        class: 'refline',
        x1: 0,
        y1: yOf(ref),
        x2: SVG_W,
        y2: yOf(ref),
        'vector-effect': 'non-scaling-stroke',
      })
      refLine.dataset.role = 'nav-ref'
      svg.appendChild(refLine)
    }
    // 折线：**全部**采样点（含休市日那一段重复值 → 天然是平的），不插值、不跳过。
    // 只有一个采样点（刚开局）时**不画折线**（PRD Edge Case：一个点 + 起点参考线），只画那个点。
    if (n > 1) {
      const line = svgEl('polyline', {
        class: 'navline',
        points: series.map((value, index) => `${xOf(index)},${yOf(value)}`).join(' '),
        'vector-effect': 'non-scaling-stroke',
      })
      line.dataset.role = 'nav-polyline'
      line.dataset.points = String(n)
      svg.appendChild(line)
    }
    if (n > 0) {
      const step = n > DOT_MAX ? Math.ceil(n / DOT_MAX) : 1
      for (let index = 0; index < n; index += step) {
        const dot = svgEl('circle', { class: 'navdot', cx: xOf(index), cy: yOf(series[index]), r: 2.6 })
        dot.dataset.role = 'nav-dot'
        dot.dataset.index = String(index)
        svg.appendChild(dot)
      }
      // 末点始终画出来（抽样时也不能丢最新的那一笔）
      if (step > 1) {
        const last = svgEl('circle', { class: 'navdot last', cx: xOf(n - 1), cy: yOf(series[n - 1]), r: 3 })
        last.dataset.role = 'nav-dot'
        last.dataset.index = String(n - 1)
        svg.appendChild(last)
      }
    }
    plot.appendChild(svg)

    // 参考线标签（DOM 文本，含金额）
    if (ref > 0) {
      const refLabel = el('span', 'reflab', plot, `${fmtMoney(ref)}${copy.navRefLabel ? ` ${copy.navRefLabel}` : ''}`)
      refLabel.dataset.role = 'nav-ref-value'
      refLabel.style.top = `${Math.min(96, Math.max(0, (yOf(ref) / SVG_H) * 100))}%`
    }

    // x 轴刻度（DOM 文本，交易日序号；按采样序的百分比定位，与折线上的点对齐）
    const xaxis = el('div', 'xaxis', chart)
    if (copy.navXTicksLabel) el('span', 'x-key', xaxis, String(copy.navXTicksLabel))
    if (n > 0) {
      const tickIndexes = n === 1 ? [0] : Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]))
      tickIndexes.forEach((index, order) => {
        const tick = el('span', 'x-tick num', xaxis, String(index + 1))
        tick.dataset.role = order === 0 ? 'nav-x-first' : order === tickIndexes.length - 1 ? 'nav-x-last' : 'nav-x-mid'
        tick.dataset.index = String(index)
        tick.classList.add(order === 0 ? 'first' : order === tickIndexes.length - 1 ? 'last' : 'mid')
        tick.style.left = `${(xOf(index) / SVG_W) * 100}%`
      })
    }

    // 图例（DOM 文本）：折线名 / 最新值 / 起始线
    const legend = el('div', 'nav-legend', chart)
    const seriesKey = el('span', 'lg', legend)
    el('span', 'key nav', seriesKey)
    el('span', '', seriesKey, copy.navSeriesLabel || '')
    if (n > 0) {
      const latest = el('span', 'lg num', legend, `${fmtMoney(series[n - 1])}`)
      latest.dataset.role = 'nav-last-value'
    }
    const refKey = el('span', 'lg', legend)
    el('span', 'key ref', refKey)
    el('span', '', refKey, `${fmtMoney(ref)}${copy.navRefLabel ? ` ${copy.navRefLabel}` : ''}`)

    if (n === 0 && copy.navEmpty) {
      const empty = el('div', 'nav-empty', sec, String(copy.navEmpty))
      empty.dataset.role = 'nav-empty'
    }
    return chart
  }

  // ---------------- 结业评定（三档，全部是结业）----------------

  _chapterName(chapterId) {
    const found = this.chapters.find((c) => Number(c.id) === Number(chapterId))
    return found ? found.name || '' : ''
  }

  _renderStanding(copy, standing, disclaimer = '') {
    const sec = this._section(copy.tierTitle)
    const box = el('div', 'stand', sec)
    box.dataset.role = 'standing'
    if (!standing) {
      const none = el('div', 'nav-empty', box, '')
      none.dataset.role = 'standing-empty'
      return box
    }
    box.dataset.tier = standing.tier
    // 三档允许的差异之一（评级记录表完整度）**只在证书本身**上生效（典礼是 Stage 5）；
    // 本面板里的评级记录表一律完整，不因档位少给玩家看自己的记录。
    box.dataset.recordCompleteness = standing.recordCompleteness

    const tierLine = el('div', 'tier-line', box)
    const tier = el('div', 'tier', tierLine, standing.tier)
    tier.dataset.role = 'standing-tier'
    const rule = (copy.tierRules && copy.tierRules[standing.tier]) || ''
    if (rule) el('div', 'tier-rule', tierLine, String(rule))

    // 证书上的一行字 + 导师的收场话（三档差异之二、之三；典礼场景是 Stage 5）
    const cert = el('div', 'cert', box, String((copy.certificateLines && copy.certificateLines[standing.tier]) || ''))
    cert.dataset.role = 'standing-certificate'
    const closing = (copy.closingLines && copy.closingLines[standing.tier]) || ''
    if (closing) {
      const line = el('div', 'closing', box)
      el('span', 'who', line, SPEAKER)
      const said = el('span', 'said', line, String(closing))
      said.dataset.role = 'standing-closing'
    }

    // 公式逐项代入（不得用结论掩盖算法）
    const formula = el('div', 'formula', box)
    el('div', 'expr', formula, String(copy.formulaExpression || ''))
    const row = (label, valueText, role) => {
      const line = el('div', 'frow', formula)
      el('span', 'k', line, String(label || ''))
      const value = el('span', 'v num', line, valueText)
      if (role) value.dataset.role = role
      return value
    }
    row(copy.navFinalLabel || 'NAV_final', fmtMoney(standing.finalNav), 'standing-nav-final')
    row(copy.injectionsLabel || '', `− ${fmtMoney(standing.injectionsTotal)}`, 'standing-injections')
    row(copy.initialCapitalLabel || '', fmtMoney(standing.initialCapital), 'standing-initial-capital')
    const resultRow = el('div', 'frow result', formula)
    el('span', 'k', resultRow, String(copy.formulaLabel || ''))
    const result = el('span', 'v num', resultRow, fmtPct(standing.adjustedCumReturn))
    result.dataset.role = 'adjusted-cum-return'
    result.dataset.value = String(standing.adjustedCumReturn)
    result.classList.add(standing.adjustedCumReturn > 0 ? 'dir-up' : standing.adjustedCumReturn < 0 ? 'dir-down' : 'dir-flat')

    // 评级记录表：**只列已记录的章**（分母只数真实评过几次，从不写死）
    const grades = el('div', 'grades', box)
    grades.dataset.role = 'standing-grades'
    const head = el('div', 'g-hd', grades)
    el('span', 't', head, String(copy.gradesTitle || ''))
    el('span', 'n num', head, `${copy.gradedCountLabel || ''} ${standing.gradedCount} 次`)
    el(
      'span',
      'c num',
      head,
      String(copy.countsLabel || 'A {a} · B {b} · C {c} · D {d}')
        .replace('{a}', String(standing.countA))
        .replace('{b}', String(standing.countB))
        .replace('{c}', String(standing.countC))
        .replace('{d}', String(standing.countD)),
    )
    const rows = el('div', 'g-rows', grades)
    rows.dataset.count = String(standing.gradeRows.length)
    if (!standing.gradeRows.length) {
      const empty = el('div', 'g-empty', rows, String(copy.gradesEmpty || ''))
      empty.dataset.role = 'standing-grades-empty'
    }
    for (const grade of standing.gradeRows) {
      const line = el('div', 'g-row', rows)
      line.dataset.chapterId = String(grade.chapterId)
      line.dataset.grade = String(grade.grade)
      el('span', 'k', line, `第 ${grade.chapterId} 章`)
      el('span', 'nm', line, this._chapterName(grade.chapterId))
      el('span', 'g', line, grade.grade)
    }
    // 免责声明（GDD Realism vs Legibility #11：游戏内需在结业评定面板上明写）。
    // 文案是**数据里的一行**（顶层 `copy.standingDisclaimer`），视图不自己造句。
    if (disclaimer) {
      const note = el('div', 'disc', box, String(disclaimer))
      note.dataset.role = 'standing-disclaimer'
    }
    return box
  }

  destroy() {
    this.panelEl?.remove()
  }
}
