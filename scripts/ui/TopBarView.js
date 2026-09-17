/**
 * TopBarView —— 顶栏通栏（PRD §2.5 / §3.2 / §4）。
 *
 * 游戏名 · 日期与星期 · 交易日序号 · 总资产 NAV · 当日涨跌幅 · 可用资金 · 进入下一交易日。
 * 休市日：清楚显示「今日休市」，主按钮改为「下一日（休市）」，但仍可点击（Edge Case：休市日允许推进）。
 * 「重置账户」入口（PRD §4）：两段式内联确认，避免阻塞式 confirm 挡住运行时自动化。
 *
 * ---- Stage 1 追加（plan Scripts 行 83）----
 * **全局菜单**（`#broker-shell .gmenu`）收拢五件事：
 *   ① 模式切换 —— `chapter` / `freeDay` / `sandbox`（PRD §3.2：切换权永远在玩家手上）；
 *   ② 导师静音 —— 与对话层的静音按钮写同一个 `runtime.setMuted()`（玩家可见设置，进存档）；
 *   ③ 词典与公式查询 —— 打开章节层的词典面板（PRD §3.3「公式必须对玩家可见」）；
 *   ④ 章节进度重置 —— `ChapterRuntime.resetChapterProgress()`（PRD §4 Reset，用于重玩）；
 *   ⑤ 重置账户 —— 清空持仓 + `cash = ¥100,000`，其余全部保留（PRD §3.6）。
 *
 * ---- Stage 2 追加（PRD §4 / §5 / §6）----
 *   导师对话历史、关闭非剧情发言、**进度与解锁**、**净值与结业评定** —— 全部只是入口，
 *   状态由各自的视图从同一次 `update(state)` 的快照里投影。
 *
 * 菜单只做「入口」，不持有任何游戏状态：每一项都回呼宿主 Node 的钩子。当前模式与静音态
 * 由 `update(state)` 从 `state.chapter` 投影，菜单不自己记账（否则会与运行时不一致）。
 * 两段式确认（章节进度重置 / 重置账户）与 Stage 0 的「重置账户」同款：第一次点变成「确认…」，
 * 不弹阻塞式 confirm，运行时自动化不会被挡住。
 */

import { dirArrow, el, fmtMoney, fmtPct, setDirClass, setText } from './kit.js'

const DISARM_MS = 4000

/** 三种模式在菜单里的字面（PRD §3.2 的 mode 值 + 一句人话）。 */
const MODE_LABELS = [
  { mode: 'chapter', label: '主线章节 · chapter' },
  { mode: 'freeDay', label: '自由交易日 · freeDay' },
  { mode: 'sandbox', label: '沙盒模式 · sandbox' },
]

/**
 * 节拍数据声明的顶栏强调目标（`beat.highlight`）：名字 → 本栏控件。
 * 目前数据只声明了 `advanceDayButton`（节拍 1.6「明天再看」要求把「进入下一交易日」推给玩家）。
 * **只做视觉强调**：不加禁用、不置灰、不加遮罩（PRD R3 禁止用锁 UI 引导玩家）。
 */
const HIGHLIGHT_TARGETS = {
  advanceDayButton: (bar) => bar.advanceBtn,
}

export default class TopBarView {
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.cfg = cfg
    this.onAdvance = null
    this.onReset = null
    this.onResetChapter = null
    this.onSetMode = null
    this.onToggleMute = null
    this.onOpenDictionary = null
    this.onOpenMentorHistory = null
    this.onOpenProgress = null
    this.onOpenNavStanding = null
    this.onToggleProactive = null
    this._armed = false
    this._timer = null
    this._menuArmed = null
    this._menuOpen = false

    this.brand = el('span', 'brand', root, '入市第一课')
    el('span', 'badge', root, '模拟盘')
    this.haltBadge = el('span', 'badge halt', root, '今日休市')
    this.haltBadge.style.display = 'none'

    this.meta = el('span', 'meta', root)
    this.metaDay = el('b', '', this.meta, '1')
    this.meta.appendChild(document.createTextNode(' 交易日 · '))
    this.metaWeekday = el('span', '', this.meta, '周一')
    this.metaDate = el('span', '', this.meta, '')
    this.metaDate.style.marginLeft = '6px'

    el('span', 'spacer', root)

    const navStat = this._stat('总资产 NAV')
    this.navValue = navStat.value
    const dayStat = this._stat('当日涨跌幅')
    this.dayValue = dayStat.value
    this.dayValue.classList.add('sm')
    const cashStat = this._stat('可用资金')
    this.cashValue = cashStat.value
    this.cashValue.classList.add('sm')
    const frozenStat = this._stat('冻结资金')
    this.frozenStat = frozenStat.el
    this.frozenValue = frozenStat.value
    this.frozenValue.classList.add('sm')
    this.frozenStat.style.display = 'none'

    el('span', 'divider', root)

    this.advanceBtn = el('button', 'cta', root, '进入下一交易日 ▶')
    this.advanceBtn.type = 'button'
    this.advanceBtn.addEventListener('click', () => {
      this._disarm()
      this.onAdvance?.()
    })

    this.resetBtn = el('button', 'ghost', root, '重置账户')
    this.resetBtn.type = 'button'
    this.resetBtn.addEventListener('click', () => {
      if (!this._armed) {
        this._arm()
        return
      }
      this._disarm()
      this.onReset?.()
    })

    this._buildMenu(root)
  }

  _stat(label) {
    const wrap = el('div', 'stat', this.root)
    el('span', 'k', wrap, label)
    const value = el('span', 'v num', wrap, '—')
    return { el: wrap, value }
  }

  // === 全局菜单 ===

  _buildMenu(root) {
    const wrap = el('div', 'menu-wrap', root)
    this.menuBtn = el('button', 'ghost menu-btn', wrap, '菜单')
    this.menuBtn.type = 'button'
    this.menuBtn.addEventListener('click', () => this._toggleMenu())

    this.menuEl = el('div', 'gmenu ch-hidden', wrap)
    el('div', 'sec', this.menuEl, '模式（随时可切）')
    this.modeBtns = new Map()
    for (const entry of MODE_LABELS) {
      const btn = el('button', '', this.menuEl, entry.label)
      btn.type = 'button'
      btn.dataset.mode = entry.mode
      btn.addEventListener('click', () => {
        this.onSetMode?.(entry.mode)
        this._closeMenu()
      })
      this.modeBtns.set(entry.mode, btn)
    }

    el('div', 'sep', this.menuEl)

    this.muteBtn = el('button', '', this.menuEl, '静音导师')
    this.muteBtn.type = 'button'
    this.muteBtn.addEventListener('click', () => {
      this.onToggleMute?.()
      this._closeMenu()
    })

    this.dictBtn = el('button', '', this.menuEl, '词典与公式')
    this.dictBtn.type = 'button'
    this.dictBtn.addEventListener('click', () => {
      this.onOpenDictionary?.()
      this._closeMenu()
    })

    // Stage 2 追加：导师对话历史 + 「关闭非剧情发言」（PRD §4）
    this.historyBtn = el('button', '', this.menuEl, '导师对话历史')
    this.historyBtn.type = 'button'
    this.historyBtn.addEventListener('click', () => {
      this.onOpenMentorHistory?.()
      this._closeMenu()
    })

    this.proactiveBtn = el('button', '', this.menuEl, '关闭非剧情发言')
    this.proactiveBtn.type = 'button'
    this.proactiveBtn.addEventListener('click', () => {
      this.onToggleProactive?.()
      this._closeMenu()
    })

    // Stage 2 追加：进度与解锁 / 净值与结业评定（PRD §5 / §6）
    this.progressBtn = el('button', '', this.menuEl, '进度与解锁')
    this.progressBtn.type = 'button'
    this.progressBtn.addEventListener('click', () => {
      this.onOpenProgress?.()
      this._closeMenu()
    })

    this.navBtn = el('button', '', this.menuEl, '净值与结业评定')
    this.navBtn.type = 'button'
    this.navBtn.addEventListener('click', () => {
      this.onOpenNavStanding?.()
      this._closeMenu()
    })

    el('div', 'sep', this.menuEl)

    this.resetChapterBtn = el('button', '', this.menuEl, '章节进度重置')
    this.resetChapterBtn.type = 'button'
    this.resetChapterBtn.addEventListener('click', () => {
      if (this._menuArmed !== 'chapter') {
        this._armMenu('chapter', '确认重置章节进度？')
        return
      }
      this._menuArmed = null
      this.onResetChapter?.()
      this._closeMenu()
    })

    this.resetAccountBtn = el('button', '', this.menuEl, '重置账户')
    this.resetAccountBtn.type = 'button'
    this.resetAccountBtn.addEventListener('click', () => {
      if (this._menuArmed !== 'account') {
        this._armMenu('account', '确认重置账户？')
        return
      }
      this._menuArmed = null
      this.onReset?.()
      this._closeMenu()
    })
  }

  _armMenu(which, label) {
    this._menuArmed = which
    if (which === 'chapter') this.resetChapterBtn.textContent = label
    else this.resetAccountBtn.textContent = label
    const el2 = which === 'chapter' ? this.resetChapterBtn : this.resetAccountBtn
    el2.classList.add('arm')
  }

  _disarmMenu() {
    if (!this._menuArmed) return
    const el2 = this._menuArmed === 'chapter' ? this.resetChapterBtn : this.resetAccountBtn
    el2.textContent = this._menuArmed === 'chapter' ? '章节进度重置' : '重置账户'
    el2.classList.remove('arm')
    this._menuArmed = null
  }

  _toggleMenu() {
    if (this._menuOpen) this._closeMenu()
    else this._openMenu()
  }

  _openMenu() {
    this._menuOpen = true
    this.menuEl.classList.remove('ch-hidden')
    this.menuBtn.classList.add('on')
  }

  _closeMenu() {
    this._menuOpen = false
    this.menuEl.classList.add('ch-hidden')
    this.menuBtn.classList.remove('on')
    this._disarmMenu()
  }

  // === 两段式确认（Stage 0 的「重置账户」按钮）===

  _arm() {
    this._armed = true
    this.resetBtn.textContent = '确认重置？'
    this.resetBtn.classList.add('arm')
    this._timer = setTimeout(() => this._disarm(), DISARM_MS)
  }

  _disarm() {
    if (this._timer) clearTimeout(this._timer)
    this._timer = null
    if (!this._armed) return
    this._armed = false
    this.resetBtn.textContent = '重置账户'
    this.resetBtn.classList.remove('arm')
  }

  update(state) {
    this._disarm()
    setText(this.metaDay, state.dayIndex)
    setText(this.metaWeekday, state.weekdayLabel || '')
    setText(this.metaDate, state.inGameDate || '')
    setText(this.navValue, fmtMoney(state.NAV))
    setText(this.dayValue, `${dirArrow(state.dayReturnPct)}${fmtPct(state.dayReturnPct)}`)
    setDirClass(this.dayValue, state.dayReturnPct)
    setText(this.cashValue, fmtMoney(state.cash))

    const frozen = Number(state.frozenCash) || 0
    setText(this.frozenValue, fmtMoney(frozen))
    this.frozenStat.style.display = frozen > 0 ? 'flex' : 'none'

    this.haltBadge.style.display = state.isMarketOpen ? 'none' : 'inline-block'
    this.advanceBtn.textContent = state.isMarketOpen ? '进入下一交易日 ▶' : '下一日（休市）▶'
    this.advanceBtn.classList.toggle('closed', !state.isMarketOpen)

    this._syncHighlight(state)
    this._syncMenu(state)
  }

  /**
   * `beat.highlight` → 本栏控件的视觉强调（数据驱动，视图不自造 schema）。
   * 节拍声明只在主线模式下生效：`freeDay` / `sandbox` 与 Stage 0 完全一致，节拍数据不适用。
   * 强调 = 光晕 + 呼吸（纯 paint，不改变盒子尺寸），按钮仍然可点、不休、不遮。
   */
  _syncHighlight(state) {
    const chapter = state.chapter || null
    const name = chapter && chapter.mode === 'chapter' && chapter.beat ? chapter.beat.highlight || null : null
    for (const [key, pick] of Object.entries(HIGHLIGHT_TARGETS)) {
      const node = pick(this)
      if (!node) continue
      const on = name === key
      node.classList.toggle('hl', on)
      if (on) node.dataset.highlight = key
      else delete node.dataset.highlight
    }
  }

  /** 菜单的当前态从章节快照投影（菜单不自己记账）。 */
  _syncMenu(state) {
    const chapter = state.chapter || null
    const mode = (chapter && chapter.mode) || null
    const muted = Boolean(chapter && chapter.mentor && chapter.mentor.muted)
    for (const [key, btn] of this.modeBtns) {
      const on = key === mode
      btn.classList.toggle('on', on)
      btn.setAttribute('aria-pressed', on ? 'true' : 'false')
    }
    setText(this.muteBtn, muted ? '取消静音导师' : '静音导师')
    this.muteBtn.classList.toggle('on', muted)
    this.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false')
    const proactive = Boolean(chapter && chapter.mentor && chapter.mentor.proactiveEnabled !== false)
    setText(this.proactiveBtn, proactive ? '关闭非剧情发言' : '开启非剧情发言')
    this.proactiveBtn.classList.toggle('on', !proactive)
    this.proactiveBtn.setAttribute('aria-pressed', proactive ? 'false' : 'true')
    // 模式 / 静音 / 章节重置只在章节层在线时有意义（无章节快照时不显示误导性入口）
    for (const btn of this.modeBtns.values()) btn.style.display = chapter ? 'block' : 'none'
    this.muteBtn.style.display = chapter ? 'block' : 'none'
    this.resetChapterBtn.style.display = chapter ? 'block' : 'none'
    this.historyBtn.style.display = chapter ? 'block' : 'none'
    this.proactiveBtn.style.display = chapter ? 'block' : 'none'
    this.progressBtn.style.display = chapter ? 'block' : 'none'
    this.navBtn.style.display = chapter ? 'block' : 'none'
  }

  destroy() {
    if (this._timer) clearTimeout(this._timer)
  }
}
