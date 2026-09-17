/**
 * DialogueLayerView —— 对话层：导师立绘 + 台词 + 折叠 / 静音 + 内嵌选择题（进度门禁）。
 *
 * 数据来源：`config/chapters.json` 的 `beat.mentor[]`（由运行时经 `mentor.line / speaker / conceptKey`
 * 投影）、`beat.require[]`、`beat.giveUp`、`chapter.choices`。本视图**不持有任何剧情状态**，
 * 台词、选择题、出口按钮的文案全部来自数据（视图只提供 chrome）。
 *
 * 三件事：
 *   1. **台词与立绘**：`speaker === 'offscreen'` 时不挂立绘（PRD §3.4 节拍 1「老周画外音，未露脸」），
 *      只显示一个「画外音」标示；`speaker === 'face'` 时用真实素材 `mentor_portrait`（`ui.setImage`）。
 *   2. **进度门禁**：只要本拍还挂着未完成的选择题，对话层就只呈现这道题 —— 玩家答完
 *      （`runtime.chapterAnswer`，由选择控件调用）之前，本拍不会出现任何推进控件。
 *      作答**从不判对错**：反馈文案来自数据里的 `feedbackByOption`，答错只重讲，
 *      控件永不禁用、永不加「错」标记（PRD Edge Case）。
 *      是否「答完」以运行时快照 `beatRequirements` 里那条 `choice` 的 `satisfied` 为准 —— 视图不自判。
 *   3. **折叠 / 静音**：折叠只是本视图的视觉状态；静音写进 `runtime.setMuted()`（玩家可见设置，进存档）。
 *      静音只抑制**非剧情发言**，判定在 `MentorScheduler.request()` 的单一判据里，
 *      本视图**不**做任何静音特判、也**不**在静音时补记计数（计数由运行时 `_speak()` 负责，
 *      不依赖本层是否挂载）。
 *   4. **随时可问他**（PRD §4）：呼叫入口不受「当前有没有台词」限制，点开是两个问题
 *      （「这是什么意思」/「我该怎么办」，字面与回应都来自数据 `copy.askBack`）——
 *      他给视角、不给答案。
 *
 * 不做的事：不禁用任何按钮、不加遮罩、不用纠正性提示（PRD R3 / R4）。
 */

import { el, clear } from '../kit.js'

function chapterOf(state) {
  return (state && state.chapter) || state || {}
}

const ICON_FOLD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>'
const ICON_UNFOLD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
const ICON_SOUND = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h3l4-4v14l-4-4H4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>'
const ICON_MUTE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h3l4-4v14l-4-4H4z"/><line x1="15" y1="9" x2="21" y2="15"/><line x1="21" y1="9" x2="15" y2="15"/></svg>'
const ICON_CALL = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-3.2-6.4"/><path d="M4 20l1.4-4"/><circle cx="9" cy="12" r="1"/><circle cx="13" cy="12" r="1"/><circle cx="17" cy="12" r="1"/></svg>'

/** 导师的展示名。数据文件里没有「说话人显示名」字段 —— 见交付说明的文案缺口。 */
const SPEAKER_FACE = '老周'
const SPEAKER_OFFSCREEN = '画外音'

export default class DialogueLayerView {
  constructor(root, ui, cfg = {}) {
    this.root = root
    this.ui = ui
    this.runtime = cfg.runtime || null
    this._folded = false
    this._askOpen = false
    this._askSignature = null
    this._choiceSignature = null
    this._choiceEls = []

    // 立绘
    this.portraitWrap = el('div', 'ch-portrait-wrap', root)
    this.portrait = el('img', 'ch-portrait', this.portraitWrap)
    this.portrait.alt = ''
    this.voiceEl = el('div', 'ch-voice ch-hidden', this.portraitWrap)
    const bars = el('div', 'bars', this.voiceEl)
    for (let i = 0; i < 5; i += 1) el('i', '', bars)
    el('span', '', this.voiceEl, SPEAKER_OFFSCREEN)

    // 台词
    this.sayEl = el('div', 'ch-say', root)
    const head = el('div', 'ch-say-head', this.sayEl)
    this.speakerEl = el('div', 'ch-speaker', head, '')
    this.conceptEl = el('div', 'ch-concept-tag ch-hidden', head, '')
    const tools = el('div', 'ch-say-tools', head)
    this.foldBtn = this._tool(tools, ICON_FOLD)
    this.muteBtn = this._tool(tools, ICON_SOUND)
    this.callBtn = this._tool(tools, ICON_CALL)

    this.lineEl = el('div', 'ch-line', this.sayEl, '')

    // 「随时可以问他」：两个问题（字面来自数据 `copy.askBack`），点开才占位
    this.askEl = el('div', 'ch-askbox ch-hidden', this.sayEl)

    this.choiceEl = el('div', 'ch-choicebox ch-hidden', this.sayEl)

    this.footEl = el('div', 'ch-say-foot', this.sayEl)

    this.foldBtn.addEventListener('click', () => this._toggleFold())
    this.muteBtn.addEventListener('click', () => this._toggleMute())
    this.callBtn.addEventListener('click', () => this._toggleAsk())
  }

  _tool(parent, icon) {
    const btn = el('button', 'ch-tool', parent)
    btn.type = 'button'
    btn.innerHTML = icon
    return btn
  }

  update(state) {
    const ch = chapterOf(state)
    const beat = ch.beat || null
    const mentor = ch.mentor || {}
    const mode = ch.mode || 'chapter'

    this._syncMuteButton(mentor)

    const choice = ch.pendingChoice || null
    const gated = Boolean(choice) && !this._choiceSatisfied(ch, choice)
    const interactControls = gated ? [] : this._interactControls(beat)
    const giveUp = gated ? null : (beat && beat.giveUp) || null
    const hasLine = Boolean(mentor.line)

    const visible = mode !== 'sandbox' && (hasLine || Boolean(choice) || interactControls.length > 0 || Boolean(giveUp))
    this.root.classList.toggle('ch-hidden', !visible)
    // 即使本层收起，也要把台词投影落定 —— 否则隐藏的 DOM 会留着上一拍的文本
    this._renderLine(mentor)
    // 门禁状态先于可见性落定，避免隐藏时留下过期的强调
    this._applyGate(gated)
    if (!visible) return

    this.root.classList.toggle('folded', this._folded)
    // 有未答题时不折叠，保证题目始终在屏上（折叠只是视觉状态，不是门禁）
    this.root.classList.toggle('bandless', ch.shellMode !== 'hidden')

    this._renderPortrait(mentor, hasLine)
    this._renderAsk(ch)
    this._renderChoice(choice, ch)
    this._renderFoot(interactControls, giveUp, beat)
  }

  // === 立绘 / 台词 ===

  _renderPortrait(mentor, hasLine) {
    const offscreen = mentor.speaker === 'offscreen'
    this.portraitWrap.classList.toggle('offscreen', !hasLine || offscreen)
    this.voiceEl.classList.toggle('ch-hidden', !(!hasLine || offscreen))
    if (!hasLine || offscreen) return
    try {
      this.ui.setImage(this.portrait, 'mentor_portrait')
    } catch (err) {
      console.warn('DialogueLayerView: mentor_portrait unavailable', err)
    }
  }

  _renderLine(mentor) {
    this.speakerEl.textContent = mentor.speaker === 'offscreen' ? SPEAKER_OFFSCREEN : SPEAKER_FACE
    this.lineEl.textContent = mentor.line || ''
    const concept = mentor.conceptKey || ''
    this.conceptEl.classList.toggle('ch-hidden', !concept)
    this.conceptEl.textContent = concept
  }

  _syncMuteButton(mentor) {
    const muted = Boolean(mentor.muted)
    this.muteBtn.classList.toggle('on', muted)
    this.muteBtn.innerHTML = muted ? ICON_MUTE : ICON_SOUND
    this.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false')
    // 呼叫入口**随时可用**：不再以「当前有没有台词」为门禁（PRD §4 追问随时可发）。
    this.callBtn.style.display = 'inline-flex'
  }

  _toggleFold() {
    this._folded = !this._folded
    this.root.classList.toggle('folded', this._folded)
    this.foldBtn.innerHTML = this._folded ? ICON_UNFOLD : ICON_FOLD
    this.foldBtn.setAttribute('aria-pressed', this._folded ? 'true' : 'false')
  }

  _toggleMute() {
    const ch = this.runtime && typeof this.runtime.snapshot === 'function' ? this.runtime.snapshot() : null
    const muted = Boolean(ch && ch.mentor && ch.mentor.muted)
    this.runtime?.setMuted?.(!muted)
  }

  _toggleAsk() {
    this._askOpen = !this._askOpen
    this.askEl.classList.toggle('ch-hidden', !this._askOpen)
    this.callBtn.classList.toggle('on', this._askOpen)
    this.callBtn.setAttribute('aria-pressed', this._askOpen ? 'true' : 'false')
  }

  /**
   * 两个问题（PRD §4「随时可以问他」）：字面与回应都来自数据 `copy.askBack`。
   * 本视图只渲染，不发散——**他给视角不给答案**这条约束落在数据与运行时上，不靠视图自觉。
   */
  _renderAsk(ch) {
    const askBack = (ch.copy && ch.copy.askBack) || {}
    const prompt = askBack.prompt ? String(askBack.prompt) : ''
    const entries = ['meaning', 'action']
      .map((key) => ({ key, entry: askBack[key] }))
      .filter((item) => item.entry && item.entry.label)
    const signature = `${prompt}|${entries.map((it) => `${it.key}:${it.entry.label}`).join('|')}`
    if (signature === this._askSignature) return
    this._askSignature = signature
    clear(this.askEl)

    if (prompt) el('div', 'ch-question', this.askEl, prompt)
    for (const { key, entry } of entries) {
      const btn = el('button', 'ch-ask-opt', this.askEl)
      btn.type = 'button'
      btn.dataset.question = key
      btn.textContent = String(entry.label)
      btn.addEventListener('click', () => {
        this.runtime?.callMentor?.({ question: key })
        this._toggleAsk()
      })
    }
  }

  // === 内嵌选择题（进度门禁）===

  _choiceSatisfied(ch, choice) {
    const requires = ch.beatRequirements || []
    return requires.some((r) => r.kind === 'choice' && r.choiceId === choice.id && r.satisfied)
  }

  _renderChoice(choice, ch) {
    if (!choice) {
      this.choiceEl.classList.add('ch-hidden')
      clear(this.choiceEl)
      this._choiceEls = []
      this._choiceSignature = null
      return
    }
    const signature = `${choice.id}::${choice.answeredKey || ''}`
    this.choiceEl.classList.remove('ch-hidden')
    if (signature === this._choiceSignature) return
    this._choiceSignature = signature
    clear(this.choiceEl)
    this._choiceEls = []

    el('div', 'ch-question', this.choiceEl, choice.question || '')
    for (const option of choice.options || []) {
      const btn = el('button', 'ch-opt', this.choiceEl)
      btn.type = 'button'
      btn.dataset.choiceId = choice.id
      btn.dataset.key = option.key
      el('span', 'mk', btn)
      el('span', '', btn, option.text || '')
      btn.classList.toggle('picked', choice.answeredKey === option.key)
      btn.addEventListener('click', () => this.runtime?.chapterAnswer?.(choice.id, option.key))
      this._choiceEls.push(btn)
    }
    // 反馈：来自数据里的 feedbackByOption，恒不带对错判定（答错只重讲）
    const feedback = choice.answeredKey ? (choice.feedbackByOption || {})[choice.answeredKey] : ''
    if (feedback) el('div', 'ch-feedback', this.choiceEl, feedback)
  }

  // === 门禁与推进控件 ===

  /**
   * 门禁的呈现**只有视觉强调**：未答完时把选择框提到最前（金色上边线），
   * 并且本拍不生成任何推进控件。禁用按钮 / 灰掉一行 / 蒙一层遮罩都是被 PRD R3 禁止的手段。
   */
  _applyGate(gated) {
    this.root.classList.toggle('gated', Boolean(gated))
  }

  /**
   * 本拍由对话层拥有的推进控件：非 `opensPanel`、非 `simAction` 的 `interact`（如节拍 1.0 的「开始」）。
   *
   * `gate` 条目（第四章的配对卡 / 流程走查步）**不在这里生成控件**：它们只能由对应的互动
   * （`chapterMatch` / `chapterFlowStep`）满足 —— 否则对话层会凭空长出一排「一键完成配对」的按钮，
   * 把本章的核心互动整个绕过去。这不是门禁：控件没被禁用，只是它本来就不该在这儿。
   */
  _interactControls(beat) {
    const requires = (beat && beat.require) || []
    return requires.filter(
      (r) =>
        r &&
        r.kind === 'interact' &&
        !r.opensPanel &&
        !r.gate &&
        !(Array.isArray(r.simAction) && r.simAction.length),
    )
  }

  _renderFoot(interactControls, giveUp, beat) {
    const signature = [
      beat ? beat.id : '',
      interactControls.map((r) => r.id).join(','),
      giveUp ? giveUp.id : '',
    ].join('|')
    if (signature === this._footSignature) return
    this._footSignature = signature
    clear(this.footEl)

    for (const spec of interactControls) {
      const btn = el('button', 'ch-btn', this.footEl, spec.label || '')
      btn.type = 'button'
      btn.dataset.requireId = spec.id
      btn.addEventListener('click', () => this.runtime?.chapterAck?.(spec.id))
    }

    if (beat && beat.giveUp) {
      const label = beat.giveUp.label || ''
      if (label) {
        const btn = el('button', 'ch-btn ghost', this.footEl, label)
        btn.type = 'button'
        btn.dataset.giveUpId = beat.giveUp.id
        btn.addEventListener('click', () => this._giveUp(beat))
      }
    }
  }

  /**
   * 「我暂时不想试」出口（PRD Edge Cases）：运行时**代为演示一次**该拒单并让本拍完成。
   * 演示回放需要宿主 Node 参与，因此这里把 `demo` 交给宿主：
   * 派发冒泡事件 `chapter-giveup-demo`，宿主按同一份数据回放，不在视图里复制撮合逻辑。
   */
  _giveUp(beat) {
    const result = this.runtime?.giveUp?.(beat.id)
    if (!result || !result.ok || !result.demo) return
    this.root.dispatchEvent(
      new CustomEvent('chapter-giveup-demo', {
        bubbles: true,
        detail: { beatId: beat.id, demo: result.demo },
      }),
    )
  }

  destroy() {
    clear(this.choiceEl)
    clear(this.footEl)
    clear(this.askEl)
    this._choiceEls = []
  }
}
