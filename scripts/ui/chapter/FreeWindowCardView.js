/**
 * FreeWindowCardView —— 自由窗口常驻卡（`mode === 'freeDay'` 时）。
 *
 * 内容来自 `config/chapters.json` 的章节数据（PRD §2.3 / §3.2）：
 *   下一章名字（`nextChapter.name`）+ 一句预告（`nextChapter.preview`）+ 「回到主线」。
 * 「回到主线」= `runtime.setMode('chapter')` —— 运行时会在切换时给一句承接语
 * （`copy.resumeLines`），视图不自己编台词。
 *
 * 三种模式的呈现分工（PRD §3.2）：
 *   chapter  → 章目标卡（GoalCardView）
 *   freeDay  → 本卡（下一章名字与预告），且**不推进任何章**
 *   sandbox  → 两张卡都不出现（无目标卡、无引导），本卡只在 freeDay 显示
 */

import { el } from '../kit.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

/** 「回到主线」与「第 N 章」都不在任何数据文件里 —— 见交付说明的文案缺口。 */
const BACK_TO_MAIN = '回到主线'
const CHAPTER_ORDINAL = (n) => `第 ${n} 章`

export default class FreeWindowCardView {
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null
    this.chapters = Array.isArray(cfg.chapters) ? cfg.chapters : []

    this.cardEl = el('div', 'ch-card ch-freewin', root)
    this.headEl = el('div', 'hd', this.cardEl)
    this.nameEl = el('div', 'k', this.headEl, '')
    this.ordinalEl = el('div', 'n', this.headEl, '')
    this.previewEl = el('div', 'preview', this.cardEl, '')
    this.situationEl = el('div', 'situation', this.cardEl, '')

    const foot = el('div', 'foot', this.cardEl)
    this.backBtn = el('button', 'ch-btn', foot, BACK_TO_MAIN)
    this.backBtn.type = 'button'
    this.backBtn.addEventListener('click', () => this.runtime?.setMode?.('chapter'))
    this.modeEl = el('div', 'mode', foot, '')
  }

  update(state) {
    const ch = chapterOf(state)
    const next = ch.nextChapter || null
    const visible = ch.mode === 'freeDay' && Boolean(next && next.name)
    this.root.classList.toggle('ch-hidden', !visible)
    this.cardEl.classList.toggle('ch-hidden', !visible)
    if (!visible) return

    this.nameEl.textContent = next.name || ''
    this.ordinalEl.textContent = Number.isFinite(Number(next.id)) ? CHAPTER_ORDINAL(Number(next.id)) : ''
    this.previewEl.textContent = next.preview || ''

    // `nextChapter` 只有 {id,name,preview}；`situation` 从同一份章节数据里补（有则显示）
    const chapterDoc = this.chapters.find((c) => Number(c.id) === Number(next.id))
    const situation = (chapterDoc && chapterDoc.situation) || ''
    this.situationEl.textContent = situation
    this.situationEl.classList.toggle('ch-hidden', !situation)
    this.modeEl.textContent = ch.mode || ''
  }

  destroy() {
    this.cardEl?.replaceChildren?.()
  }
}
