/**
 * ChapterRoot —— 章节层容器：场景层 / 对话层 / 常驻卡层挂到 `ui.root` 的 `#chapter-root`。
 *
 * 层级（`.vibegame/spec/guides/market-101-architecture.md`）：
 *   #vibegame-ui (x=10, pointer-events:none)
 *   ├── #broker-shell   Stage 0 五区域（由 ShellRoot 挂载）
 *   └── #chapter-root   本类（场景层 / 对话层 / 常驻卡层）
 * 面板层不在这里 —— 它在 `#game-container` 下的 `ChapterOverlay`，因为面板必须真暂停。
 *
 * 主题只注入一次（`#chapter-theme`），供 `#chapter-root` 与 `.ch-panel` 两个作用域共用；
 * Stage 0 的 `scripts/ui/theme.js` 不被改动。
 *
 * 构造（由宿主 Node 在 `ready()` 里调用；本轮不改宿主，接线由后续 chunk 完成）：
 *   new ChapterRoot(ui, { runtime, overlay, chapters, concepts })
 * 其中 `chapters` / `concepts` 是 `config/chapters.json` / `config/concepts.json` 的解析结果
 * （唯一数据源；面板 spec、词典条目、公式块都从这两份数据里读，视图不自造 schema）。
 *
 * 之后每次状态变化调用 `update(runtimeState)`，`runtimeState = {...sim.snapshot(), chapter}`。
 */

import { CHAPTER_THEME_CSS } from './theme.js'
import SceneLayerView from './SceneLayerView.js'
import DialogueLayerView from './DialogueLayerView.js'
import PanelHost from './PanelHost.js'
import GoalCardView from './GoalCardView.js'
import FreeWindowCardView from './FreeWindowCardView.js'
import ConceptDictionaryView from './ConceptDictionaryView.js'
import MentorHistoryView from './MentorHistoryView.js'
import ProgressUnlockView from './ProgressUnlockView.js'
import NavStandingView from './NavStandingView.js'
import { el } from '../kit.js'

const THEME_STYLE_ID = 'chapter-theme'

/** `config/chapters.json` 既可能是整份文档，也可能直接是 `chapters` 数组。 */
function chaptersOf(doc) {
  if (Array.isArray(doc)) return doc
  if (doc && Array.isArray(doc.chapters)) return doc.chapters
  return []
}

function injectTheme() {
  const existing = document.getElementById(THEME_STYLE_ID)
  if (existing) return existing
  const styleEl = document.createElement('style')
  styleEl.id = THEME_STYLE_ID
  styleEl.textContent = CHAPTER_THEME_CSS
  document.head.appendChild(styleEl)
  return styleEl
}

export default class ChapterRoot {
  constructor(ui, cfg = {}) {
    if (!ui || !ui.root) throw new Error('ChapterRoot requires the engine UiLayer')
    this.ui = ui
    this.cfg = cfg
    this.runtime = cfg.runtime || null
    this.overlay = cfg.overlay || null
    this.chapters = cfg.chapters || null
    this.concepts = cfg.concepts || null

    this.styleEl = injectTheme()

    this.el = el('div', '', null)
    this.el.id = 'chapter-root'
    ui.mount(this.el)
    // 容器顺序：#chapter-root 必须在 #broker-shell 之后（后者先构造）。
    // 若调用方顺序相反，这里把它挪到券商壳之后，避免章节层被券商壳盖住。
    const shellEl = ui.root.querySelector('#broker-shell')
    if (shellEl && shellEl.nextElementSibling !== this.el) shellEl.after(this.el)

    // —— 场景层 ——
    this.sceneEl = el('div', 'ch-scene ch-hidden', this.el)
    this.scene = new SceneLayerView(this.sceneEl, ui, { runtime: this.runtime })

    // —— 对话层 ——
    this.dialogueEl = el('div', 'ch-dialogue ch-hidden', this.el)
    this.dialogue = new DialogueLayerView(this.dialogueEl, ui, { runtime: this.runtime })

    // —— 常驻卡层 ——
    this.residentEl = el('div', 'ch-resident', this.el)
    this.goalEl = el('div', '', this.residentEl)
    this.freeWindowEl = el('div', '', this.residentEl)
    this.goal = new GoalCardView(this.goalEl, ui, {
      runtime: this.runtime,
      concepts: this.concepts,
    })
    this.freeWindow = new FreeWindowCardView(this.freeWindowEl, ui, {
      runtime: this.runtime,
      chapters: chaptersOf(this.chapters),
    })
    this.dictionary = new ConceptDictionaryView(this.residentEl, ui, {
      runtime: this.runtime,
      chapters: this.chapters,
      concepts: this.concepts,
    })
    this.mentorHistory = new MentorHistoryView(this.residentEl, ui, { runtime: this.runtime })
    this.progress = new ProgressUnlockView(this.residentEl, ui, {
      runtime: this.runtime,
      chapters: this.chapters,
      concepts: this.concepts,
      instruments: cfg.instruments,
    })
    this.navStanding = new NavStandingView(this.residentEl, ui, {
      runtime: this.runtime,
      chapters: this.chapters,
    })

    // —— 面板层内容宿主（渲染进 ChapterOverlay 的 .ch-pbody / .ch-pfoot）——
    this.panels = new PanelHost(ui, {
      runtime: this.runtime,
      overlay: this.overlay,
      chapters: this.chapters,
      concepts: this.concepts,
    })
  }

  /** `state` = `{...sim.snapshot(), chapter}`（也容忍只传章节快照，便于无头断言）。 */
  update(state) {
    this.scene.update(state)
    this.dialogue.update(state)
    this.goal.update(state)
    this.freeWindow.update(state)
    this.dictionary.update(state)
    this.mentorHistory.update(state)
    this.progress.update(state)
    this.navStanding.update(state)
    this.panels.update(state)
    return this
  }

  destroy() {
    this.scene?.destroy?.()
    this.dialogue?.destroy?.()
    this.goal?.destroy?.()
    this.freeWindow?.destroy?.()
    this.dictionary?.destroy?.()
    this.mentorHistory?.destroy?.()
    this.progress?.destroy?.()
    this.navStanding?.destroy?.()
    this.panels?.destroy?.()
    this.el?.remove()
    this.el = null
    // 主题 <style> 与 ChapterOverlay 共用，谁先建谁持有，因此这里不急着移除。
  }
}
