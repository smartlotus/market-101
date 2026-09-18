/**
 * 概念徽章 —— 概念 key 到 SVG 的映射与渲染（美术链 L3：纯几何件，手写 SVG）。
 *
 * **为什么不进 `assets/manifest.json`**：引擎资产表只接受
 * `image / spritesheet / atlas / tileset`，`svg` 不是合法类型（写进去 `vibegame check` 会 FAILED）。
 * SVG 走 DOM 引用（`<img src="assets/concepts/xxx.svg">`），不进 Phaser 资产表。
 * 同理：**文字与数字永远不用图** —— 徽章里没有任何可读文字，概念名一律由代码绘制。
 *
 * 无对应徽章的概念返回 `null`，视图照常渲染（不占位、不吞信息）：
 * 徽章是装饰层，**没有它不影响任何教学内容的呈现**。
 */

/** 概念 key → 徽章文件名（不含扩展名）。未列出的概念没有徽章。 */
export const BADGE_BY_CONCEPT = {
  杠杆: 'badge_leverage',
  复利: 'badge_compound',
  利滚利: 'badge_compound',
  分散投资: 'badge_diversify',
  资产配置: 'badge_diversify',
  分散: 'badge_diversify',
  流动性: 'badge_liquidity',
  汇率: 'badge_fx',
  计价货币: 'badge_fx',
  时间价值: 'badge_timevalue',
  时间价值衰减: 'badge_timevalue',
}

/** 徽章文件的基准目录（相对页面根）。 */
const BADGE_DIR = 'assets/concepts'

/**
 * 取概念对应的徽章 URL；没有则返回 null。
 * @param {string} conceptKey
 * @returns {string|null}
 */
export function badgeUrl(conceptKey) {
  const name = BADGE_BY_CONCEPT[String(conceptKey || '')]
  return name ? `${BADGE_DIR}/${name}.svg` : null
}

/**
 * 创建一个徽章元素；该概念没有徽章时返回 null（调用方自行决定是否占位）。
 * @param {string} conceptKey
 * @param {string} cls 附加的类名（尺寸由 CSS 控制）
 * @returns {HTMLImageElement|null}
 */
export function badgeEl(conceptKey, cls = '') {
  const url = badgeUrl(conceptKey)
  if (!url) return null
  const img = document.createElement('img')
  img.className = ['ch-badge', cls].filter(Boolean).join(' ')
  img.src = url
  img.alt = '' // 装饰性图形：不进无障碍朗读（概念名由代码绘制的文字承担）
  img.draggable = false
  // 加载失败时把元素移出文档流，避免留下破图占位
  img.addEventListener('error', () => { img.remove() })
  return img
}
