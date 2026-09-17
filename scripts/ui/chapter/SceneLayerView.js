/**
 * SceneLayerView —— 场景层：数据声明的场景底 + 场景内可点物件。
 *
 * 资产路线（plan 关键技术决策 / R7、架构指南硬规则 5）：**manifest key 优先、代码绘制兜底**。
 *   - `beat.sceneImageKey` 存在 → `ui.setImage()` 用已注册的真实素材（今天 `scene_bank` 已注册）；
 *   - key 缺省或解析失败 → 用 CSS 绘制场景底（今天 `config/chapters.json` 的 `sceneImageKey` 全是
 *     `null`，所以实际走代码绘制这一路）。位图到位后只改 config，本文件不动。
 *
 * 场景内可点物件**完全由数据派生**：本拍 `require[]` 里 `kind === 'interact'` 且带 `opensPanel`
 * 的条目就是「场景里能点的东西」（1.1 的 活期存单 = `{id:'1.1.openDeposit', opensPanel:'panel.deposit'}`）。
 * 点击 → `runtime.chapterAck(requireId)`，打开面板这件事由运行时数据里的 `opensPanel` 决定，
 * 视图不自己调 `openPanel` —— 于是 DOM 点击与 `eval` 钩子走的是同一条路径。
 *
 * 位置：数据没有给坐标，因此位置由本视图按「第 n 个物件」的固定锚点给出（视图自己的排版，
 * 不是新 schema）。第一个物件落在画面中央 —— 与 PRD §3.4 节拍 1「屏幕中央一张活期存单近景」一致。
 *
 * 不做的事：不因为在场景里就禁用任何控件。已满足的物件只加视觉状态（PRD R3）。
 */

import { el, clear } from '../kit.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

/** 场景内物件的固定锚点（无数据坐标时的稳定排版）。 */
const PROP_ANCHORS = [
  { left: '50%', top: '52%' },
  { left: '23%', top: '58%' },
  { left: '77%', top: '58%' },
  { left: '37%', top: '40%' },
  { left: '63%', top: '40%' },
]

/**
 * 代码绘制场景底（manifest key 缺省时的兜底）。
 * 每个场景是一组「绝对定位的色块」描述；未知场景 id 退回通用室内底，
 * 保证任何情况下都不出现空白矩形（`ui.md`：未风格化的矩形是占位物，不得上线）。
 */
const BACKDROPS = {
  bankHall: [
    { cls: 'wall' },
    { cls: 'lightpool' },
    { cls: 'col', css: 'left:9%' },
    { cls: 'col', css: 'left:22%' },
    { cls: 'col', css: 'left:74%' },
    { cls: 'col', css: 'left:87%' },
    { cls: 'grille' },
    { cls: 'counter' },
    { cls: 'floor' },
  ],
  /**
   * 第四章「隔壁的三栋楼」的街面：三栋楼本身是**可点物件**（`propStyle:'tower'`），
   * 场景底只提供天光 / 对面街沿 / 人行道 —— 全部由 CSS 绘制，不依赖任何位图。
   */
  cityStreet: [
    { cls: 'sky' },
    { cls: 'glow' },
    { cls: 'farblock', css: 'left:4%;width:15%;height:24%' },
    { cls: 'farblock', css: 'left:80%;width:16%;height:19%' },
    { cls: 'farblock', css: 'left:62%;width:11%;height:14%' },
    { cls: 'pave' },
    { cls: 'kerb' },
    { cls: 'floor' },
  ],
  generic: [{ cls: 'wall' }, { cls: 'lightpool' }, { cls: 'floor' }],
}

export default class SceneLayerView {
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null

    this.drawEl = el('div', 'ch-draw generic', root)
    this.bgImg = el('img', 'ch-scene-bg ch-hidden', root)
    this.bgImg.alt = ''
    this.veilEl = el('div', 'ch-scene-veil', root)

    this.captionEl = el('div', 'ch-scene-caption ch-hidden', root)
    this.captionWho = el('div', 'who', this.captionEl, '')
    this.captionWhere = el('div', 'where', this.captionEl, '')

    this.propsEl = el('div', '', root)

    this._sceneId = null
    this._useBitmap = false
    this._propEls = []
  }

  update(state) {
    const ch = chapterOf(state)
    const beat = ch.beat || null
    const sceneId = ch.sceneId || (beat && beat.scene) || null
    if (!sceneId) {
      this.root.classList.add('ch-hidden')
      clear(this.propsEl)
      this._propEls = []
      return
    }
    this.root.classList.remove('ch-hidden')

    // 券商壳可见时场景底收成底部环境带，避免盖住开户门 / 券商界面
    const fullBleed = ch.shellMode === 'hidden'
    this.root.classList.toggle('band', !fullBleed)

    this._applyBackdrop(sceneId, beat)
    this._applyCaption(beat, ch)
    this._applyProps(beat, ch)
  }

  // === 场景底 ===

  _applyBackdrop(sceneId, beat) {
    const key = beat && beat.sceneImageKey ? String(beat.sceneImageKey) : ''
    let bitmap = false
    if (key) {
      try {
        this.ui.setImage(this.bgImg, key)
        bitmap = true
      } catch (err) {
        // key 未注册 / 类型不支持 → 代码绘制兜底（plan R7：位图到位后只改 config）
        console.warn(`SceneLayerView: scene image key "${key}" unavailable, falling back to code-drawn backdrop`, err)
        bitmap = false
      }
    }
    this._useBitmap = bitmap
    this.bgImg.classList.toggle('ch-hidden', !bitmap)
    this.drawEl.classList.toggle('ch-hidden', bitmap)

    if (bitmap) return
    if (this._sceneId === sceneId && this.drawEl.firstChild) return
    this._sceneId = sceneId
    this._paintBackdrop(sceneId)
  }

  _paintBackdrop(sceneId) {
    clear(this.drawEl)
    const layout = BACKDROPS[sceneId] || BACKDROPS.generic
    this.drawEl.classList.toggle('generic', !BACKDROPS[sceneId])
    for (const part of layout) {
      const node = el('div', part.cls, this.drawEl)
      if (part.css) node.style.cssText = part.css
    }
  }

  _applyCaption(beat, ch) {
    const title = (beat && beat.title) || ''
    const where = ch.chapterName || ''
    if (!title && !where) {
      this.captionEl.classList.add('ch-hidden')
      return
    }
    this.captionEl.classList.remove('ch-hidden')
    this.captionWho.textContent = title
    this.captionWhere.textContent = where
  }

  // === 场景内可点物件 ===

  _applyProps(beat, ch) {
    const specs = this._propSpecs(beat)
    if (specs.length === this._propEls.length && this._propsSignature === this._signature(specs, ch)) {
      return // 无变化，避免每次 refresh 重建 DOM
    }
    this._propsSignature = this._signature(specs, ch)
    clear(this.propsEl)
    this._propEls = []
    specs.forEach((spec, index) => {
      this._propEls.push(this._buildProp(spec, index, ch))
    })
  }

  _signature(specs, ch) {
    const satisfied = (ch.beatRequirements || []).map((r) => `${r.id}:${r.satisfied ? 1 : 0}`).join(',')
    return `${specs.map((s) => s.id + '|' + s.label + '|' + (s.propStyle || '')).join(';')}::${satisfied}`
  }

  /** 场景内可点物件 = 本拍 `require[]` 里带 `opensPanel` 的 `interact` 条目。 */
  _propSpecs(beat) {
    const requires = (beat && beat.require) || []
    return requires
      .filter((r) => r && r.kind === 'interact' && r.opensPanel)
      .map((r) => ({
        id: r.id,
        label: r.label || '',
        opensPanel: r.opensPanel,
        propStyle: r.propStyle || null,
      }))
  }

  _buildProp(spec, index, ch) {
    const anchor = PROP_ANCHORS[index % PROP_ANCHORS.length]
    const node = el('button', 'ch-prop', this.propsEl)
    node.type = 'button'
    node.dataset.requireId = spec.id
    node.dataset.panelId = spec.opensPanel
    node.dataset.propStyle = spec.propStyle || 'paper'
    node.style.left = anchor.left
    node.style.top = anchor.top
    node.style.transform = 'translate(-50%, -50%)'

    if (spec.propStyle === 'tower') {
      // 第四章：三栋楼的**门脸**，纯 DOM/CSS 绘制（屋顶 / 招牌 / 窗格 / 门 / 台阶）
      node.classList.add('tower')
      const facade = el('span', 'facade', node)
      el('span', 'roof', facade)
      el('span', 'sign', facade, spec.label || '')
      const win = el('span', 'win', facade)
      for (let i = 0; i < 12; i += 1) el('i', '', win)
      el('span', 'door', facade)
      el('span', 'steps', facade)
    } else {
      // 代码绘制的纸质场景物件（存单 / 单据）：纯 DOM/CSS，无 canvas、无位图占位
      const paper = el('span', 'paper', node)
      el('span', 'seal', paper)
    }
    if (spec.label) el('span', 'cap', node, spec.label)

    const satisfied = (ch.beatRequirements || []).find((r) => r.id === spec.id)
    node.classList.toggle('on', Boolean(satisfied && satisfied.satisfied))
    node.setAttribute('aria-pressed', satisfied && satisfied.satisfied ? 'true' : 'false')

    node.addEventListener('click', () => {
      // 已满足的物件**照常可点**：再点一次就是「重新打开这块板子」
      // （节拍中途关掉面板后，这里是唯一的入口 —— 不加禁用、不加灰行）
      this.runtime?.chapterAck?.(spec.id)
    })
    return node
  }

  destroy() {
    clear(this.propsEl)
    this._propEls = []
  }
}
