/**
 * 一次性验证脚本（不入库；位于 .vibegame/tmp/）。删除或保留均可。
 * 目的：在 Node 里无头驱动 ChapterRuntime，断言 plan.md 要求的那几条。
 *
 * 项目没有 package.json（.js 默认被当成 CJS），所以先把 scripts/**\/*.js 镜像成
 * .mjs（重写相对 import 说明符），再 import 镜像目录。
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..')
const mirror = path.join(here, 'mirror')

rmSync(mirror, { recursive: true, force: true })

function mirrorDir(fromDir, toDir) {
  mkdirSync(toDir, { recursive: true })
  for (const name of readdirSync(fromDir)) {
    const from = path.join(fromDir, name)
    const to = path.join(toDir, name)
    if (statSync(from).isDirectory()) {
      mirrorDir(from, to)
      continue
    }
    if (!name.endsWith('.js')) continue
    const out = to.replace(/\.js$/, '.mjs')
    const src = readFileSync(from, 'utf8').replace(
      /(from\s*['"])(\.\.?\/[^'"]+?)(['"])/g,
      (m, a, spec, c) => `${a}${spec.replace(/\.js$/, '.mjs')}${c}`,
    )
    writeFileSync(out, src)
  }
}

mirrorDir(path.join(repo, 'scripts'), path.join(mirror, 'scripts'))

const { ChapterRuntime } = await import(pathToFileURL(path.join(mirror, 'scripts', 'chapter', 'runtime.mjs')).href)
const { computeRating, gradeOf, RATING_PARAMS, RATING_THRESHOLDS, MONEY_TIERS } = await import(
  pathToFileURL(path.join(mirror, 'scripts', 'chapter', 'rating.mjs')).href
)
const { SAVE_SCHEMA, saveWhitelistKeys, SAVE_VERSION } = await import(
  pathToFileURL(path.join(mirror, 'scripts', 'chapter', 'saveStore.mjs')).href
)
const chaptersDoc = JSON.parse(readFileSync(path.join(repo, 'config', 'chapters.json'), 'utf8'))

// ---------------------------------------------------------------- 断言工具
let passed = 0
const failures = []
function ok(cond, label, extra = '') {
  if (cond) {
    passed += 1
    return true
  }
  failures.push(`${label}${extra ? ` :: ${extra}` : ''}`)
  if (process.env.FAIL_FAST) throw new Error(`${label}${extra ? ` :: ${extra}` : ''}`)
  return false
}
function eq(actual, expected, label) {
  return ok(
    JSON.stringify(actual) === JSON.stringify(expected),
    label,
    `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`,
  )
}

// ---------------------------------------------------------------- 假市场层端口
class FakeSim {
  constructor({ nav = 100000 } = {}) {
    this.navValue = nav
    this.opened = false
    this.funded = false
    this.dayOpen = false
    this.queue = []
    this.directedDrawn = []
    this.dayCount = 0
    this.currentEvent = null
    this.pins = []
    this.clears = 0
  }
  openAccount() {
    this.opened = true
    return true
  }
  fundInitial() {
    if (!this.funded) {
      this.funded = true
      this.navValue = 100000
    }
    return true
  }
  beginFirstDay() {
    if (this.dayOpen) return false
    this.dayOpen = true
    this._consume()
    return true
  }
  advanceDay() {
    if (!this.dayOpen) return this.beginFirstDay()
    this._consume()
    return this
  }
  _consume() {
    this.dayCount += 1
    if (this.queue.length) {
      const id = this.queue.shift()
      this.directedDrawn.push(id)
      this.currentEvent = { id }
    }
  }
  setDirectedEventQueue(ids) {
    this.queue = [...ids]
    return this.queue
  }
  pinDirectedEvent(id) {
    this.pins.push(id)
    if (!this.queue.includes(id) && !this.directedDrawn.includes(id)) this.queue.unshift(id)
    return true
  }
  clearResidualState() {
    this.clears += 1
    return this
  }
  topUpCapital() {
    const before = this.navValue
    const injection = Math.max(0, 100000 - before)
    this.navValue += injection
    return { navBefore: before, injection }
  }
  submitOrder(spec) {
    return { accepted: true, status: 'filled', reasonCode: 'OK', side: spec.side, type: spec.type, fee: 6, notional: 620 }
  }
  snapshot() {
    return { NAV: this.navValue, dayOpen: this.dayOpen, currentEvent: this.currentEvent }
  }
  toJSON() {
    return { market: 'A_SHARE', directedDrawn: [...this.directedDrawn], nextEventQueue: [...this.queue] }
  }
}

function newRuntime({ sim = new FakeSim(), saveStore = null, config = {} } = {}) {
  return new ChapterRuntime({ chapters: chaptersDoc, sim, saveStore, config })
}

function reject(sim, reasonCode) {
  const result = { accepted: false, status: 'rejected', reasonCode, side: 'buy', type: 'limit', fee: 0, notional: 0 }
  sim.navValue = sim.navValue
  return result
}

const CH1_IDS = ['1.0', '1.1', '1.2', '1.3', '1.4', '1.5', '1.5.5', '1.6', '1.7', '1.8', '1.9']
const CH2_IDS = ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7']

// ================================================================ 1. 开局状态
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  const s = rt.snapshot()
  eq(s.chapterId, 1, '开局 chapterId=1')
  eq(s.beatId, '1.0', '开局 beatId=1.0')
  eq(s.beatIndex, 0, '开局 beatIndex=0')
  eq(s.mode, 'chapter', '开局 mode=chapter')
  eq(s.shellMode, 'hidden', '开局券商壳 hidden')
  eq(s.beatCount, 11, '第一章 beatCount=11')
  eq(s.remainingBeats, 11, '第一章 remainingBeats=11')
  eq(s.goalCard.graded, false, '第一章 goalCard.graded=false')
  eq(s.goalCard.noScoreLabel, '本章不打分', '第一章明写「本章不打分」')
  eq(s.rating, null, '开局 rating=null')
  eq(s.remedialUsedThisChapter, false, '开局 remedialUsedThisChapter=false')
  eq(s.directedEvents, { required: ['I04', 'C03'], drawn: [], owed: ['I04', 'C03'] }, '第一章定向事件未到')
  ok(s.beatRequirements.length === 1 && s.beatRequirements[0].kind === 'interact', '1.0 只有一个 interact 条件')
  // 章节边界重置一次外围状态
  const rt2 = newRuntime({ sim: new FakeSim() })
  eq(rt2.chapterId ?? rt2.snapshot().chapterId, 1, '构造即落在第一章节拍 0')
}

// ================================================================ 2. 逐拍走完第一章
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  const seen = []
  let guard = 0
  while (rt.snapshot().chapterId === 1 && !rt.snapshot().chapterEndReached && guard++ < 40) {
    const beat = rt.beatData()
    const before = rt.snapshot().beatIndex
    seen.push(rt.snapshot().beatId)
    // 负例：没有任何 require 时不给推进路径
    if (before === 2) rt.chapterAck('nope')
    eq(rt.snapshot().beatIndex, before, `${beat.id} 未满足条件时 beatIndex 不变`)
    // 按 require 驱动（走 UI 控件共用的同一条路径）
    for (const r of beat.require) {
      if (r.kind === 'interact') rt.chapterAck(r.id)
      else if (r.kind === 'read') {
        rt.openPanel(r.panelId)
        for (let i = 0; i < Number(r.count || 1); i += 1) rt.chapterRead(r.panelId, 1)
        rt.closePanel(r.panelId)
      } else if (r.kind === 'select') {
        sim.navValue = 100000
        rt.chapterSelect('601398', { player: true, affordable: true })
      } else if (r.kind === 'submit') {
        const res = { accepted: true, status: 'filled', reasonCode: 'OK', side: r.expect.side || 'buy', type: r.expect.type || 'limit', fee: 6, notional: 620 }
        sim.navValue = r.expect.side === 'sell' ? 100180 : 99940
        rt.noteNav(sim.navValue)
        rt.onOrderResult(res, { side: res.side, type: res.type })
      } else if (r.kind === 'advanceDay') {
        rt.chapterAck(r.id) // simAction: ['advanceDay'] → 内部推进
      } else if (r.kind === 'choice') {
        rt.chapterAnswer(r.choiceId, 't1')
      }
    }
    guard += 1
  }
  eq(seen, CH1_IDS, '第一章逐拍顺序 = prd §3.4 的 11 行')
  ok(rt.snapshot().completedBeats.length === 11, '第一章 completedBeats = 11', JSON.stringify(rt.snapshot().completedBeats))
  eq(rt.confirmChapter().ok, true, '第一章理解确认后确认本章')
  eq(rt.snapshot().chapterId, 2, '第一章确认后进入第二章')
  // 第一章不参与评级
  eq(rt.rating, null, '第一章结算不产生评级')
  eq(rt.snapshot().rating, null, '第一章 rating 快照为 null')
  ok(rt.ratingWindowInputs !== null, '第一章仍保留窗口输入（不静默丢弃）')
  // 定向事件：day1=I04、day2=C03
  const sim2 = sim
  eq(sim2.directedDrawn, ['I04', 'C03'], '第一章定向事件 day1=I04 / day2=C03')
  // 概念引入
  ok(rt.conceptsIntroduced.includes('最小交易单位'), '概念卡进入 conceptsIntroduced')
  eq(rt.snapshot().ruleCardsSeen, [], '第一章不产生规则卡')
  ok(rt.snapshot().mentor.explainCounts['最小交易单位'] >= 1, '导师讲解了最小交易单位')
  eq(rt.snapshot().mentor.line, chaptersDoc.chapters[1].beats[0].mentor[0].line, '进入第二章后章开场台词就位')
  eq(rt.snapshot().mentor.speaker, 'face', '章开场露脸')
}

// ================================================================ 3. 第二章四次拒单必须玩家主动提交
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  rt.enterChapter(1)
  const results = []
  const rejectByBeat = { '2.1': 'REJECT_1', '2.2': 'REJECT_2', '2.3': 'REJECT_4', '2.4': 'REJECT_3' }
  const seen = []
  let guard = 0
  while (rt.snapshot().chapterId === 2 && !rt.snapshot().chapterEndReached && guard++ < 40) {
    const beat = rt.beatData()
    const id = beat.id
    seen.push(id)
    if (rejectByBeat[id]) {
      // 负例：只有 submit 条件的节拍，任何非提交路径都不能推进
      const before = rt.snapshot().beatIndex
      rt.chapterAck('2.1.rejectFunds')
      rt.chapterRead('panel.ruleCards', 4)
      rt.onMarketOpen({ viaAdvance: true })
      eq(rt.snapshot().beatIndex, before, `${id} 无自动完成路径（chat/read/day 都无效）`)
      const want = rejectByBeat[id]
      results.push(want)
      rt.onOrderResult(reject(sim, want), { side: 'buy', type: 'limit' })
    } else if (id === '2.5') {
      rt.openPanel('panel.ruleCards')
      for (let i = 0; i < 4; i += 1) rt.chapterRead('panel.ruleCards', 1)
      rt.closePanel('panel.ruleCards')
      rt.chapterAnswer('2.5.fourRules', 'restrict')
    } else if (id === '2.6') {
      const four = [
        { side: 'buy', type: 'limit' },
        { side: 'sell', type: 'limit' },
        { side: 'buy', type: 'market' },
        { side: 'sell', type: 'limit' },
      ]
      for (const spec of four) {
        sim.navValue += 10
        rt.onOrderResult({ accepted: true, status: 'filled', reasonCode: 'OK', fee: 6, notional: 620 }, spec)
      }
    } else if (id === '2.7') {
      for (const r of beat.require) {
        if (r.kind === 'advanceDay') rt.chapterAck(r.id)
        else if (r.kind === 'read') {
          rt.chapterRead(r.panelId, Number(r.count || 1))
          rt.closePanel(r.panelId)
        }
      }
    }
    guard += 1
  }
  eq(results, ['REJECT_1', 'REJECT_2', 'REJECT_4', 'REJECT_3'], '第二章四次拒单按玩家提交的 reasonCode 归属')
  eq(seen, CH2_IDS, '第二章逐拍顺序 = prd §3.5 的 7 行')
  eq(rt.snapshot().ruleCardsSeen.length, 4, '四张规则卡可查（ruleCardsSeen 含 4 个 id）')
  eq(rt.directedEvents.drawn, ['I01'], '节拍 2.7 钉死 I01')
  eq(rt.directedEvents.owed, ['C01', 'I05', 'C04', 'C07'], '未到定向事件如实暴露 owed，不阻塞推进')
  eq(rt.snapshot().chapterEndReached, true, '第二章到达章末')
  ok(rt.rating !== null, '第二章产生首次评级')
  ok(['A', 'B', 'C', 'D'].includes(rt.rating.grade), '评级档次合法', rt.rating.grade)
  ok(rt.ratingInputs.adjustedNavSeries.length >= 2, '评级窗口有采样点')
  eq(rt.snapshot().endPhase === 'settlement' || rt.snapshot().endPhase === 'extra', true, '章末先结算')
  // 结算后再确认
  rt.advanceEndPhase()
  if (rt.snapshot().extraSegment) rt.completeExtraSegment()
  const before = rt.snapshot().chapterId
  eq(rt.confirmChapter().ok, false, '未作答理解确认题不得确认本章')
  rt.openPanel('panel.confirm')
  rt.chapterAnswer('2.end', 'funds')
  eq(rt.confirmChapter().ok, false, '答错只重讲，不推进')
  rt.chapterAnswer('2.end', 'limit')
  const done = rt.confirmChapter()
  eq(done.ok, true, '答对后可确认本章')
  eq(rt.snapshot().mode, 'freeDay', '第二章确认后进入 freeDay（第三章 Stage 3）')
  eq(rt.snapshot().chapterId, before, '未实现的第三章不进入')
  eq(rt.snapshot().nextChapter.id, 3, '自由窗口常驻卡显示第三章')
  eq(rt.snapshot().nextChapter.name, '一篮子里的一颗蛋', '第三章名字')
  const s = rt.snapshot()
  eq(s.goalCard.graded, true, '第二章章目标卡 graded=true')
}

// ================================================================ 4. 求解 D 级 → 补救段（一次配额）
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  rt.devGotoBeat(2, '2.7')
  rt.devForceGrade('D')
  rt.noteNav(80000)
  sim.navValue = 80000
  for (const r of rt.beatData().require) {
    if (r.kind === 'advanceDay') rt.chapterAck(r.id)
    else if (r.kind === 'read') {
      rt.chapterRead(r.panelId, Number(r.count || 1))
      rt.closePanel(r.panelId)
    }
  }
  eq(rt.snapshot().chapterEndReached, true, 'D 级章末结算可达')
  eq(rt.rating.grade, 'D', '强制档次生效')
  eq(rt.snapshot().extraSegment.kind, 'remedial', 'D 级 → 补救段')
  eq(rt.snapshot().remedialUsedThisChapter, true, 'D 级消耗补救配额')
  eq(rt.snapshot().extraSegment.steps.length, 4, '补救段四层拆账')
  eq(rt.confirmChapter().ok, false, '补救段未完成不得确认')
  const remainingDuringExtra = rt.snapshot().remainingBeats
  eq(rt.completeExtraSegment(), 'confirm', '补救段完成后进入理解确认')
  eq(rt.snapshot().extraSegment, null, '补救段已清除')
  eq(rt.snapshot().remainingBeats, remainingDuringExtra, '补救段不改变 remainingBeats')
  eq(rt.snapshot().remainingBeats, 7 - rt.snapshot().completedBeats.length, 'remainingBeats = beatCount − 已完成数')
}

// ================================================================ 5. 红线：暂停节拍 + 同章一次配额
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  rt.devGotoBeat(2, '2.3')
  eq(rt.snapshot().beatId, '2.3', '跳到 2.3')
  sim.navValue = 9000
  rt.noteNav(9000)
  const s = rt.snapshot()
  eq(s.moneyTier, 'red', 'NAV<¥10,000 → 红档')
  eq(s.redLineActive, true, '红线触发')
  eq(s.interruptedBeatId, '2.3', '记住被打断的节拍')
  eq(s.extraSegment.kind, 'remedial', '红线插入补救段')
  eq(s.remedialUsedThisChapter, true, '红线消耗补救配额')
  // 暂停节拍推进：即使条件满足也不推进
  rt.onOrderResult(reject(sim, 'REJECT_4'), { side: 'sell', type: 'limit' })
  eq(rt.snapshot().beatId, '2.3', '补救段期间节拍不推进')
  eq(rt.completeExtraSegment(), 'resumed', '完成补救段回到被打断的节拍')
  eq(rt.snapshot().beatId, '2.3', '回到被打断的节拍')
  eq(rt.snapshot().extraSegment, null, '补救段已清除')
  // 一键补足本金：外来入金，只恢复可操作性
  const navBefore = sim.navValue
  const top = rt.devTopUpCapital()
  eq(top.injection, Math.max(0, 100000 - navBefore), '补足金额 = ¥100,000 − NAV')
  eq(rt.ratingWindowInputs.externalInjectionInWindow, top.injection, '补足计入外来入金')
  // 同章第二次红线不再触发
  sim.navValue = 500
  rt.noteNav(500)
  eq(rt.snapshot().redLineActive, false, '同章红线只触发一次')
  eq(rt.snapshot().extraSegment, null, '同章不再插入补救段')
  // 章末 D 级：配额已用 → 只显示评级，不重复触发
  rt.devGotoBeat(2, '2.7')
  rt.devForceGrade('D')
  for (const r of rt.beatData().require) {
    if (r.kind === 'advanceDay') rt.chapterAck(r.id)
    else if (r.kind === 'read') {
      rt.chapterRead(r.panelId, Number(r.count || 1))
      rt.closePanel(r.panelId)
    }
  }
  eq(rt.snapshot().extraSegment, null, '配额用尽后章末 D 级不重复触发补救段')
  eq(rt.snapshot().remedialUsedThisChapter, true, '配额保持 true')
  // 跨章边界重置
  rt.enterChapter(0)
  eq(rt.snapshot().remedialUsedThisChapter, false, '跨章边界重置补救配额')
}

// ================================================================ 6. 三模式：自由窗口盈亏排除在评级之外
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  rt.enterChapter(1)
  sim.navValue = 100000
  rt.noteNav(100000)
  eq(rt.setMode('freeDay'), 'freeDay', '可切到 freeDay')
  eq(rt.snapshot().beatId, '2.1', '切模式不推进章节')
  sim.navValue = 120000
  rt.noteNav(120000)
  rt.setMode('sandbox')
  rt.setMode('chapter')
  eq(rt.snapshot().mode, 'chapter', '可切回 chapter')
  eq(rt.snapshot().mentor.line, chaptersDoc.copy.resumeLines[1], '回到主线有承接语')
  eq(rt.snapshot().mentor.speaker, 'face', '承接语有说话人')
  sim.navValue = 120000
  rt.noteNav(120000)
  eq(rt.ratingWindowInputs.excludedPnl, 20000, '窗口外盈亏记入 excludedPnl')
  rt.settle()
  eq(rt.rating.rar, 0, '窗口外盈亏不进 rar')
  eq(rt.rating.maxDD, 0, '窗口外盈亏不进 maxDD')
}

// ================================================================ 7. 评级公式与五把锁（抽样）
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  rt.enterChapter(1)
  // 公式与 rating.js 手算一致（注入后把实盘 NAV 也对齐到最后一个采样点，等价于「结算瞬间的 NAV」）
  sim.navValue = 104000
  const injected = rt.devInjectRatingInputs({
    navSeries: [100000, 100000, 104000],
    fees: 60,
    notional: 20000,
    marketMoveSeries: [0.01, -0.005],
  })
  const P = RATING_PARAMS
  const manualBase = Math.min(100, Math.max(0, P.baseScore + 0.04 * P.rarSlope))
  const manualS = Math.min(100, Math.max(0, manualBase - 0 - P.costMaxPenalty * Math.min(1, Math.max(0, (0.003 - P.costFree) / P.costFull))))
  ok(Math.abs(injected.S - manualS) < 1e-6, 'S 与手算一致', `${injected.S} vs ${manualS}`)
  eq(injected.rar, 0.04, 'rar = (NAV₁−NAV₀)/NAV₀')
  eq(injected.beatenMarket, true, 'rar > 大盘 → beatenMarket')
  ok(Math.abs(injected.marketMove - ((1.01 * 0.995 - 1))) < 1e-6, 'marketMove 复利累乘')
  eq(injected.grade, 'A', 'A 门槛 S≥80')
  // A 级：加演段 + 进阶条目，不发资源
  const seg = rt.snapshot().extraSegment
  eq(seg.kind, 'advanced', 'A 级 → 加演段')
  eq(seg.unlockConcepts, ['限价单', '市价单'], 'A 级解锁两条进阶条目')
  eq(seg.steps.length, 2, '加演段两步')
  // L5：S clamp
  sim.navValue = 50000
  const low = rt.devInjectRatingInputs({ navSeries: [100000, 50000] })
  ok(low.S >= 0 && low.S <= 100, 'S clamp 在 [0,100]')
  eq(low.grade, 'D', '腰斩 → D')
  // 阈值边界（直接查表，避免 NAV→rar 的浮点尾数干扰）
  const thresholds = [
    [RATING_THRESHOLDS.A, 'A'],
    [RATING_THRESHOLDS.A - 0.01, 'B'],
    [RATING_THRESHOLDS.B, 'B'],
    [RATING_THRESHOLDS.B - 0.01, 'C'],
    [RATING_THRESHOLDS.C, 'C'],
    [RATING_THRESHOLDS.C - 0.01, 'D'],
  ]
  for (const [score, want] of thresholds) {
    eq(gradeOf(score), want, `阈值边界 ${score} → ${want}`)
  }
  // 黄档成本罚分 ×0.5
  const green = computeRating({ navSeries: [100000, 100000], fees: 200, notional: 10000, costPenaltyHalf: false })
  const yellow = computeRating({ navSeries: [30000, 30000], fees: 200, notional: 10000, costPenaltyHalf: true })
  ok(Math.abs(green.costPenalty - 2 * yellow.costPenalty) < 1e-9, '黄档成本罚分 ×0.5')
  eq(MONEY_TIERS.green, 50000, '绿档阈值 ¥50,000')
  eq(MONEY_TIERS.yellow, 10000, '黄档阈值 ¥10,000')
}

// ================================================================ 8. 存档：节拍级往返
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  // 走到第二章 2.3，并制造一个「半完成」的节拍
  rt.devGotoBeat(2, '2.1')
  rt.onOrderResult(reject(sim, 'REJECT_1'), { side: 'buy', type: 'limit' })
  rt.onOrderResult(reject(sim, 'REJECT_2'), { side: 'buy', type: 'limit' })
  sim.navValue = 99000
  rt.noteNav(99000)
  const currentBeat = rt.snapshot().beatId
  const completed = [...rt.snapshot().completedBeats]
  const json = rt.toJSON()
  // 白名单：toJSON 的键必须全部在 SAVE_SCHEMA.chapter 里
  const allowed = Object.keys(SAVE_SCHEMA.chapter)
  const unknown = Object.keys(json).filter((k) => !allowed.includes(k))
  eq(unknown, [], 'toJSON 无白名单之外的键')
  ok(saveWhitelistKeys().includes('chapter.mentor.explainCounts'), '白名单导出可用')
  const savedSnapshot = JSON.stringify(json)

  const rt2 = newRuntime({ sim: new FakeSim({ nav: 99000 }) })
  rt2.loadFrom(JSON.parse(JSON.stringify({ ...json, version: SAVE_VERSION })))
  const s2 = rt2.snapshot()
  eq(s2.chapterId, 2, '恢复章节号')
  eq(s2.beatId, currentBeat, '恢复到同一节拍')
  eq(s2.beatIndex, completed.length, '恢复到「最后完成节拍之后」的节拍起点')
  eq(s2.completedBeats, completed, '已完成节拍一致')
  eq(s2.beatRequirements.every((r) => r.satisfied === false), true, '半完成节拍的 require 全部未满足')
  eq(s2.ruleCardsSeen, rt.snapshot().ruleCardsSeen, 'ruleCardsSeen 保留')
  eq(s2.mode, rt.snapshot().mode, 'mode 保留')
  eq(s2.mentor.explainCounts, rt.snapshot().mentor.explainCounts, '导师计数跨存档保留')
  eq(rt2.directedEvents.drawn, rt.directedEvents.drawn, '定向事件 drawn 保留')
  // 未知键被丢弃
  rt2.loadFrom({ ...json, secretFragment: 'none', ratingWindow: { ...json.ratingWindow, hiddenLayer: [1] } })
  eq(rt2.toJSON().secretFragment, undefined, '未知键被丢弃')
  eq(Object.keys(rt2.toJSON().ratingWindow).includes('hiddenLayer'), false, '深层未知键被丢弃')
  // 往返稳定：再次序列化与首次一致
  rt2.loadFrom(JSON.parse(savedSnapshot))
  eq(JSON.stringify(rt2.toJSON()), savedSnapshot, 'toJSON → loadFrom → toJSON 往返稳定')
}

// ================================================================ 9. 存档：面板打开时刷新
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  rt.devGotoBeat(1, '1.8')
  rt.openPanel('panel.review')
  rt.chapterRead('panel.review', 5)
  rt.chapterAnswer('1.9.confirm', 'limit')
  const json = rt.toJSON()
  const rt2 = newRuntime({ sim: new FakeSim() })
  rt2.loadFrom(json)
  eq(rt2.snapshot().panelId, 'panel.review', '恢复后重新打开同一面板')
  eq(rt2.pendingChoice.answeredKey, 'limit', 'answeredKey 保留')
  eq(rt2.snapshot().beatRequirements.every((r) => !r.satisfied), true, '面板节拍的 require 仍未满足')
}

// ================================================================ 10. giveUp 出口不卡死
{
  const sim = new FakeSim()
  const rt = newRuntime({ sim })
  rt.devGotoBeat(2, '2.1')
  const g = rt.giveUp()
  eq(g.ok, true, '「我暂时不想试」可用')
  eq(g.demo.steps.length, 1, 'giveUp 返回演示步骤')
  eq(rt.snapshot().beatId, '2.2', 'giveUp 后本拍完成、不卡死')
  // 提示最多 2 次，第 3 次只显示「你试试看」
  rt.devGotoBeat(2, '2.3')
  for (let i = 0; i < 3; i += 1) rt.onOrderResult(reject(sim, 'REJECT_8'), { side: 'buy', type: 'limit' })
  eq(rt.snapshot().mentor.line, chaptersDoc.copy.giveUpExhaustedLine, '第 3 次只显示「你试试看」')
  eq(rt.snapshot().beatId, '2.3', '仍在等待玩家自己撞')
}

// ================================================================ 11. 与真实 MarketSim 端到端（端口契约 + 定向事件钉死）
{
  const { MarketSim } = await import(pathToFileURL(path.join(mirror, 'scripts', 'sim', 'market.mjs')).href)
  const instruments = JSON.parse(readFileSync(path.join(repo, 'config', 'instruments.json'), 'utf8')).instruments
  const events = JSON.parse(readFileSync(path.join(repo, 'config', 'events.json'), 'utf8')).events
  const sim = new MarketSim({
    instruments,
    events,
    config: { initialCash: 100000, startDate: '2026-01-05', historyBars: 30, defaultInstrumentId: '601398', autoEnterFirstDay: false },
  })
  const rt = new ChapterRuntime({ chapters: chaptersDoc, sim })
  ok(sim.snapshot().NAV === 0, '章节语义开局：未开户、NAV=0')
  ok(sim.snapshot().dayOpen === false, '章节语义开局：日期未推进')

  let guard = 0
  while (rt.snapshot().chapterId === 1 && !rt.snapshot().chapterEndReached && guard++ < 40) {
    const beat = rt.beatData()
    for (const r of beat.require) {
      if (r.kind === 'interact' || r.kind === 'advanceDay') rt.chapterAck(r.id)
      else if (r.kind === 'read') {
        rt.openPanel(r.panelId)
        for (let i = 0; i < Number(r.count || 1); i += 1) rt.chapterRead(r.panelId, 1)
        rt.closePanel(r.panelId)
      } else if (r.kind === 'select') {
        rt.chapterSelect(sim.cheapestAffordableId(), { player: true, affordable: true })
      } else if (r.kind === 'submit') {
        const id = sim.selectedInstrumentId
        const price = sim.snapshot().quotes[id].lastPrice
        const side = r.expect.side
        const spec = { side, instrumentId: id, type: 'limit', price, qty: 100 }
        const result = sim.submitOrder(spec)
        if (r.id === '1.5.buy') {
          eq(result.accepted, true, '第一章首次提交必须成交（PRD §3.4 硬约束）')
          eq(result.status, 'filled', '第一单状态 = 已成交')
        }
        rt.onOrderResult(result, spec)
      } else if (r.kind === 'choice') {
        rt.chapterAnswer(r.choiceId, 't1')
      }
    }
  }
  eq(rt.snapshot().chapterEndReached, true, '真实 sim 下端到端走完第一章')
  eq(rt.confirmChapter().ok, true, '真实 sim 下确认第一章')
  eq(rt.snapshot().chapterId, 2, '真实 sim 下进入第二章')
  eq(sim.directedDrawn, ['I04', 'C03'], '节拍钉死：day1=I04、day2=C03（真实 sim 走 devSetEvent 同一条路径）')
  eq(sim.currentEvent.id, 'C03', '第二个开市日的当前事件 = C03')
  ok(sim.nextEventQueue.length === 4, '进入第二章后定向优先队列 = 4 件（C01/I05/C04/C07）', String(sim.nextEventQueue))
  eq(sim.nextEventQueue, ['C01', 'I05', 'C04', 'C07'], '第二章优先队列按声明顺序')
  eq(rt.directedEvents.owed, ['I01', 'C01', 'I05', 'C04', 'C07'], '第二章定向事件尚未消耗，如实暴露')
  eq(rt.snapshot().rating, null, '第一章不产生评级（真实 sim）')
  rt.save()
}

// ================================================================ 报告
rmSync(mirror, { recursive: true, force: true })
console.log(`\n断言通过 ${passed} 项`)
if (failures.length) {
  console.log(`失败 ${failures.length} 项：`)
  for (const f of failures) console.log('  ✗', f)
  process.exit(1)
}
console.log('全部通过 ✓')
