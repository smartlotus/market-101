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

/** 「下一步」区的两个标题词。数据文件里没有这两句 —— 见交付说明的文案缺口。 */
const NEXT_PREFIX = '下一步'
const NEXT_DONE_PREFIX = '本拍都做完了'

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

    /**
     * 「下一步」—— 把本拍**未完成**的完成条件的 `label` 明写出来。
     *
     * 为什么必须要有：完成条件的 label 一直存在于运行时快照里
     * （`chapter.beatRequirements[].label`，如「点开存单」「读完存单上的两个数字」），
     * 但此前**没有任何视图渲染它** —— 玩家只看到一个可点的物件，
     * 不知道那是不是「该点的地方」、也不知道还有几件事要做。
     * 这是「节拍提示不出现 / 不知道下一步点哪」的直接原因。
     *
     * 纪律：只印数据里已有的 `label`，视图不编文案（缺 label 就不显示该行）。
     * 完成条件全部满足时不留空块，改为一句完成态，避免玩家以为还有事没做。
     */
    this.nextEl = el('div', 'ch-next', this.cardEl)
    this.nextHead = el('div', 'nh', this.nextEl)
    this.nextKey = el('div', 'k', this.nextHead, '')
    this.nextCount = el('div', 'n num', this.nextHead, '')
    this.nextList = el('div', 'ch-next-list', this.nextEl)

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
    this._renderNext(ch)
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
   * 下一步：本拍未完成的完成条件，逐条印出数据里的 `label`。
   *
   * 加演 / 补救段期间不显示（那两段有自己的 `label` 与流程，见 `extraSegment`），
   * 避免与段内的引导重复甚至矛盾。
   */
  _renderNext(ch) {
    const reqs = Array.isArray(ch.beatRequirements) ? ch.beatRequirements : []
    const pending = reqs.filter((r) => r && !r.satisfied && r.label)
    // 段内交给段自己引导；没有完成条件（如纯叙事拍）也没有「下一步」可言
    const show = !ch.extraSegment && reqs.length > 0 && Boolean(ch.beatId)
    this.nextEl.classList.toggle('ch-hidden', !show)
    if (!show) return

    const signature = pending.map((r) => r.id).join('|') + '#' + (reqs.length - pending.length)
    if (signature === this._nextSignature) return
    this._nextSignature = signature

    const done = reqs.length - pending.length
    this.nextKey.textContent = pending.length ? NEXT_PREFIX : NEXT_DONE_PREFIX
    this.nextCount.textContent = `${done} / ${reqs.length}`
    this.nextEl.classList.toggle('all-done', pending.length === 0)

    clear(this.nextList)
    for (const r of pending) {
      const row = el('div', 'row', this.nextList)
      row.dataset.kind = String(r.kind || '')
      row.dataset.reqId = String(r.id || '')
      el('span', 'mk', row, '')
      el('span', 'tx', row, String(r.label))
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
