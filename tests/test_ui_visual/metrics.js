/**
 * DOM 度量：把「视觉声明」变成可断言的数字。
 *
 * plan.md 把「布局可读性 / K 线形态 / 导师长文案 / 涨跌配色」列为 Untestable（需人眼），
 * 这里把其中**可度量的部分**自动化：五区域存在性、立绘真实加载、蜡烛数量与方向色、
 * 各面板的内容溢出（scrollHeight/scrollWidth vs client/client）、以及关键元素是否
 * 落在其所属面板的矩形内。截图仍由 test.sh 采集，供 reviewer 目视判断。
 *
 * 每次调用重新读取实时 DOM —— 前置的 step 脚本已通过 Runtime 钩子改过状态。
 */
const shell = document.getElementById('broker-shell')
const q = (s) => document.querySelector(s)

const boxOf = (sel) => {
  const e = q(sel)
  if (!e) return null
  const r = e.getBoundingClientRect()
  return {
    sel,
    x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
    clientW: e.clientWidth, clientH: e.clientHeight,
    scrollW: e.scrollWidth, scrollH: e.scrollHeight,
    overflowX: e.scrollWidth - e.clientWidth,
    overflowY: e.scrollHeight - e.clientHeight,
    visible: r.width > 0 && r.height > 0,
  }
}

const contained = (innerSel, outerSel) => {
  const i = q(innerSel), o = q(outerSel)
  if (!i || !o) return { inner: innerSel, outer: outerSel, present: false }
  const a = i.getBoundingClientRect(), b = o.getBoundingClientRect()
  const visible = a.width > 0 && a.height > 0
  return {
    inner: innerSel,
    outer: outerSel,
    present: true,
    visible,
    ok: !visible || (a.top >= b.top - 0.6 && a.bottom <= b.bottom + 0.6 && a.left >= b.left - 0.6 && a.right <= b.right + 0.6),
    innerTop: a.top, innerBottom: a.bottom, innerLeft: a.left, innerRight: a.right,
    outerTop: b.top, outerBottom: b.bottom, outerLeft: b.left, outerRight: b.right,
  }
}

const bg = (sel) => {
  const e = q(sel)
  return e ? getComputedStyle(e).backgroundColor : null
}

/** 面板内所有「矩形越出面板矩形」的后代（>0.5px），用于区分真溢出与已知的标签居中越界。
 *  刻意排除位于「自身可滚动祖先」（overflow auto/scroll，如 .watch-list / .pos-body）内的元素
 *  —— 那些越界是设计上的滚动，不是布局缺陷。 */
const overhangOf = (panelSel) => {
  const panel = q(panelSel)
  if (!panel) return []
  const inScrollable = (el) => {
    let p = el.parentElement
    while (p && p !== panel) {
      const cs = getComputedStyle(p)
      if (['auto', 'scroll'].includes(cs.overflowY) || ['auto', 'scroll'].includes(cs.overflowX)) return true
      p = p.parentElement
    }
    return false
  }
  const pr = panel.getBoundingClientRect()
  const out = []
  for (const child of panel.querySelectorAll('*')) {
    const r = child.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    if (inScrollable(child)) continue
    const dyTop = pr.top - r.top
    const dyBottom = r.bottom - pr.bottom
    const dxLeft = pr.left - r.left
    const dxRight = r.right - pr.right
    const worst = Math.max(dyTop, dyBottom, dxLeft, dxRight)
    if (worst > 0.5) {
      out.push({
        cls: String(child.className || child.tagName),
        top: +dyTop.toFixed(2),
        bottom: +dyBottom.toFixed(2),
        left: +dxLeft.toFixed(2),
        right: +dxRight.toFixed(2),
        worst: +worst.toFixed(2),
      })
    }
  }
  return out
}

const count = (sel) => document.querySelectorAll(sel).length

const candles = [...document.querySelectorAll('#broker-shell .k-candle')]
const lastCandleEl = candles[candles.length - 1]
const lastCandle = lastCandleEl
  ? {
      cls: lastCandleEl.className,
      left: lastCandleEl.style.left,
      width: lastCandleEl.style.width,
      bodyColor: (() => {
        const b = lastCandleEl.querySelector('.k-body')
        return b ? getComputedStyle(b).backgroundColor : null
      })(),
      wickColor: (() => {
        const w = lastCandleEl.querySelector('.k-wick')
        return w ? getComputedStyle(w).backgroundColor : null
      })(),
      bodyHeight: (() => {
        const b = lastCandleEl.querySelector('.k-body')
        return b ? b.getBoundingClientRect().height : null
      })(),
    }
  : null

const say = q('#broker-shell .mentor .say')
const newsMentor = q('#broker-shell .news-mentor')
const portrait = q('#broker-shell .mentor .portrait')
const submit = q('#broker-shell .ticket .submit')
const result = q('#broker-shell .ticket .result')
const halt = q('#broker-shell .topbar .badge.halt')
const cta = q('#broker-shell .topbar .cta')

return {
  viewport: { w: window.innerWidth, h: window.innerHeight },
  shell: boxOf('#broker-shell'),
  docScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
  regions: {
    topbar: count('#broker-shell .topbar'),
    watch: count('#broker-shell .watch'),
    mid: count('#broker-shell .mid'),
    ticket: count('#broker-shell .ticket'),
    positions: count('#broker-shell .positions'),
    mentor: count('#broker-shell .mentor'),
  },
  panels: [
    '#broker-shell .topbar',
    '#broker-shell .watch',
    '#broker-shell .mid',
    '#broker-shell .ticket',
    '#broker-shell .positions',
    '#broker-shell .mentor',
    '#broker-shell .chart',
    '#broker-shell .news',
  ].map(boxOf),
  overhang: {
    '#broker-shell .topbar': overhangOf('#broker-shell .topbar'),
    '#broker-shell .watch': overhangOf('#broker-shell .watch'),
    '#broker-shell .mid': overhangOf('#broker-shell .mid'),
    '#broker-shell .ticket': overhangOf('#broker-shell .ticket'),
    '#broker-shell .positions': overhangOf('#broker-shell .positions'),
    '#broker-shell .mentor': overhangOf('#broker-shell .mentor'),
    '#broker-shell .chart': overhangOf('#broker-shell .chart'),
    '#broker-shell .news': overhangOf('#broker-shell .news'),
  },
  containment: [
    contained('#broker-shell .mid-head', '#broker-shell .mid'),
    contained('#broker-shell .mid-price', '#broker-shell .mid'),
    contained('#broker-shell .chart', '#broker-shell .mid'),
    contained('#broker-shell .news', '#broker-shell .mid'),
    contained('#broker-shell .news-head', '#broker-shell .news'),
    contained('#broker-shell .news-why', '#broker-shell .news'),
    contained('#broker-shell .news-mentor', '#broker-shell .news'),
    contained('#broker-shell .mentor .portrait', '#broker-shell .mentor'),
    contained('#broker-shell .mentor .who', '#broker-shell .mentor'),
    contained('#broker-shell .mentor .say', '#broker-shell .mentor'),
    contained('#broker-shell .mentor .foot', '#broker-shell .mentor'),
    contained('#broker-shell .ticket .submit', '#broker-shell .ticket'),
    contained('#broker-shell .topbar .cta', '#broker-shell .topbar'),
  ],
  watch: { rows: count('#broker-shell .qrow'), selected: count('#broker-shell .qrow.sel') },
  chart: {
    candles: count('#broker-shell .k-candle'),
    up: count('#broker-shell .k-candle.dir-up'),
    down: count('#broker-shell .k-candle.dir-down'),
    flat: count('#broker-shell .k-candle.dir-flat'),
    wicks: count('#broker-shell .k-wick'),
    bodies: count('#broker-shell .k-body'),
    gridlines: count('#broker-shell .chart-gridline'),
    glabels: count('#broker-shell .chart-glabel'),
    lastline: count('#broker-shell .chart-lastline'),
    lastlabel: count('#broker-shell .chart-lastlabel'),
    emptyVisible: (() => { const e = q('#broker-shell .chart-empty'); return e ? getComputedStyle(e).display !== 'none' : false })(),
    upBodyColor: bg('#broker-shell .k-candle.dir-up .k-body'),
    downBodyColor: bg('#broker-shell .k-candle.dir-down .k-body'),
    lastCandle,
  },
  directionVars: shell
    ? {
        up: getComputedStyle(shell).getPropertyValue('--up').trim(),
        down: getComputedStyle(shell).getPropertyValue('--down').trim(),
      }
    : null,
  portrait: portrait
    ? {
        complete: portrait.complete,
        naturalWidth: portrait.naturalWidth,
        naturalHeight: portrait.naturalHeight,
        currentSrc: portrait.currentSrc || portrait.src,
        // 渲染尺寸取 border-box（CSS 是 100×128 含 1px 边框；clientWidth 会减掉边框）
        w: portrait.getBoundingClientRect().width,
        h: portrait.getBoundingClientRect().height,
        clientW: portrait.clientWidth,
        clientH: portrait.clientHeight,
      }
    : null,
  mentorSay: say ? { text: say.textContent, len: say.textContent.length } : null,
  news: {
    tag: (q('#broker-shell .news-tag') || {}).textContent,
    title: (q('#broker-shell .news-title') || {}).textContent,
    why: (q('#broker-shell .news-why') || {}).textContent,
    mentor: newsMentor ? { text: newsMentor.textContent, display: getComputedStyle(newsMentor).display } : null,
  },
  topbar: {
    brand: (q('#broker-shell .topbar .brand') || {}).textContent,
    meta: (q('#broker-shell .topbar .meta') || {}).textContent,
    nav: (q('#broker-shell .topbar .stat .v') || {}).textContent,
    haltVisible: halt ? getComputedStyle(halt).display !== 'none' : null,
    ctaText: cta ? cta.textContent : null,
    ctaDisabled: cta ? cta.disabled : null,
    resetText: (q('#broker-shell .topbar .ghost') || {}).textContent,
  },
  ticket: {
    priceMode: (q('#broker-shell .ticket .seg.small button.on') || {}).textContent,
    side: (q('#broker-shell .ticket .seg:not(.small) button.on') || {}).textContent,
    submitText: submit ? submit.textContent : null,
    submitDisabled: submit ? submit.disabled : null,
    submitBg: submit ? getComputedStyle(submit).backgroundColor : null,
    hint: (q('#broker-shell .ticket .hint') || {}).textContent,
    kbKeys: [...document.querySelectorAll('#broker-shell .ticket .kv')].map((e) => e.textContent),
    result: result
      ? { text: result.textContent, cls: result.className, color: getComputedStyle(result).color, display: getComputedStyle(result).display }
      : null,
  },
  positions: {
    headRows: count('#broker-shell .ptable.hd'),
    dataRows: count('#broker-shell .ptable.rw'),
    emptyVisible: (() => { const e = q('#broker-shell .pos-empty'); return e ? getComputedStyle(e).display !== 'none' : false })(),
    text: (q('#broker-shell .positions') || {}).textContent,
  },
}
