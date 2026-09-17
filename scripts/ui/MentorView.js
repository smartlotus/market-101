/**
 * MentorView —— 导师面板（PRD §2.5 / §3.4「安全失败」/ lead 裁决 R10）。
 *
 * 使用真实素材 `mentor_portrait` + 一句与当前语境匹配的文案。
 * 语境优先级：拒单后的温和解释 > 当日事件 mentorLine > 休市说明 > 账户状态静态提示。
 *
 * ---- Stage 1 的「两个老周」问题（lead 裁决 R10，采用方案 B）----
 * 章节对话层共用同一份立绘；若本面板在章内继续输出台词，同屏会出现两个老周在说话。
 * 因此：**`mode === 'chapter'` 时本视图降级为静态** ——
 *   - 只显示立绘 + 中性标签（`导师 · 周老师`），`say` / `foot` 两行**不输出任何台词**；
 *   - 章内一切导师发言只走 `scripts/ui/chapter/DialogueLayerView.js`（`chapter.mentor.line`）；
 *   - `mode === 'freeDay'` / `'sandbox'`（以及没有章节快照时的纯 eval 用法）恢复 Stage 0 行为。
 *
 * 本视图不读 `state.chapter.mentor.line`（那是对话层的输入），因此结构上不可能在章内抢话。
 */

import { el, fmtMoney, fmtSignedMoney, setText } from './kit.js'

const GENERIC_REJECT_LINE =
  '这笔委托没成功，但没损失任何东西 —— 拒单是交易所规则在保护你，看懂原因比蒙对一次更重要。'

/** 章内的中性标签（不构成任何台词）。 */
const STATIC_LABEL = '导师 · 周老师'

export default class MentorView {
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.rejectLines = cfg.rejectMentorLines || {}

    const portrait = el('img', 'portrait', root)
    portrait.alt = '导师周老师'
    ui.setImage(portrait, 'mentor_portrait')

    const body = el('div', 'body', root)
    el('div', 'who', body, STATIC_LABEL)
    this.sayEl = el('div', 'say', body, '')
    this.footEl = el('div', 'foot', body, '提示会随当日新闻与你的操作更新')
  }

  update(state) {
    const chapter = state && state.chapter ? state.chapter : null
    const chapterMode = Boolean(chapter) && chapter.mode === 'chapter'
    // 章内静态：立绘 + 中性标签，绝不出现第二张嘴（R10）
    this.root.classList.toggle('static', chapterMode)
    if (chapterMode) {
      setText(this.sayEl, '')
      setText(this.footEl, '')
      this.root.dataset.mentorStatic = '1'
      return
    }
    delete this.root.dataset.mentorStatic
    setText(this.footEl, '提示会随当日新闻与你的操作更新')
    setText(this.sayEl, this._line(state))
  }

  _line(state) {
    const last = state.lastOrder
    if (last && !last.accepted) {
      const gentle = this.rejectLines[last.reasonCode] || GENERIC_REJECT_LINE
      return `${last.rejectText}。${gentle}`
    }
    if (state.currentEvent && state.currentEvent.mentorLine) {
      return state.currentEvent.mentorLine
    }
    if (!state.isMarketOpen) {
      return '今天周末休市，交易所在休息。日历本身也是 A 股的一课 —— 习惯了它的节奏，你就不会在关市的时候着急。'
    }
    return this._accountLine(state)
  }

  /** 与账户状态相关的静态提示（非事件日 / 事件无 mentorLine 时兜底） */
  _accountLine(state) {
    const positions = state.positions || []
    if (positions.length === 0) {
      if (state.cash >= 100000) {
        return `你手上是 ${fmtMoney(state.cash)} 现金，还没有任何持仓 —— 空仓也是一种仓位。先看清价格为什么动，再决定买不买。`
      }
      return `你现在空仓，可用资金 ${fmtMoney(state.cash)}。练手可以从一手买得起的标的开始，先感受「委托 → 成交 → 持仓」这条链。`
    }
    const pnl = fmtSignedMoney(state.unrealizedPnL)
    if (positions.length === 1 && state.unrealizedPnL > 0) {
      return `你现在持有 1 只标的，账面浮动 ${pnl}。把赚到的钱继续留在市场里，就是复利的雏形 —— 不过没卖出之前，盈亏都只是账面数字。`
    }
    if (positions.length >= 3) {
      return `你已经持有 ${positions.length} 只标的，账面浮动 ${pnl}。分散持有能减少「一只出事全盘皆输」的风险，但也别买自己看不懂的东西。`
    }
    return `你现在持有 ${positions.length} 只标的，账面浮动 ${pnl}。价格每天动，但公司的生意不会每天变 —— 想清楚你买的是价格还是价值。`
  }
}
