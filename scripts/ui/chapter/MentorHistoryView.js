/**
 * MentorHistoryView —— 导师对话历史（PRD §4「对话历史随时可回看」）。
 *
 * 三件事：
 *   1. **按序列出他说过的每一句台词**，带所属章 / 拍与来源（`source`）—— 数据源是运行时快照的
 *      `chapter.mentorHistory`，本视图**不持有任何剧情状态**，也不自己拼接台词。
 *   2. **两个听感开关**：静音（`runtime.setMuted`）与「关闭非剧情发言」（`runtime.setProactiveEnabled`）。
 *      两者都写进运行时（玩家可见设置，进存档），视图只做投影。
 *   3. **空状态是一句中性文案**（来自数据 `copy.historyEmpty`），永远不是错误提示。
 *
 * 无隐藏层：历史上只列出**已经说出口**的台词，没有「未揭示」的条目、没有碎片 / 身份 / 延迟台词。
 * 与词典同一挂载方式（常驻卡层的入口按钮 + 挂在 `ui.root` 的浮层，不参与 ChapterOverlay 的暂停）。
 */

import { clear, el } from '../kit.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

const TITLE = '导师对话历史'
const ICON_TALK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A2.5 2.5 0 0 1 17.5 17H9l-5 3.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z"/></svg>'
const ICON_CLOSE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'

/** 来源标签（`MENTOR_SOURCE` 的字面 → 玩家看得懂的说法）。 */
const SOURCE_LABELS = {
  beat: '节拍',
  resume: '回到主线',
  choiceFeedback: '选项反馈',
  riskWarning: '风险提醒',
  grade: '章末',
  segment: '加演 / 补救',
  playerCall: '你问他',
  proactiveHint: '提醒',
}

const SPEAKER_FACE = '老周'
const SPEAKER_OFFSCREEN = '画外音'

export default class MentorHistoryView {
  /**
   * @param {HTMLElement} root 常驻卡层的挂载点（只放入口按钮）
   * @param {object}      ui   引擎 UiLayer（只借它的 root 作为浮层挂载点）
   * @param {object}      cfg  `{ runtime }`
   */
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null
    this._lastState = null
    this._signature = null

    this.entryBtn = el('button', 'ch-hist-entry', root)
    this.entryBtn.type = 'button'
    this.entryBtn.innerHTML = `${ICON_TALK}<span>${TITLE}</span>`
    this.entryBtn.addEventListener('click', () => this.toggle())

    const mountRoot = (root && root.closest && root.closest('#chapter-root')) || (ui && ui.root) || root
    this.panelEl = el('div', 'ch-dict ch-hist ch-hidden', mountRoot)
    this.panelEl.dataset.role = 'mentor-history'

    el('div', 'veil', this.panelEl)
    const sheet = el('div', 'sheet', this.panelEl)
    const head = el('div', 'hd', sheet)
    el('div', 't', head, TITLE)
    el('div', 'spacer', head)
    this.closeBtn = el('button', 'ch-btn ghost sm', head)
    this.closeBtn.type = 'button'
    this.closeBtn.innerHTML = ICON_CLOSE
    this.closeBtn.addEventListener('click', () => this.close())

    // 两个听感开关（都写运行时；视图不自己记账，状态由快照投影回来）
    const settings = el('div', 'hist-settings', sheet)
    this.muteBtn = el('button', 'tab', settings, '静音导师')
    this.muteBtn.type = 'button'
    this.muteBtn.addEventListener('click', () => this._toggleMute())
    this.proactiveBtn = el('button', 'tab', settings, '关闭非剧情发言')
    this.proactiveBtn.type = 'button'
    this.proactiveBtn.addEventListener('click', () => this._toggleProactive())

    this.listEl = el('div', 'hist-body', sheet)

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

  _toggleMute() {
    this.runtime?.setMuted?.(!this.runtime.muted)
  }

  _toggleProactive() {
    const snapshot = this.runtime && typeof this.runtime.snapshot === 'function' ? this.runtime.snapshot() : null
    const enabled = Boolean(snapshot && snapshot.mentor && snapshot.mentor.proactiveEnabled)
    this.runtime?.setProactiveEnabled?.(!enabled)
  }

  // === 渲染 ===

  update(state) {
    this._lastState = state
    if (!this.isOpen()) return
    this._render(state)
  }

  _render(state) {
    const ch = chapterOf(state)
    const mentor = ch.mentor || {}
    const muted = Boolean(mentor.muted)
    const proactive = mentor.proactiveEnabled !== false
    const history = Array.isArray(ch.mentorHistory) ? ch.mentorHistory : []
    const empty = ch.copy && ch.copy.historyEmpty ? String(ch.copy.historyEmpty) : ''

    this.muteBtn.classList.toggle('on', muted)
    this.muteBtn.textContent = muted ? '取消静音' : '静音导师'
    this.proactiveBtn.classList.toggle('on', !proactive)
    this.proactiveBtn.textContent = proactive ? '关闭非剧情发言' : '开启非剧情发言'

    const signature = [
      history.length,
      history.length ? `${history[history.length - 1].chapterId}:${history[history.length - 1].beatId}:${history[history.length - 1].line}` : '',
      muted,
      proactive,
      empty,
    ].join('|')
    if (signature === this._signature) return
    this._signature = signature
    clear(this.listEl)

    if (!history.length) {
      // 空状态：中性一句，绝不是错误
      const row = el('div', 'hist-empty', this.listEl)
      row.dataset.histEmpty = 'true'
      row.textContent = empty
      return
    }

    for (const entry of history) {
      const row = el('div', 'hist-row', this.listEl)
      row.dataset.source = entry.source || ''
      const meta = el('div', 'hist-meta', row)
      const parts = []
      if (entry.chapterId !== null && entry.chapterId !== undefined) parts.push(`第 ${entry.chapterId} 章`)
      if (entry.beatId) parts.push(String(entry.beatId))
      if (entry.source && SOURCE_LABELS[entry.source]) parts.push(SOURCE_LABELS[entry.source])
      el('span', 'ch-chip', meta, parts.join(' · '))
      el('span', 'who', meta, entry.speaker === 'offscreen' ? SPEAKER_OFFSCREEN : SPEAKER_FACE)
      el('div', 'hist-line', row, String(entry.line || ''))
    }
  }

  destroy() {
    this.panelEl?.remove()
    this.entryBtn?.remove()
  }
}
