/**
 * ChapterOverlay —— 章节面板层的**唯一宿主 Node**，`extends GameOverlayModule`。
 *
 * 为什么是子类而不是自建：`dom-overlay-with-phaser-pause` 契约要求**两个时钟同时停**
 * （`sceneTree.running = false` **且** `scene.scene.pause()`）。模块把这两行焊在
 * `_pauseGame()` 里，本项目没有理由重写它 —— 本类只做两件事：
 *   1. **换皮**：模块的内联样式是开发占位（`modules/GameOverlayModule.js` 明确说「must not ship」），
 *      本类在 `_buildMenu()` 里给背板/面板加 `ch-scrim` / `ch-panel` 类，皮肤由
 *      `scripts/ui/chapter/theme.js` 提供（R9：保留骨架、换掉皮肤）。
 *   2. **换内容形状**：模块的面板形状是「标题 + 按钮」，章节面板是 `blocks[] + actions[]`。
 *      本类清掉模块的标题与按钮，重建「头部 / 内容宿主 / 动作宿主」三段，内容由
 *      `scripts/ui/chapter/PanelHost.js` 填。动作按钮一律来自数据里的 `actions[]`。
 *
 * 互斥（架构指南硬要求）：同刻只允许一个面板。`showPanel(next)` 在同一次同步调用内
 * 隐藏上一个面板并暂停两时钟，因此外部**观察不到** `sceneTree.running === true` 的中间态。
 * `hidePanel()` 只在「没有任何面板可见」时才恢复时钟，避免切换过程中把另一块面板留在屏上
 * （契约里列的常见错误：pausesGame 面板互相叠加时提前 resume）。
 *
 * config（由 `scenes/main.scene.json` 提供，见 plan.md「Initial Placement」）：
 *   menus: [
 *     { id: 'panel.deposit', title: '活期存单', kind: 'sceneCloseup',
 *       pausesGame: true, panelWidth?: 560, panelHeight?: 420, buttons: [] },
 *     ...
 *   ]
 *   style: { containerId: 'game-container', hurtFlashColor: '...' }
 *
 * 公开 API：
 *   showPanel(panelId) / hidePanel(panelId?) / hideAllPanels()
 *   getPanelBody(panelId) / getPanelFoot(panelId) / setPanelTitle(panelId, title)
 *   isPaused() / isPanelOpen(panelId?) / currentPanelId()
 *   syncFromRuntime(runtime)        —— 把 runtime.snapshot().panelId 投影到 DOM + 两时钟
 *   runtimeState()                  —— 模块的 visible 快照 + panelId / panelOpen / paused
 */

import GameOverlayModule from '/modules/GameOverlayModule.js'
import { CHAPTER_THEME_CSS } from './ui/chapter/theme.js'

const THEME_STYLE_ID = 'chapter-theme'
const DEFAULT_PANEL_WIDTH = 620
const DEFAULT_PANEL_HEIGHT = 470

export default class ChapterOverlay extends GameOverlayModule {
  ready() {
    this._currentPanelId = null
    this._injectTheme()
    super.ready()
    return this
  }

  /** 章节层样式由本类注入一次（`#chapter-root` 与 `.ch-panel` 两个作用域共用一套色板）。 */
  _injectTheme() {
    if (document.getElementById(THEME_STYLE_ID)) return null
    const styleEl = document.createElement('style')
    styleEl.id = THEME_STYLE_ID
    styleEl.textContent = CHAPTER_THEME_CSS
    document.head.appendChild(styleEl)
    this._styleEl = styleEl
    return styleEl
  }

  // === 面板骨架（换皮 + 换内容形状）===

  _buildMenu(menu) {
    const outer = super._buildMenu(menu) // 模块持有骨架：id / display:none / 居中 / z-index
    outer.classList.add('ch-scrim')
    outer.dataset.panelId = menu.id
    // 模块内联背景是纯黑 0.72；章节面板要一层轻微虚化，让人看出「下面真的停住了」
    outer.style.background = 'rgba(3, 5, 9, 0.74)'
    outer.style.backdropFilter = 'blur(2.5px)'

    const inner = outer.firstElementChild
    inner.classList.add('ch-panel')
    inner.dataset.panelId = menu.id
    inner.style.width = `${Number(menu.panelWidth) || DEFAULT_PANEL_WIDTH}px`
    inner.style.height = `${Number(menu.panelHeight) || DEFAULT_PANEL_HEIGHT}px`
    inner.style.maxWidth = '1240px'
    inner.style.maxHeight = '748px'
    // 项目没有注册 ui_panel（assets/manifest.json 只有 mentor_portrait / scene_bank），
    // 但万一外部 config 传了面板贴图，内联 background-image 会压过本类皮肤，故显式清掉。
    inner.style.backgroundImage = 'none'

    // 模块的「标题 + buttons」与面板内容形状不符 —— 内容与动作都交给 PanelHost（plan R9）
    inner.replaceChildren()

    const head = document.createElement('div')
    head.className = 'ch-phd'
    const title = document.createElement('div')
    title.className = 't'
    title.textContent = menu.title || ''
    head.appendChild(title)
    const kind = document.createElement('div')
    kind.className = 'kind'
    kind.textContent = menu.kind || ''
    head.appendChild(kind)
    const tag = document.createElement('div')
    tag.className = 'tag'
    tag.textContent = menu.tag || ''
    head.appendChild(tag)
    inner.appendChild(head)

    const body = document.createElement('div')
    body.className = 'ch-pbody'
    inner.appendChild(body)

    const foot = document.createElement('div')
    foot.className = 'ch-pfoot'
    inner.appendChild(foot)

    return outer
  }

  // === 面板宿主的只读视图 ===

  currentPanelId() {
    return this._currentPanelId
  }

  isPanelOpen(panelId = null) {
    return panelId ? this._currentPanelId === panelId : Boolean(this._currentPanelId)
  }

  /** 内容宿主（`blocks[]` 渲染进这里）。 */
  getPanelBody(panelId) {
    const entry = this._menuDivs?.get(panelId)
    return entry ? entry.div.querySelector('.ch-pbody') : null
  }

  /** 动作宿主（`actions[]` 渲染进这里，固定在面板底部）。 */
  getPanelFoot(panelId) {
    const entry = this._menuDivs?.get(panelId)
    return entry ? entry.div.querySelector('.ch-pfoot') : null
  }

  /** 面板标题的唯一来源是 `config/chapters.json` 的 `panels[id].title`（此处只做投影）。 */
  setPanelTitle(panelId, title) {
    const entry = this._menuDivs?.get(panelId)
    if (!entry) return null
    const el = entry.div.querySelector('.ch-phd .t')
    if (el && typeof title === 'string' && title) el.textContent = title
    return el
  }

  // === 真暂停 + 互斥 ===

  /**
   * 打开一个面板：真暂停两时钟。
   * 若已有别的面板打开，隐藏它 —— 与本次打开在**同一次同步调用**内完成（互斥）。
   */
  showPanel(panelId) {
    const entry = this._menuDivs?.get(panelId)
    if (!entry) {
      console.warn(`ChapterOverlay: unknown panel id '${panelId}'`)
      return null
    }
    const prev = this._currentPanelId
    if (prev && prev !== panelId) {
      const prevEntry = this._menuDivs.get(prev)
      if (prevEntry) {
        prevEntry.div.style.display = 'none'
        prevEntry.div.classList.remove('ch-open')
      }
    }
    entry.div.style.display = 'flex'
    entry.div.classList.add('ch-open')
    this._currentPanelId = panelId
    this._pauseGame() // 两时钟：sceneTree.running=false + scene.scene.pause()
    return panelId
  }

  /** 关闭面板；只在「这次真的关掉了一个可见面板」时才恢复时钟（互斥切换不提前恢复）。 */
  hidePanel(panelId = null) {
    const closing = panelId || this._currentPanelId
    if (!closing) return { ok: false, reason: 'no_panel' }
    const wasVisible = this._anyPanelVisible()
    const entry = this._menuDivs?.get(closing)
    if (entry) {
      entry.div.style.display = 'none'
      entry.div.classList.remove('ch-open')
    }
    if (this._currentPanelId === closing) this._currentPanelId = null
    // 只恢复「本类自己停掉的那次暂停」：本来就没有面板可见时不去动这两个时钟，
    // 避免把别的暂停来源（未来的暂停菜单等）一并恢复。
    if (wasVisible && !this._anyPanelVisible()) this._resumeGame()
    return { ok: true, panelId: closing, paused: this.isPaused() }
  }

  hideAllPanels() {
    for (const [id] of this._menuDivs) this.hidePanel(id)
    return this
  }

  _anyPanelVisible() {
    for (const [, entry] of this._menuDivs) {
      if (entry.div.style.display !== 'none') return true
    }
    return false
  }

  /** 两个时钟是否都停住了（契约的可断言口径）。 */
  isPaused() {
    const treeHalted = Boolean(this.sceneTree) && this.sceneTree.running === false
    let phaserPaused = false
    try {
      const phaserScene = this.scene && this.scene.scene
      phaserPaused = typeof phaserScene?.isPaused === 'function' ? phaserScene.isPaused() === true : false
    } catch {
      phaserPaused = false
    }
    return treeHalted && phaserPaused
  }

  // === 与 ChapterRuntime 的投影桥 ===

  /**
   * 把 `runtime.snapshot().panelId` 投影到 DOM：有面板 → 打开并真暂停；无面板 → 关闭并恢复。
   * 面板内容不在本类（那是 `PanelHost` 的职责），本类只保证「DOM 可见性 + 两时钟」一致。
   */
  syncFromRuntime(runtime) {
    const state = runtime && typeof runtime.snapshot === 'function' ? runtime.snapshot() : null
    const panelId = state ? state.panelId : null
    if (panelId) this.showPanel(panelId)
    else this.hidePanel()
    const paused = this.isPaused()
    runtime?.notePanelPause?.(paused)
    return { panelId, paused }
  }

  runtimeState() {
    const base = typeof super.runtimeState === 'function' ? super.runtimeState() : {}
    return {
      ...base,
      panelId: this._currentPanelId,
      panelOpen: Boolean(this._currentPanelId),
      paused: this.isPaused(),
    }
  }

  destroy() {
    this._currentPanelId = null
    super.destroy()
  }
}
