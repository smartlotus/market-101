/**
 * 交易日历 —— 纯逻辑模块（PRD §2.3）。
 *
 * 周一至周五开市，周六周日休市；每次 advance() 推进 1 个自然日，
 * 交易日序号连续累加、不跳过计数（连续休市需要玩家点两次，这是刻意的教学内容）。
 *
 * 日期全部用 UTC 毫秒运算，避免宿主时区 / 夏令时影响。
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''))
  if (!m) throw new Error(`Calendar: 非法日期 "${value}"，要求 YYYY-MM-DD`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatISODate(ms) {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const da = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export class Calendar {
  constructor({ startDate = '2026-01-05' } = {}) {
    this.startDate = startDate
    this._startMs = parseISODate(startDate)
    this.reset()
  }

  reset() {
    this.dayIndex = 1
    this._ms = this._startMs
    return this
  }

  advance() {
    this._ms += DAY_MS
    this.dayIndex += 1
    return this
  }

  get inGameDate() {
    return formatISODate(this._ms)
  }

  /** 0 = 周日 … 6 = 周六 */
  get weekday() {
    return new Date(this._ms).getUTCDay()
  }

  get weekdayLabel() {
    return WEEKDAY_LABELS[this.weekday]
  }

  /** 周一–周五 true；周六周日 false。 */
  get isMarketOpen() {
    const d = this.weekday
    return d >= 1 && d <= 5
  }

  /** 休市原因；开市时为 null。Stage 0 只有周末休市（无节假日表）。 */
  get closedReason() {
    return this.isMarketOpen ? null : 'weekend'
  }

  state() {
    return {
      dayIndex: this.dayIndex,
      inGameDate: this.inGameDate,
      weekday: this.weekday,
      weekdayLabel: this.weekdayLabel,
      isMarketOpen: this.isMarketOpen,
      closedReason: this.closedReason,
    }
  }

  // === 存档 ===

  toJSON() {
    return { dayIndex: this.dayIndex, ms: this._ms }
  }

  loadFrom(data) {
    if (!data) return this
    this.dayIndex = Number(data.dayIndex) || 1
    this._ms = Number.isFinite(Number(data.ms)) ? Number(data.ms) : this._startMs
    return this
  }
}
