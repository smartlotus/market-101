/**
 * GoalCardView —— 章目标卡（章内常驻，角落）。
 *
 * 四个要素全部来自 `config/chapters.json` 与运行时快照（PRD §2.3 / §3.6）：
 *   1. 「本章要什么」 —— `chapter.goalCard.title` + `goalCard.teach[]`（概念 key，
 *      有词典时显示词典里的名字，否则显示 key 本身）。
 *   2. 「本章还剩 X 个节拍」 —— `remainingBeats`。加演段（A 级）/ 补救段（D 级）**不计入** `beatCount`
 *      （PRD Edge Case）：段内不显示「还剩 X 个节拍」，改显示数据里那段自己的 `label`
 *      （`settlement.extraSegments.*.label` = 「加演」/「再摆一次」）。
 *   3. `graded === false` 时明写 `noScoreLabel`（「本章不打分」）—— 公开口径，不得静默丢弃。
 *   4. 黄档（¥10,000 ≤ NAV < ¥50,000）/ 红档（NAV < ¥10,000）追加 `yellowLine` 与
 *      `topUpLabel`（「补足本金」）按钮 → `runtime.devTopUpCapital()`（与 eval 钩子同一路径，
 *      外来入金由运行时记账）。
 *
 * 另外如实暴露本章**未赶上的定向事件**（`directedEvents.owed`，PRD §3.8：「可见、不隐藏」）。
 *
 * 不做的事：不因为资金档位就禁用任何操作、不加遮罩（PRD R3）。黄档只给一行字和一个按钮。
 */

import { el, clear } from '../kit.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

/** 「本章还剩 X 个节拍」的模板。数据文件里没有这句 —— 见交付说明的文案缺口。 */
const REMAINING_PREFIX = '本章还剩'
const REMAINING_SUFFIX = '个节拍'

export default class GoalCardView {
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null
    this.conceptByKey = new Map((Array.isArray(cfg.concepts) ? cfg.concepts : []).map((c) => [c.key, c]))

    this.cardEl = el('div', 'ch-card ch-goal', root)
    this.headEl = el('div', 'hd', this.cardEl)
    this.headKey = el('div', 'k', this.headEl, '')
    this.headBeat = el('div', 'n', this.headEl, '')

    this.titleEl = el('div', 'ch-goal-title', this.cardEl, '')
    this.teachEl = el('div', 'ch-goal-teach', this.cardEl)

    this.rowsEl = el('div', 'ch-goal-rows', this.cardEl)
    this.remainingEl = el('div', 'ch-grow', this.rowsEl)
    this.remainingKey = el('div', '', this.remainingEl, '')
    this.remainingVal = el('div', 'v num', this.remainingEl, '')
    this.segmentEl = el('div', 'ch-seg ch-hidden', this.rowsEl)
    this.segmentLabel = el('div', '', this.segmentEl, '')
    this.segmentTag = el('div', 'tag', this.segmentEl, '')

    this.noScoreEl = el('div', 'ch-noscore ch-hidden', this.cardEl, '')
    this.tierEl = el('div', 'ch-tier ch-hidden', this.cardEl)
    this.tierLine = el('div', 'line', this.tierEl, '')
    this.topUpBtn = el('button', 'ch-btn gold sm', this.tierEl, '')
    this.topUpBtn.type = 'button'
    this.topUpBtn.addEventListener('click', () => this.runtime?.devTopUpCapital?.())

    this.owedEl = el('div', 'ch-owed ch-hidden', this.cardEl)
    this.owedKey = el('div', 'k', this.owedEl, '')
    this.owedChips = el('div', 'chips', this.owedEl)

    this._teachSignature = null
    this._owedSignature = null
  }

  update(state) {
    const ch = chapterOf(state)
    const goal = ch.goalCard || null
    // 沙盒无目标卡、无引导（PRD §3.2）；自由交易日只显示自由窗口卡
    const visible = Boolean(goal) && ch.mode === 'chapter'
    this.root.classList.toggle('ch-hidden', !visible)
    this.cardEl.classList.toggle('ch-hidden', !visible)
    if (!visible) return

    this.headKey.textContent = ch.chapterName || ''
    this.headBeat.textContent = ch.beatTitle || ''
    this.titleEl.textContent = goal.title || ''

    this._renderTeach(goal.teach || [])
    this._renderRemaining(ch)
    this._renderGraded(goal)
    this._renderTier(ch, goal)
    this._renderOwed(ch)
  }

  _renderTeach(teach) {
    const signature = teach.join('|')
    if (signature === this._teachSignature) return
    this._teachSignature = signature
    clear(this.teachEl)
    for (const key of teach) {
      const concept = this.conceptByKey.get(key)
      const chip = el('span', 'ch-chip', this.teachEl)
      chip.textContent = concept ? concept.name : key
      chip.dataset.conceptKey = key
    }
  }

  /**
   * 剩余节拍：加演 / 补救段期间**不变**，且不显示为「还剩 X 个节拍」——
   * 段内改为显示那段数据自己的 `label` 与 `kind`（PRD Edge Case）。
   */
  _renderRemaining(ch) {
    const seg = ch.extraSegment
    if (seg) {
      this.remainingEl.classList.add('ch-hidden')
      this.segmentEl.classList.remove('ch-hidden')
      this.segmentLabel.textContent = seg.label || ''
      this.segmentTag.textContent = seg.kind || ''
      return
    }
    this.remainingEl.classList.remove('ch-hidden')
    this.segmentEl.classList.add('ch-hidden')
    const remaining = Number(ch.remainingBeats)
    this.remainingKey.textContent = REMAINING_PREFIX
    this.remainingVal.textContent = `${Number.isFinite(remaining) ? remaining : 0} ${REMAINING_SUFFIX}`
  }

  _renderGraded(goal) {
    const ungraded = goal.graded === false
    this.noScoreEl.classList.toggle('ch-hidden', !ungraded)
    if (ungraded) this.noScoreEl.textContent = goal.noScoreLabel || ''
  }

  _renderTier(ch, goal) {
    const tier = ch.moneyTier
    const active = tier === 'yellow' || tier === 'red'
    this.tierEl.classList.toggle('ch-hidden', !active || !goal.yellowLine)
    this.tierEl.classList.toggle('red', tier === 'red')
    if (!active || !goal.yellowLine) return
    this.tierLine.textContent = goal.yellowLine
    this.topUpBtn.textContent = goal.topUpLabel || ''
    this.topUpBtn.classList.toggle('ch-hidden', !goal.topUpLabel)
  }

  /** 定向事件队列的实到 / 未到如实暴露（`owed` 可以非零且不阻塞推进，PRD §3.8）。 */
  _renderOwed(ch) {
    const directed = ch.directedEvents || {}
    const owed = Array.isArray(directed.owed) ? directed.owed : []
    const signature = owed.join('|')
    this.owedEl.classList.toggle('ch-hidden', owed.length === 0)
    if (signature === this._owedSignature) return
    this._owedSignature = signature
    clear(this.owedChips)
    for (const id of owed) {
      const chip = el('span', 'ch-chip', this.owedChips)
      chip.textContent = id
    }
  }

  destroy() {
    clear(this.teachEl)
    clear(this.owedChips)
  }
}
