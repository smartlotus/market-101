/**
 * 视图层共享小工具 —— DOM 构建 + 数字格式化。
 *
 * plan.md 的 Scripts 表没有给这两个横切关注点指定归属文件，五个 View 都要用，
 * 因此单独抽出（否则同一份格式化会在 5 个视图里各抄一遍）。
 * 只做纯展示，不持有任何游戏状态。
 */

/** 建元素：el('div', 'cls', parent, '文字') */
export function el(tag, className = '', parent = null, text = '') {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== '' && text !== null && text !== undefined) node.textContent = String(text)
  if (parent) parent.appendChild(node)
  return node
}

/** 清空子节点 */
export function clear(node) {
  if (node) node.replaceChildren()
}

function group(intPart) {
  return String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 千分位小数：1234.5 -> "1,234.50" */
export function fmtNum(value, digits = 2) {
  const n = Number(value)
  const safe = Number.isFinite(n) ? n : 0
  const fixed = Math.abs(safe).toFixed(digits)
  const [int, frac] = fixed.split('.')
  return `${safe < 0 ? '-' : ''}${group(int)}${frac ? `.${frac}` : ''}`
}

/** 金额：1234.5 -> "¥1,234.50" */
export function fmtMoney(value, digits = 2) {
  return `¥${fmtNum(value, digits)}`
}

/** 带符号金额：1234.5 -> "+¥1,234.50" */
export function fmtSignedMoney(value, digits = 2) {
  const n = Number(value) || 0
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmtMoney(Math.abs(n), digits)}`
}

/** 比率 -> 百分比文本：0.0123 -> "+1.23%" */
export function fmtPct(ratio, digits = 2) {
  const n = Number(ratio) || 0
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${(Math.abs(n) * 100).toFixed(digits)}%`
}

/** 带符号数值文本：1.2 -> "+1.20" */
export function fmtSigned(value, digits = 2) {
  const n = Number(value) || 0
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmtNum(Math.abs(n), digits)}`
}

/** 涨跌方向 → CSS class（涨红 / 跌绿 / 平灰，全项目唯一映射） */
export function dirClass(value) {
  const n = Number(value) || 0
  if (n > 0) return 'dir-up'
  if (n < 0) return 'dir-down'
  return 'dir-flat'
}

/** 涨跌箭头：颜色之外的第二重方向信号（色觉障碍下仍可读） */
export function dirArrow(value) {
  const n = Number(value) || 0
  if (n > 0) return '▲ '
  if (n < 0) return '▼ '
  return ''
}

/** 给元素换涨跌方向 class（涨红 / 跌绿 / 平灰） */
export function setDirClass(node, value) {
  if (!node) return node
  node.classList.remove('dir-up', 'dir-down', 'dir-flat')
  node.classList.add(dirClass(value))
  return node
}

/** 只在值变化时写 DOM，避免无意义重排 */
export function setText(node, text) {
  if (!node) return
  const value = String(text)
  if (node.textContent !== value) node.textContent = value
}
