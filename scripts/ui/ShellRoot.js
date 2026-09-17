/**
 * ShellRoot —— 五区域栅格布局容器 + 主题注入 + **展示模式**（Stage 1 扩展）。
 *
 * PRD §2.5 的单屏券商骨架：顶栏通栏 / 中部三列（自选 · 行情主区 · 下单）/ 底部通栏（持仓 · 导师）。
 * 本类只负责「结构与主题 + 展示模式」，每个区域的内容由各自的 View 类填充。
 *
 * Stage 1 追加三件东西（对应 PRD §1 / §3.4 节拍 1.2）：
 *   1. **开户门区** `shell-gate`：节拍 1.2「券商 App 第一次出现——只露开户面板」。
 *      它就是券商壳的一块区域（不是面板层）——面板层只承载需要真暂停的全屏互动（plan 决策 12）。
 *      门上的按钮**由数据派生**：宿主把本拍 `require[]` 里带 `simAction` 的 `interact` 条目交给
 *      `setGateActions()`，本类只负责渲染并按 id 回呼 —— 视图不自己调 `openAccount`。
 *   2. **展示模式** `setDisplayMode('hidden'|'openAccount'|'full')`：与
 *      `ChapterRuntime.snapshot().shellMode`（节拍声明）一一对应。sandbox / freeDay 由宿主传 `full`
 *      （PRD §3.2：沙盒与 Stage 0 完全一致）。
 *   3. **章节层宿主** `#chapter-host`：`#broker-shell` 的兄弟节点。章节层（场景 / 对话 / 常驻卡）
 *      必须盖在券商壳**之上**，因此不能挂在壳内部（壳一旦 `hidden` 会把章节层一起藏掉）。
 *      `ChapterRoot` 自建 `#chapter-root` 并自行插到 `#broker-shell` 之后；本宿主提供同一层级的
 *      稳定挂载点，供宿主 Node 挂其它同级层（词典等）。
 *
 * 不做的事：不因为展示模式就禁用任何控件（PRD R3 禁止用锁 UI 来引导玩家）；本类只切换可见性。
 */

import { THEME_CSS } from './theme.js'
import { clear, el } from './kit.js'

/** Stage 1 追加样式。Stage 0 的 `theme.js` 不动，追加规则单独注入一份（见 plan 的「只加不改」）。 */
const SHELL_EXT_CSS = `
#broker-shell[data-shell-mode="hidden"] { display: none; }
#broker-shell[data-shell-mode="openAccount"] .topbar,
#broker-shell[data-shell-mode="openAccount"] .main,
#broker-shell[data-shell-mode="openAccount"] .bottom { visibility: hidden; }

/* 开户门：银行大厅走到券商 App 的第一步（节拍 1.2） */
#broker-shell .shell-gate {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: radial-gradient(880px 460px at 50% 42%, #DCD3C4 0%, rgba(235, 230, 221, 0.88) 72%);
  pointer-events: auto;
}
#broker-shell[data-shell-mode="openAccount"] .shell-gate { display: flex; }
#broker-shell .shell-gate .gate-card {
  width: 430px;
  padding: 22px 24px 20px;
  background: linear-gradient(180deg, #DED6C7, #E1DACC);
  border: 1px solid var(--hair);
  border-radius: 12px;
  box-shadow: 0 18px 46px rgba(239, 236, 231, 0.55);
}
#broker-shell .shell-gate .hd { display: flex; align-items: baseline; gap: 9px; }
#broker-shell .shell-gate .hd .t { font-size: 15px; font-weight: 600; }
#broker-shell .shell-gate .hd .tag {
  font-size: 10.5px;
  color: var(--gold);
  border: 1px solid #4A3A18;
  border-radius: 4px;
  padding: 0 5px;
  line-height: 16px;
}
#broker-shell .shell-gate .rows { margin-top: 14px; display: flex; flex-direction: column; gap: 7px; }
#broker-shell .shell-gate .row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
  border-bottom: 1px solid var(--hair-2);
  padding-bottom: 6px;
}
#broker-shell .shell-gate .row .v { color: var(--text-2); font-variant-numeric: tabular-nums; }
#broker-shell .shell-gate .actions { margin-top: 16px; display: flex; gap: 8px; }
#broker-shell .shell-gate .actions .gate-btn {
  flex: 1;
  padding: 10px 0;
  border-radius: 8px;
  background: linear-gradient(180deg, #8A7551, #A48C64);
  color: #fff;
  font-weight: 600;
}
#broker-shell .shell-gate .actions .gate-btn:hover { filter: brightness(1.08); }

/* 自选行：1 手金额列（PRD §3.4 缺陷修复 2/3） */
#broker-shell .qrow .l3 {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 10.5px;
  color: var(--dim);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* 超资金：用「拒单」族色（琥珀），绝不占用涨跌方向色（theme.js 硬规则 / PRD §2.3） */
#broker-shell .qrow .lot.over { color: var(--reject); font-weight: 600; }
#broker-shell .qrow .lot-flag { color: var(--reject); flex: 0 0 auto; }

/* 下单面板：超资金非阻断提示 + 提交锁 / 已买入态 */
#broker-shell .ticket .overhint {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
  font-size: 11px;
  line-height: 1.5;
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--reject-soft);
  color: var(--reject);
  border: 1px solid var(--reject-line);
}
#broker-shell .ticket .overhint.ch-hidden { display: none; }
#broker-shell .ticket .overhint .ghost { flex: 0 0 auto; }
/* 超资金提示出现时把面板行距收紧，保证「提示 + 拒单回执」同时在场也不撑出面板 */
#broker-shell .ticket.tight { gap: 5px; padding: 8px 12px; }
#broker-shell .submit.done { background: var(--ok); }
#broker-shell .submit[data-locked="1"] { filter: brightness(0.82); cursor: progress; }

/* 章内导师面板降级为静态（lead 裁决 R10）：只留立绘与中性标签，不留空行 */
#broker-shell .mentor.static .say,
#broker-shell .mentor.static .foot { display: none; }

/* 顶栏全局菜单（PRD §3.2 / §4） */
#broker-shell .topbar .menu-wrap { position: relative; }
#broker-shell .topbar .menu-btn { position: relative; }
#broker-shell .topbar .menu-btn.on { color: var(--text); border-color: #C8BAA2; }
#broker-shell .gmenu {
  position: absolute;
  right: 0;
  top: 34px;
  z-index: 6;
  width: 232px;
  padding: 8px;
  background: #E1D9CC;
  border: 1px solid var(--hair);
  border-radius: 10px;
  box-shadow: 0 14px 34px rgba(239, 236, 231, 0.6);
  pointer-events: auto;
}
#broker-shell .gmenu.ch-hidden { display: none; }
#broker-shell .gmenu .sec { font-size: 10.5px; color: var(--dim); padding: 6px 6px 4px; }
#broker-shell .gmenu button {
  display: block;
  width: 100%;
  text-align: left;
  padding: 7px 8px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 12px;
}
#broker-shell .gmenu button:hover { background: #DBD2C2; color: var(--text); }
#broker-shell .gmenu button.on { background: #DBD2C2; color: var(--text); font-weight: 600; border-left: 2px solid var(--accent); }
#broker-shell .gmenu button.arm { background: #D9CFBE; color: #605138; }
#broker-shell .gmenu .sep { height: 1px; background: var(--hair-2); margin: 6px 2px; }

/* 节拍声明的顶栏强调（beat.highlight，节拍 1.6 = 「进入下一交易日」）。
   只用 outline / box-shadow / filter 做呼吸 —— 纯 paint，不动盒子尺寸，
   也**不禁用、不置灰、不加遮罩**：按钮照常可点，锁 UI 引导玩家是被禁止的。 */
#broker-shell .topbar .cta.hl {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(224, 163, 62, 0.16), 0 6px 16px rgba(239, 236, 231, 0.45);
  animation: broker-cta-hl 1400ms ease-in-out infinite;
}
@keyframes broker-cta-hl {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.18); }
}
`

export default class ShellRoot {
  constructor(ui) {
    this.ui = ui
    this._displayMode = 'full'
    this._gateHandler = null

    // 主题：CSS 字符串注入 <style>（plan.md 决策：主题由 scripts/ui/theme.js 持有）
    this.styleEl = document.createElement('style')
    this.styleEl.id = 'broker-theme'
    this.styleEl.textContent = THEME_CSS
    document.head.appendChild(this.styleEl)

    // Stage 1 追加样式（与 #broker-theme 分开，便于单独审查）
    this.extStyleEl = document.createElement('style')
    this.extStyleEl.id = 'broker-theme-ext'
    this.extStyleEl.textContent = SHELL_EXT_CSS
    document.head.appendChild(this.extStyleEl)

    // 逻辑画布 1440×810，UiLayer 会按 canvas 实际尺寸整体缩放
    this.el = document.createElement('div')
    this.el.id = 'broker-shell'
    this.el.dataset.shellMode = 'full'
    ui.mount(this.el)

    // 顶栏
    this.topbarEl = el('div', 'topbar', this.el)

    // 中部三列
    const main = el('div', 'main', this.el)
    this.watchEl = el('div', 'watch panel', main)
    this.midEl = el('div', 'mid panel', main)
    this.ticketEl = el('div', 'ticket panel', main)

    // 底部通栏：左持仓、右导师
    const bottom = el('div', 'bottom', this.el)
    this.positionsEl = el('div', 'positions panel', bottom)
    this.mentorEl = el('div', 'mentor panel', bottom)

    // 开户门区（节拍 1.2 券商壳第一次出现时唯一可见的区域）
    this.accountGateEl = el('div', 'shell-gate', this.el)
    const gateCard = el('div', 'gate-card', this.accountGateEl)
    const gateHead = el('div', 'hd', gateCard)
    this.gateTitleEl = el('div', 't', gateHead, '开一个资金账户')
    el('div', 'tag', gateHead, '模拟盘')
    this.gateRowsEl = el('div', 'rows', gateCard)
    this.gateActionsEl = el('div', 'actions', gateCard)

    // 章节层宿主：与 #broker-shell 同级，保证章节层盖在券商壳之上
    this.chapterHostEl = document.createElement('div')
    this.chapterHostEl.id = 'chapter-host'
    this.el.after(this.chapterHostEl)
  }

  // === 展示模式（与 ChapterRuntime.snapshot().shellMode 一一对应）===

  get displayMode() {
    return this._displayMode
  }

  /**
   * `hidden` 全部藏起（节拍 0–1.1）；`openAccount` 只露开户门（节拍 1.2–1.3）；
   * `full` 五区域全开（节拍 1.4 起，以及 freeDay / sandbox）。
   */
  setDisplayMode(mode) {
    const next = mode === 'hidden' || mode === 'openAccount' ? mode : 'full'
    if (next === this._displayMode) return this._displayMode
    this._displayMode = next
    this.el.dataset.shellMode = next
    return next
  }

  /**
   * 开户门的按钮与摘要行（内容全部来自本拍数据，本类不编文案）。
   * @param {Array}  rows    `[{label, value}]`
   * @param {Array}  actions `[{id, label}]` → 点击回呼 `onAck(id)`
   * @param {Function} onAck
   */
  setGateContent({ title = '', rows = [], actions = [] } = {}, onAck = null) {
    this._gateHandler = onAck
    if (title) this.gateTitleEl.textContent = title
    clear(this.gateRowsEl)
    clear(this.gateActionsEl)
    for (const row of rows) {
      const rowEl = el('div', 'row', this.gateRowsEl)
      el('span', '', rowEl, row.label || '')
      el('span', 'v num', rowEl, row.value || '')
    }
    for (const action of actions) {
      const btn = el('button', 'gate-btn', this.gateActionsEl, action.label || '')
      btn.type = 'button'
      btn.dataset.requireId = action.id
      btn.addEventListener('click', () => this._gateHandler?.(action.id))
    }
  }

  destroy() {
    this.el?.remove()
    this.styleEl?.remove()
    this.extStyleEl?.remove()
    this.chapterHostEl?.remove()
    this.el = null
    this.styleEl = null
    this.extStyleEl = null
    this.chapterHostEl = null
  }
}
