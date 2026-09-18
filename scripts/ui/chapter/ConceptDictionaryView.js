/**
 * ConceptDictionaryView —— 概念词典 + **完整评级公式查询**。
 *
 * 为什么在章节层（而不是塞进 Stage 0 的 TopBar）：PRD §3.5 的出场条件之一是「四张规则卡都能在
 * 概念词典里查到」，§3.3 要求「设置里提供完整公式查询入口，不得用综合评分掩盖算法」。
 * 这两件事必须在章内随时可查，因此本视图自带入口按钮（挂在常驻卡层）+ 一块不暂停游戏的查询面板
 * （挂在 `#chapter-root` 上，`pointer-events: auto`，与常驻卡层同级，不占 `ChapterOverlay` 的暂停语义）。
 *
 * 数据来源：
 *   - 词条：`config/concepts.json`（`key/name/chapter/advanced/topic/def/explain/metaphor/related`），可搜。
 *   - **章节绑定只是指路，不是锁**（PRD §3）：来自「还没走到的章」的条目在列表里只显示名称
 *     ＋「下一章你会用到它」，**点开后仍是完整正文**，列表行不加禁用、不加灰行、不加遮罩。
 *   - `advanced: true` 的进阶条目**默认折叠**（只有标签 + 折叠外观、无正文），
 *     由 `advancedUnlocked`（A 级评级的**持久**奖励集合）展开。判定只读这个集合 ——
 *     Stage 1 用「当前加演段」判解锁，段一结束就重新折叠，那是缺陷。
 *   - 搜索只扫 **key / name / topic**：折叠中的进阶条目**不得**因为搜索而泄露正文。
 *   - 公式：`config/chapters.json` 里 `panel.settlement` 的 `formula` 块（表达式 + 口径说明）
 *     ＋ 运行时快照的 `ratingParams` / `ratingThresholds` / `ratingInputs`（本次代入值）。
 *     公式与常量都不在本视图里硬编码 —— 改公式只改数据。
 */

import { clear, el, fmtMoney, fmtNum, fmtPct } from '../kit.js'
import { badgeEl } from './badges.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

function toArray(doc, key) {
  if (Array.isArray(doc)) return doc
  if (doc && Array.isArray(doc[key])) return doc[key]
  return []
}

/** 词典的 chrome 文案（数据文件里没有）—— 见交付说明的文案缺口。 */
const TITLE = '词典与公式'
const TAB_CONCEPTS = '概念'
const TAB_FORMULA = '评级公式'
const ADVANCED_TAG = '进阶'
const NEXT_CHAPTER_HINT = '下一章你会用到它'
const FOLDED_HINT = '进阶 · 本章 A 级评级后展开'
const ICON_BOOK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2 2 0 0 1 6 3.5h13v17H6a2 2 0 0 0-2 2z"/><path d="M19 20.5H6"/></svg>'
const ICON_CLOSE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
const ICON_FOLD = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8D7C5E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 14l4 4M21 14l-4 4"/></svg>'
const ICON_SEARCH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A49477" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'

export default class ConceptDictionaryView {
  /**
   * @param {HTMLElement} root 常驻卡层的挂载点（只放「词典与公式」入口按钮）
   * @param {object}      ui   引擎 UiLayer（本视图只用它的 root 作为面板挂载点）
   * @param {object}      cfg  `{ runtime, chapters, concepts }`
   */
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null
    this.chapters = toArray(cfg.chapters, 'chapters')
    this.concepts = toArray(cfg.concepts, 'concepts')
    this.conceptByKey = new Map(this.concepts.map((c) => [c.key, c]))

    this.tab = 'concepts'
    this.query = ''
    this.selectedKey = this.concepts.length ? this.concepts[0].key : null
    this._lastState = null
    this._indexSignature = null
    this._formulaSignature = null

    // 入口（常驻卡层内）
    this.entryBtn = el('button', 'ch-dict-entry', root)
    this.entryBtn.type = 'button'
    this.entryBtn.innerHTML = `${ICON_BOOK}<span>${TITLE}</span>`
    this.entryBtn.addEventListener('click', () => this.toggle())

    // 查询面板挂在 `#chapter-root` 上（与常驻卡层同级，不参与 ChapterOverlay 的暂停）。
    // 本视图的样式全部作用域在 `#chapter-root .ch-dict` 下，因此必须挂在 `#chapter-root` 里面 ——
    // Stage 1 挂在 `ui.root`（`#vibegame-ui`）上，规则一条都不匹配，面板是**没有皮肤**的。
    const mountRoot = (root && root.closest && root.closest('#chapter-root')) || (ui && ui.root) || root
    this.panelEl = el('div', 'ch-dict ch-hidden', mountRoot)
    this.panelEl.dataset.role = 'concept-dictionary'

    // 先铺遮罩再放面板，保证面板在上层（都是定位元素，后面的画在上面）
    el('div', 'veil', this.panelEl)
    const sheet = el('div', 'sheet', this.panelEl)
    const head = el('div', 'hd', sheet)
    el('div', 't', head, TITLE)
    const search = el('label', 'search', head)
    search.innerHTML = ICON_SEARCH
    this.searchInput = el('input', '', search)
    this.searchInput.type = 'search'
    this.searchInput.addEventListener('input', () => {
      this.query = this.searchInput.value || ''
      this._indexSignature = null
      this._renderIndex(this._lastState)
    })
    el('div', 'spacer', head)
    this.closeBtn = el('button', 'ch-btn ghost sm', head)
    this.closeBtn.type = 'button'
    this.closeBtn.innerHTML = ICON_CLOSE
    this.closeBtn.addEventListener('click', () => this.close())

    const tabs = el('div', 'tabs', sheet)
    this.tabConcepts = el('button', 'tab on', tabs, TAB_CONCEPTS)
    this.tabFormula = el('button', 'tab', tabs, TAB_FORMULA)
    this.tabConcepts.type = 'button'
    this.tabFormula.type = 'button'
    this.tabConcepts.addEventListener('click', () => this._selectTab('concepts'))
    this.tabFormula.addEventListener('click', () => this._selectTab('formula'))

    const body = el('div', 'body', sheet)
    this.indexEl = el('div', 'idx', body)
    this.detailEl = el('div', 'detail', body)

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
    // 打开即铺内容：本视图在关闭期间不追踪状态（`update()` 提前返回），
    // 若不在这里按最近一次快照渲染，玩家点开词典会看到一块空白，直到下一次状态推送才出现词条。
    // `_render` 内部按签名短路，重复开关不会重复建 DOM。
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

  _selectTab(tab) {
    this.tab = tab === 'formula' ? 'formula' : 'concepts'
    this.tabConcepts.classList.toggle('on', this.tab === 'concepts')
    this.tabFormula.classList.toggle('on', this.tab === 'formula')
    this._indexSignature = null
    this._formulaSignature = null
    this._render(this._lastState)
  }

  // === 渲染 ===

  update(state) {
    this._lastState = state
    if (!this.isOpen()) return
    this._render(state)
  }

  _render(state) {
    const ch = chapterOf(state)
    const unlocked = this._unlockedKeys(ch)
    if (this.tab === 'formula') {
      this._renderFormula(ch)
      return
    }
    this.indexEl.classList.remove('ch-hidden')
    this._renderIndex(state, unlocked)
    this._renderDetail(ch, unlocked)
  }

  /**
   * 进阶条目的解锁集合 = **只读**运行时快照里的 `advancedUnlocked`（A 级评级的持久奖励）。
   * 不再并 `conceptsIntroduced`，也不再并「当前加演段」——后者会让段一结束就重新折叠。
   */
  _unlockedKeys(ch) {
    return new Set(Array.isArray(ch.advancedUnlocked) ? ch.advancedUnlocked : [])
  }

  /** 折叠中的进阶条目：列表仍可点，只是**不展开正文**。 */
  _isFolded(concept, unlocked) {
    return Boolean(concept && concept.advanced) && !unlocked.has(concept.key)
  }

  /**
   * 该条目所属的章「走到了吗」。走到了 = 当前章或更早，或该章已在 `unlockedChapters` 里
   * （已走完理解确认）。没走到只是**指路**：列表显名称 + 提示，点开仍有完整正文。
   */
  _reached(concept, ch) {
    const chapter = Number(concept && concept.chapter)
    if (!Number.isFinite(chapter)) return true
    const current = Number(ch.chapterId)
    if (Number.isFinite(current) && chapter <= current) return true
    const passed = Array.isArray(ch.unlockedChapters) ? ch.unlockedChapters : []
    return passed.map(Number).includes(chapter)
  }

  /** 搜索只扫 key / name / topic —— 折叠中的进阶条目不得因搜索泄露正文。 */
  _matches(concept) {
    if (!this.query) return true
    const needle = this.query.trim().toLowerCase()
    if (!needle) return true
    const hay = [concept.key, concept.name, concept.topic]
      .map((v) => String(v === undefined || v === null ? '' : v))
      .join(' ')
      .toLowerCase()
    return hay.includes(needle)
  }

  _renderIndex(state, unlocked) {
    const ch = chapterOf(state)
    const unlockedSet = unlocked || this._unlockedKeys(ch)
    const list = this.concepts.filter((c) => this._matches(c))
    const signature = [
      this.query,
      list.map((c) => c.key).join(','),
      [...unlockedSet].sort().join(','),
      String(ch.chapterId),
      (Array.isArray(ch.unlockedChapters) ? ch.unlockedChapters : []).join(','),
    ].join('|')
    if (signature === this._indexSignature) return
    this._indexSignature = signature
    clear(this.indexEl)

    for (const concept of list) {
      const folded = this._isFolded(concept, unlockedSet)
      const reached = this._reached(concept, ch)
      const btn = el('button', 'entry', this.indexEl)
      btn.type = 'button'
      btn.dataset.conceptKey = concept.key
      btn.classList.toggle('on', this.selectedKey === concept.key)
      // 折叠 ≠ 禁用：行仍可点、颜色不变，只是没有正文
      btn.classList.toggle('folded', folded)
      btn.classList.toggle('nex', !reached)
      // 概念徽章（装饰层）：没有对应徽章时不占位
      const badge = badgeEl(concept.key, 'xs')
      if (badge) btn.appendChild(badge)
      el('span', '', btn, concept.name || concept.key)
      if (concept.advanced) el('span', 'tag', btn, ADVANCED_TAG)
      if (!reached) el('span', 'tag next', btn, NEXT_CHAPTER_HINT)
      btn.addEventListener('click', () => {
        this.selectedKey = concept.key
        this._indexSignature = null
        this._render(this._lastState)
      })
    }
  }

  _renderDetail(ch, unlocked) {
    const concept = this.selectedKey ? this.conceptByKey.get(this.selectedKey) : null
    clear(this.detailEl)
    if (!concept) return
    // 词典条目正文（数据），没有的就是没有 —— 不编造解释
    // 徽章只在有对应图形时才包一层，避免无徽章的概念被改变既有排版
    const dBadge = badgeEl(concept.key, 'md')
    if (dBadge) {
      const dh = el('div', 'detail-head', this.detailEl)
      dh.appendChild(dBadge)
      el('h3', '', dh, concept.name || concept.key)
    } else {
      el('h3', '', this.detailEl, concept.name || concept.key)
    }
    if (this._isFolded(concept, unlocked)) {
      // 折叠中的进阶条目：有标签、无正文（搜索也不泄露）
      const folded = el('div', 'detail-folded', this.detailEl)
      folded.dataset.chFolded = concept.key
      folded.innerHTML = ICON_FOLD
      el('div', 'lbl', this.detailEl, FOLDED_HINT)
      return
    }
    if (concept.def) {
      el('div', 'lbl', this.detailEl, 'def')
      el('p', '', this.detailEl, concept.def)
    }
    if (concept.explain) {
      el('div', 'lbl', this.detailEl, 'explain')
      el('p', '', this.detailEl, concept.explain)
    }
    if (concept.metaphor) {
      el('div', 'lbl', this.detailEl, 'metaphor')
      el('p', 'mt', this.detailEl, concept.metaphor)
    }
    if (Array.isArray(concept.related) && concept.related.length) {
      el('div', 'lbl', this.detailEl, 'related')
      const rel = el('div', 'rel', this.detailEl)
      for (const key of concept.related) {
        const chip = el('span', 'ch-chip', rel)
        chip.textContent = key
        chip.style.cursor = 'pointer'
        chip.addEventListener('click', () => {
          if (!this.conceptByKey.has(key)) return
          this.selectedKey = key
          this._indexSignature = null
          this._render(this._lastState)
        })
      }
    }
  }

  // === 评级公式（不得用综合评分掩盖算法）===

  /** 公式块来自数据：任何一章的 `panel.settlement.blocks[]` 里的 `formula` 块。 */
  _formulaBlock() {
    for (const chapter of this.chapters) {
      const panels = (chapter && chapter.panels) || {}
      for (const panel of Object.values(panels)) {
        const block = ((panel && panel.blocks) || []).find((b) => b && b.type === 'formula')
        if (block) return block
      }
    }
    return null
  }

  _renderFormula(ch) {
    const block = this._formulaBlock()
    const params = ch.ratingParams || {}
    const inputs = ch.ratingInputs || {}
    const thresholds = ch.ratingThresholds || {}
    const signature = [
      block ? block.expression : '',
      Object.keys(params).join(','),
      Object.keys(inputs).join(','),
      ch.rating ? `${ch.rating.S}:${ch.rating.grade}` : '',
    ].join('|')
    if (signature === this._formulaSignature) return
    this._formulaSignature = signature
    clear(this.detailEl)
    this.indexEl.classList.add('ch-hidden')

    if (!block) {
      const missing = el('div', 'ch-blk', this.detailEl)
      missing.dataset.chUnresolved = 'formula'
      return
    }
    el('div', 'lbl', this.detailEl, block.label || '')
    const formula = el('div', 'ch-formula', this.detailEl)
    el('div', 'expr', formula, String(block.expression || ''))
    if (Array.isArray(block.notes) && block.notes.length) {
      const notes = el('ul', 'notes', formula)
      for (const note of block.notes) el('li', '', notes, String(note))
    }

    // 常量（数据来自运行时快照的 ratingParams；键名是字段名，不是新文案）
    const constKeys = Object.keys(params)
    if (constKeys.length) {
      el('div', 'lbl', this.detailEl, 'RATING_PARAMS')
      const meta = el('div', 'meta', this.detailEl)
      for (const key of constKeys) {
        const chip = el('span', 'ch-chip', meta)
        chip.textContent = `${key} ${fmtNum(params[key], 4)}`
        chip.dataset.key = key
      }
    }

    // 本次代入值（章末结算后才有；没有就不显示，不编造）
    const inputKeys = Object.keys(inputs).filter((k) => typeof inputs[k] === 'number' || typeof inputs[k] === 'string')
    if (inputKeys.length) {
      el('div', 'lbl', this.detailEl, 'RATING_INPUTS')
      const meta = el('div', 'meta', this.detailEl)
      for (const key of inputKeys) {
        const value = inputs[key]
        if (Array.isArray(value)) continue
        const chip = el('span', 'ch-chip', meta)
        chip.textContent = `${key} ${this._fmtInput(key, value)}`
        chip.dataset.key = key
      }
    }

    // 档次门槛（数字来自 ratingThresholds，档位标签/点评来自章末结算数据）
    const settlement = ch.settlement || {}
    const labels = settlement.gradeLabels || {}
    const lines = settlement.gradeLines || {}
    el('div', 'lbl', this.detailEl, 'GRADES')
    const grades = el('div', 'ch-grades', this.detailEl)
    for (const grade of ['A', 'B', 'C', 'D']) {
      const box = el('div', 'ch-grade', grades)
      box.dataset.grade = grade
      box.classList.toggle('on', Boolean(ch.rating && ch.rating.grade === grade))
      el('div', 'g', box, grade)
      el('div', 'r', box, this._thresholdText(grade, thresholds))
      if (lines[grade]) el('div', 'r', box, String(lines[grade]))
      if (labels[grade]) el('div', 'r', box, String(labels[grade]))
    }
  }

  _fmtInput(key, value) {
    const n = Number(value)
    if (key === 'excludedPnl' || /nav|fees|notional|injection/i.test(key)) return fmtMoney(n)
    if (key === 'adjustedNavSeries') return '—'
    if (key === 'rar' || key === 'maxDD' || key === 'costRatio') return fmtPct(n)
    if (Number.isFinite(n)) return fmtNum(n, 4)
    return String(value)
  }

  _thresholdText(grade, thresholds) {
    if (grade === 'D') {
      const c = Number(thresholds.C)
      return Number.isFinite(c) ? `< ${fmtNum(c, 2)}` : ''
    }
    const t = Number(thresholds[grade])
    return Number.isFinite(t) ? `≥ ${fmtNum(t, 2)}` : ''
  }

  destroy() {
    this.panelEl?.remove()
    this.entryBtn?.remove()
  }
}
