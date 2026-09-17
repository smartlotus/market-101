const chart = document.querySelector('#broker-shell .chart')
if (chart === null) return 'NO_CHART'
const box = chart.getBoundingClientRect()
const overflow = []
for (const el of chart.querySelectorAll('*')) {
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) continue
  const topOut = box.top - r.top
  const botOut = r.bottom - box.bottom
  if (topOut > 0.5 || botOut > 0.5) {
    overflow.push({ cls: el.className, topOut: +topOut.toFixed(1), botOut: +botOut.toFixed(1) })
  }
}
const labels = []
for (const el of chart.querySelectorAll('.chart-glabel')) {
  labels.push({ text: el.textContent, top: el.style.top })
}
return JSON.stringify({
  overflowCount: overflow.length,
  overflow,
  labelCount: labels.length,
  labels,
  chartSize: { w: +box.width.toFixed(1), h: +box.height.toFixed(1) },
})
