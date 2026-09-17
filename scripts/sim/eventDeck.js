/**
 * 事件抽签池 —— 纯逻辑模块（PRD §3.3）。
 *
 * 规则：从 20 件事件池中随机抽取一件**本轮未使用过**的；全部用过则重新洗牌、
 * 轮次 +1，允许同一事件在**不同轮次**再次出现，同一轮内绝不重复。
 *
 * 对外只暴露「事件内容 + 牌堆状态」，不暴露牌堆内部数组，避免外部误改。
 */

/**
 * `targets` 哨兵：命中全部标的（PRD §3.3，GDD 事件池 M01–M03 / P01 / B01）。
 * **全项目唯一定义处** —— 谁要判断「是否全场事件」都必须走 `eventTargetsInstrument()`，
 * 不得在别处再写一遍 'ALL' 字面量。
 */
export const ALL_TARGETS = 'ALL'

/** 事件对某标的是否生效：targets 命中该标的，或为全场哨兵（展开为全部标的）。 */
export function eventTargetsInstrument(event, instrumentId) {
  if (!event) return false
  const targets = Array.isArray(event.targets) ? event.targets : []
  return targets.includes(ALL_TARGETS) || targets.includes(instrumentId)
}

/** 把事件裁剪成 Runtime 契约里的公开字段（不透出内部字段，也不让外部改到池子）。 */
export function toPublicEvent(event) {
  if (!event) return null
  return {
    id: event.id,
    type: event.type,
    targets: Array.isArray(event.targets) ? [...event.targets] : [],
    sentiment: event.sentiment,
    magnitude: event.magnitude,
    fxTarget: event.fxTarget ?? null,
    headline: event.headline,
    mentorLine: event.mentorLine,
  }
}

export class EventDeck {
  constructor(events = []) {
    this._events = Array.isArray(events) ? events.map((e) => ({ ...e })) : []
    this._byId = new Map(this._events.map((e) => [e.id, e]))
    this.total = this._events.length
    this._forced = null
    this.reset()
  }

  reset() {
    this.cycle = 1
    this.usedIds = []
    this.drawnThisCycle = 0
    this._forced = null
    return this
  }

  /** 供测试固定事件：下一次 drawNext() 直接吐出这一件。 */
  forceEvent(spec) {
    this._forced = { ...(spec || {}) }
    return this._forced
  }

  get remaining() {
    return Math.max(0, this.total - this.usedIds.length)
  }

  /** 抽下一件。池空则洗牌开启新一轮。返回 null 表示池子为空。 */
  drawNext() {
    if (this._forced) {
      const forced = this._forced
      this._forced = null
      this._consume(forced)
      return forced
    }
    if (this.total === 0) return null
    if (this.usedIds.length >= this.total) {
      this.cycle += 1
      this.usedIds = []
      this.drawnThisCycle = 0
    }
    const available = this._events.filter((e) => !this.usedIds.includes(e.id))
    const picked = available[Math.floor(Math.random() * available.length)]
    this._consume(picked)
    return picked
  }

  /**
   * 把一件事件标记为本轮已用。
   * 池内存在的 id 才计入（白盒测试可以塞入池外的事件，不影响牌堆计数）。
   */
  markUsed(id) {
    if (!this._byId.has(id)) return false
    if (!this.usedIds.includes(id)) {
      this.usedIds.push(id)
      this.drawnThisCycle = this.usedIds.length
    }
    return true
  }

  _consume(event) {
    if (event && event.id) this.markUsed(event.id)
  }

  state() {
    return {
      total: this.total,
      cycle: this.cycle,
      drawnThisCycle: this.drawnThisCycle,
      usedIds: [...this.usedIds],
    }
  }

  // === 存档 ===

  toJSON() {
    return { cycle: this.cycle, usedIds: [...this.usedIds], drawnThisCycle: this.drawnThisCycle }
  }

  loadFrom(data) {
    if (!data) return this
    this.cycle = Number(data.cycle) || 1
    this.usedIds = Array.isArray(data.usedIds) ? data.usedIds.filter((id) => this._byId.has(id)) : []
    this.drawnThisCycle = this.usedIds.length
    this._forced = null
    return this
  }
}
