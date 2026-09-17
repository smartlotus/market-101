/**
 * 交易日历 —— 纯逻辑模块（PRD §2.3 / GDD `### 交易日历`）。
 *
 * 一个「交易日」= 推进 1 个自然日。每次 advance() 日期 +1，交易日序号连续累加、
 * 不跳过计数（连续休市要玩家点两次，这是刻意的教学内容）。
 *
 * 各市场休市规则不同，因此日历提供**按市场**判断：
 *   - CN 系（A股 / ETF / 基金 / 期权）：周一至周五，周六周日休
 *   - 港股：同 CN 系，另加 H_CN = {1/1, 2/10–2/12(春节), 5/1, 10/1–10/3(国庆)}
 *   - 美股：周一至周五，另加 H_US = {1/1, 7/4, 11月第4个周四(感恩节), 12/25}
 *   - 加密货币：7×24 **永不休市**
 *
 * 日期全部用 UTC 毫秒运算，避免宿主时区 / 夏令时影响。
 */

const DAY_MS = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

/** 港股与 CN 系共用的小节假日表（月-日）。春节按 GDD 的 2/10–2/12 简化为固定日期。 */
const H_CN = ['01-01', '02-10', '02-11', '02-12', '05-01', '10-01', '10-02', '10-03']
/** 美股节假日（固定月日 + 感恩节单独算）。 */
const H_US = ['01-01', '07-04', '12-25']

/** 该市场是否 7×24 永不休市。 */
const ALWAYS_OPEN = ['CRYPTO']
/** 使用 CN 日历的市场（含港股，港股在此基础上再加 H_CN）。 */
const CN_MARKETS = ['A_SHARE', 'ETF', 'FUND', 'OPTION']
const HK_MARKETS = ['HK']
const US_MARKETS = ['US']

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

/** 11 月的第 4 个周四（感恩节）的「月-日」。 */
function thanksgivingMonthDay(year) {
  let count = 0
  for (let day = 1; day <= 30; day += 1) {
    const wd = new Date(Date.UTC(year, 10, day)).getUTCDay()
    if (wd === 4) {
      count += 1
      if (count === 4) return `11-${String(day).padStart(2, '0')}`
    }
  }
  return '11-22'
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

  get year() {
    return new Date(this._ms).getUTCFullYear()
  }

  /** 0 = 周日 … 6 = 周六 */
  get weekday() {
    return new Date(this._ms).getUTCDay()
  }

  get weekdayLabel() {
    return WEEKDAY_LABELS[this.weekday]
  }

  get monthDay() {
    return this.inGameDate.slice(5)
  }

  /** 周一–周五 true；周六周日 false。（CN 系语义，Stage 0 契约不变） */
  get isMarketOpen() {
    const d = this.weekday
    return d >= 1 && d <= 5
  }

  /** 休市原因；开市时为 null。 */
  get closedReason() {
    return this.isMarketOpen ? null : 'weekend'
  }

  /**
   * 该市场今日是否开市。
   * @param {string} market A_SHARE / ETF / FUND / HK / US / CRYPTO / OPTION
   */
  isOpenFor(market) {
    const iso = this.inGameDate
    if (ALWAYS_OPEN.indexOf(market) >= 0) return true
    const md = this.monthDay
    if (US_MARKETS.indexOf(market) >= 0) {
      if (!this.isMarketOpen) return false
      if (H_US.indexOf(md) >= 0) return false
      if (md === thanksgivingMonthDay(this.year)) return false
      return true
    }
    if (HK_MARKETS.indexOf(market) >= 0) {
      if (!this.isMarketOpen) return false
      if (H_CN.indexOf(md) >= 0) return false
      return true
    }
    if (CN_MARKETS.indexOf(market) >= 0) {
      if (!this.isMarketOpen) return false
      // A 股/ETF/基金/期权 也吃 H_CN（契约里写「同 CN 节假日」）
      if (H_CN.indexOf(md) >= 0) return false
      return true
    }
    // 未知市场退化为 CN 语义
    return this.isMarketOpen
  }

  /** 该市场今日休市的原因（开市为 null）。 */
  closedReasonFor(market) {
    if (this.isOpenFor(market)) return null
    if (!this.isMarketOpen) return 'weekend'
    return 'holiday'
  }

  /** 当前开市的市场集合（快照给 UI 与测试用）。 */
  openMarkets(markets = ['A_SHARE', 'ETF', 'FUND', 'HK', 'US', 'CRYPTO', 'OPTION']) {
    return markets.filter((m) => this.isOpenFor(m))
  }

  state() {
    return {
      dayIndex: this.dayIndex,
      inGameDate: this.inGameDate,
      weekday: this.weekday,
      weekdayLabel: this.weekdayLabel,
      isMarketOpen: this.isMarketOpen,
      closedReason: this.closedReason,
      openMarkets: this.openMarkets(),
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

export default Calendar
