/**
 * ProgressUnlockView —— 解锁与进度面板（PRD §5）。
 *
 * 四件事（PRD §5 的逐项）：
 *   1. **哪些章节走完了** —— `chapter.unlockedChapters`（唯一持久字段）；
 *   2. **哪些品种已解锁** —— `chapter.unlockedInstruments`（**派生量**，由运行时现算）；
 *   3. **哪些概念学过了** —— `chapter.conceptsIntroduced`（名字查 `config/concepts.json`）；
 *   4. **本章评级记录** —— `chapter.grades`（只列**已记录**的章，不写死分母）。
 *
 * 结构性约束（PRD §5「解锁看理解，推进看成绩」）：
 *   - 本视图**只读运行时快照**，不自己推导任何解锁条件、不读 NAV、不读评级；
 *     面板上任何一行都不是「因为账户如何、成绩如何」才出现的。
 *   - **不加禁用、不加灰行、不加锁**：未走到的章只标一个状态字，点不点得开与本面板无关。
 *   - 「走完一章 → 解锁」是**结果**，不是考试：本面板没有提交、没有判定、没有任何按钮
 *     能改变解锁集合。
 *
 * 挂载方式与词典 / 对话历史一致（常驻浮层，挂在 `#chapter-root` 内、不占 ChapterOverlay 的暂停语义）；
 * 入口在顶栏全局菜单（`BrokerShell.openProgress()` → 本视图 `open()`）。
 */

import { clear, el } from '../kit.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

function toArray(doc, key) {
  if (Array.isArray(doc)) return doc
  if (doc && Array.isArray(doc[key])) return doc[key]
  return []
}

const ICON_CLOSE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'

/** 面板 chrome 里唯一一句不在数据里的字（数据里没有就退回它，不让面板出现空标题）。 */
const FALLBACK_TITLE = '进度与解锁'

export default class ProgressUnlockView {
  /**
   * @param {HTMLElement} root 常驻卡层的挂载点（本视图只借它找 `#chapter-root`，不放入口按钮）
   * @param {object}      ui   引擎 UiLayer（只借它的 root 作为最后兜底的挂载点）
   * @param {object}      cfg  `{ runtime, chapters, concepts, instruments }`
   */
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null
    this.chapters = toArray(cfg.chapters, 'chapters')
    this.concepts = toArray(cfg.concepts, 'concepts')
    this.instruments = toArray(cfg.instruments, 'instruments')
    this.conceptName = new Map(this.concepts.map((c) => [c.key, c.name || c.key]))
    this.instrumentName = new Map(this.instruments.map((i) => [i.id, `${i.name} ${i.code || i.id}`]))
    this._lastState = null
    this._signature = null

    const mountRoot = (root && root.closest && root.closest('#chapter-root')) || (ui && ui.root) || root
    this.panelEl = el('div', 'ch-dict ch-prog ch-hidden', mountRoot)
    this.panelEl.dataset.role = 'progress-unlock'

    el('div', 'veil', this.panelEl)
    const sheet = el('div', 'sheet', this.panelEl)
    const head = el('div', 'hd', sheet)
    this.titleEl = el('div', 't', head, FALLBACK_TITLE)
    el('div', 'spacer', head)
    this.closeBtn = el('button', 'ch-btn ghost sm', head)
    this.closeBtn.type = 'button'
    this.closeBtn.innerHTML = ICON_CLOSE
    this.closeBtn.addEventListener('click', () => this.close())

    this.bodyEl = el('div', 'body prog-body', sheet)

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

  // === 渲染（只读快照投影）===

  update(state) {
    this._lastState = state
    if (!this.isOpen()) return
    this._render(state)
  }

  _render(state) {
    const ch = chapterOf(state)
    const copy = (ch.copy && ch.copy.progress) || {}
    const unlockedChapters = Array.isArray(ch.unlockedChapters) ? ch.unlockedChapters : []
    // **派生量**直接取用，本视图不重算、不交叉验证、不与钱或评级比对
    const unlockedInstruments = Array.isArray(ch.unlockedInstruments) ? ch.unlockedInstruments : []
    const conceptsIntroduced = Array.isArray(ch.conceptsIntroduced) ? ch.conceptsIntroduced : []
    const grades = (ch.grades && typeof ch.grades === 'object') ? ch.grades : {}

    const signature = [
      ch.chapterId,
      ch.mode,
      unlockedChapters.join(','),
      unlockedInstruments.join(','),
      conceptsIntroduced.length,
      JSON.stringify(grades),
      ch.goalCard && ch.goalCard.graded === false ? 'ungraded' : 'graded',
    ].join('|')
    if (signature === this._signature) return
    this._signature = signature

    this.titleEl.textContent = copy.title || FALLBACK_TITLE
    // 供断言直接读取（解锁集合的真实来源是快照，不是这里）
    this.panelEl.dataset.unlockedChapters = unlockedChapters.join(',')
    this.panelEl.dataset.unlockedInstruments = unlockedInstruments.join(',')

    clear(this.bodyEl)
    this._renderChapters(copy, ch, unlockedChapters)
    this._renderInstruments(copy, unlockedInstruments)
    this._renderConcepts(copy, conceptsIntroduced)
    this._renderGrades(copy, ch, grades)
    if (copy.unlockRule) el('div', 'prog-note', this.bodyEl, String(copy.unlockRule))
  }

  _chapterName(chapterId) {
    const found = this.chapters.find((c) => Number(c.id) === Number(chapterId))
    return found ? found.name || '' : ''
  }

  _section(title) {
    const sec = el('div', 'prog-sec', this.bodyEl)
    if (title) el('div', 'prog-hd', sec, String(title))
    return sec
  }

  _renderChapters(copy, ch, unlockedChapters) {
    const sec = this._section(copy.chaptersTitle)
    const rows = el('div', 'prog-rows', sec)
    rows.dataset.role = 'progress-chapters'
    for (const chapter of this.chapters) {
      const id = Number(chapter.id)
      if (!Number.isFinite(id)) continue
      const done = unlockedChapters.includes(id)
      const current = Number(ch.chapterId) === id && !done
      const status = done ? (copy.statusDone || '已完成') : current ? (copy.statusCurrent || '进行中') : (copy.statusTodo || '未开始')
      const row = el('div', 'prog-row', rows)
      row.dataset.chapterId = String(id)
      row.dataset.status = done ? 'done' : current ? 'current' : 'todo'
      el('span', 'no', row, `第 ${id} 章`)
      el('span', 'nm', row, chapter.name || '')
      const tag = el('span', `tag ${done ? 'done' : current ? 'current' : 'todo'}`, row, status)
      tag.dataset.role = 'progress-status'
    }
    return rows
  }

  _renderInstruments(copy, unlockedInstruments) {
    const sec = this._section(copy.instrumentsTitle)
    const rows = el('div', 'prog-rows', sec)
    rows.dataset.role = 'progress-instruments'
    rows.dataset.count = String(unlockedInstruments.length)
    if (!unlockedInstruments.length) {
      const empty = el('div', 'prog-empty', rows, copy.instrumentsEmpty || '')
      empty.dataset.role = 'progress-instruments-empty'
      return rows
    }
    for (const id of unlockedInstruments) {
      const row = el('div', 'prog-row', rows)
      row.dataset.instrumentId = String(id)
      el('span', 'no', row, String(id))
      el('span', 'nm', row, this.instrumentName.get(id) || '')
    }
    return rows
  }

  _renderConcepts(copy, conceptsIntroduced) {
    const sec = this._section(copy.conceptsTitle)
    const box = el('div', 'prog-rows', sec)
    box.dataset.role = 'progress-concepts'
    box.dataset.count = String(conceptsIntroduced.length)
    if (!conceptsIntroduced.length) {
      const empty = el('div', 'prog-empty', box, copy.conceptsEmpty || '')
      empty.dataset.role = 'progress-concepts-empty'
      return box
    }
    const chips = el('div', 'prog-chips', box)
    for (const key of conceptsIntroduced) {
      const chip = el('span', 'ch-chip', chips, this.conceptName.get(key) || String(key))
      chip.dataset.conceptKey = String(key)
    }
    return box
  }

  _renderGrades(copy, ch, grades) {
    const sec = this._section(copy.gradesTitle)
    const box = el('div', 'prog-rows', sec)
    box.dataset.role = 'progress-grades'
    const rows = Object.entries(grades)
      .map(([key, grade]) => ({ chapterId: Number(key), grade }))
      .filter((row) => Number.isFinite(row.chapterId))
      .sort((a, b) => a.chapterId - b.chapterId)
    // 分母**只数已记录的条目**（第四章不评级，全剧实际 6 次；不写死任何数字）
    box.dataset.count = String(rows.length)
    if (!rows.length) {
      const empty = el('div', 'prog-empty', box, copy.gradesEmpty || '')
      empty.dataset.role = 'progress-grades-empty'
    }
    for (const row of rows) {
      const line = el('div', 'prog-row', box)
      line.dataset.chapterId = String(row.chapterId)
      line.dataset.grade = String(row.grade)
      el('span', 'no', line, `第 ${row.chapterId} 章`)
      el('span', 'nm', line, this._chapterName(row.chapterId))
      el('span', 'g', line, String(row.grade))
    }
    // 当前章若声明「本章不打分」，如实写出来（不静默留空）
    const ungraded = ch.goalCard && ch.goalCard.graded === false
    if (ungraded) {
      const note = el('div', 'prog-note', sec, String(ch.goalCard.noScoreLabel || ''))
      note.dataset.role = 'progress-ungraded'
    }
    return box
  }

  destroy() {
    this.panelEl?.remove()
  }
}
