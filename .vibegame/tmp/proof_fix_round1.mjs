/**
 * 一次性验证脚本（不入库；位于 .vibegame/tmp/）。修复轮 1：B1 / B2 / M3。
 *
 * 目的：在 Node 里无头驱动 ChapterRuntime，断言
 *   B1 红线补救段有面（panelId 打开）、可从 _afterMutate 补开、可完成、完成后回被打断节拍并解除暂停、配额不变
 *   B2 chapterRejectSeen 能穿过真实 SaveStore 白名单往返（缺 schema 条目就会被丢弃）
 *   M3 存档点 = 下一拍起点（恢复后停在下一拍且 require 全未满足）
 *
 * 项目没有 package.json（.js 默认被当成 CJS），所以先把 scripts/**.js 镜像成 .mjs（重写相对 import
 * 说明符），再 import 镜像目录 —— 与 .vibegame/tmp/run_runtime_check.mjs 同一套做法。
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..')
const mirror = path.join(here, 'mirror-fix1')

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
const { SaveStore } = await import(pathToFileURL(path.join(mirror, 'scripts', 'chapter', 'saveStore.mjs')).href)
const chaptersDoc = JSON.parse(readFileSync(path.join(repo, 'config', 'chapters.json'), 'utf8'))

let passed = 0
const failures = []
function ok(cond, label, extra = '') {
  if (cond) {
    passed += 1
    return true
  }
  failures.push(`${label}${extra ? ` :: ${extra}` : ''}`)
  return false
}
function eq(actual, expected, label) {
  return ok(
    JSON.stringify(actual) === JSON.stringify(expected),
    label,
    `expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`,
  )
}

class FakeSim {
  constructor({ nav = 100000 } = {}) {
    this.navValue = nav
    this.dayOpen = false
    this.queue = []
    this.directedDrawn = []
    this.dayCount = 0
    this.currentEvent = null
  }
  openAccount() {
    return true
  }
  fundInitial() {
    this.navValue = 100000
    return true
  }
  beginFirstDay() {
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
    this.queue.push(id)
    return true
  }
  clearResidualState() {
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

/** 内存 storage（真实 SaveStore 的白名单路径） */
function memStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

function newRuntime({ sim = new FakeSim(), saveStore = null } = {}) {
  return new ChapterRuntime({ chapters: chaptersDoc, sim, saveStore })
}
const reject = (reasonCode, side = 'buy', type = 'limit') => ({
  accepted: false,
  status: 'rejected',
  reasonCode,
  side,
  type,
  fee: 0,
  notional: 0,
})
const filled = (side, type) => ({ accepted: true, status: 'filled', reasonCode: 'OK', side, type, fee: 6, notional: 620 })

// ================================================================ M3 存档点 = 下一拍起点
{
  const store = new SaveStore({ storage: memStorage() })
  const rt = newRuntime({ saveStore: store })
  eq(rt.snapshot().beatId, '1.0', 'M3 开局在 1.0')
  rt.chapterAck('1.0.start')
  eq(rt.snapshot().beatId, '1.1', 'M3 完成 1.0 后到 1.1')

  const doc = store.read()
  ok(!!doc, 'M3 完成一拍后确实写了存档')
  eq(doc && doc.beatId, '1.1', 'M3 存档的 beatId = 下一拍（不是刚完成的那拍）')
  eq(doc && doc.chapter.beatIndex, 1, 'M3 存档 beatIndex = 1（不是 0）')
  ok(doc && doc.chapter.completedBeats.includes('1.0'), 'M3 存档记录 1.0 已完成')

  // 恢复：必须落在下一拍起点，且半完成节拍的 require 全部未满足
  const rt2 = newRuntime({ sim: new FakeSim() })
  rt2.loadFrom(doc.chapter)
  eq(rt2.snapshot().beatId, '1.1', 'M3 恢复落在下一拍起点')
  const reqs = rt2.snapshot().beatRequirements
  eq(reqs.length, 2, 'M3 恢复后 1.1 有两条完成条件')
  eq(reqs.filter((r) => r.satisfied).length, 0, 'M3 恢复后半完成节拍的 require 全部未满足（不重放）')
  const rt3 = newRuntime({ sim: new FakeSim() })
  rt3.loadFrom(doc.chapter)
  eq(rt3.snapshot().beatId, rt2.snapshot().beatId, 'M3 恢复是确定性的')
}

// ================================================================ B2 chapterRejectSeen 持久化
{
  const store = new SaveStore({ storage: memStorage() })
  const sim = new FakeSim()
  const rt = newRuntime({ sim, saveStore: store })
  rt.enterChapter(1)
  eq(rt.snapshot().beatId, '2.1', 'B2 进入第二章')

  // 2.1–2.4 全部走产品出口「我暂时不想试」（不是 dev*）
  for (const id of ['2.1', '2.2', '2.3', '2.4']) {
    const r = rt.giveUp(id)
    ok(r && r.ok, `B2 giveUp ${id} 走通`)
  }
  eq(rt.snapshot().beatId, '2.5', 'B2 到达 2.5')

  // 2.5：读满四张规则卡 + 作答（玩家路径）。2.5.fourRules 是观点题（correctKey = null），任一项都可
  rt.chapterRead('panel.ruleCards', 4)
  rt.closePanel('panel.ruleCards')
  const q25 = chaptersDoc.chapters[1].choices['2.5.fourRules']
  rt.chapterAnswer('2.5.fourRules', q25.correctKey || q25.options[0].key)
  eq(rt.snapshot().beatId, '2.6', 'B2 到达 2.6')

  // 拒单 → 本章出现过拒单
  rt.onOrderResult(reject('REJECT_2'), { side: 'buy', type: 'limit' })
  const savedReject = rt._chapterRejectSeen
  eq(savedReject, true, 'B2 拒单后 _chapterRejectSeen = true')
  rt.save()

  const doc = store.read()
  ok(!!doc, 'B2 存档可读')
  eq(doc && doc.chapter.chapterRejectSeen, true, 'B2 存档里的 chapterRejectSeen = true（schema 白名单放行）')
  // 刷新（面板打开时刷新 → loadFrom）后 2.6 必须仍然可完成：四类委托按数据顺序各顶掉一条
  const rt2 = newRuntime({ sim })
  rt2.loadFrom(doc.chapter)
  eq(rt2._chapterRejectSeen, true, 'B2 恢复后 _chapterRejectSeen 仍为 true')
  eq(rt2.snapshot().beatId, '2.6', 'B2 恢复回到 2.6')
  eq(rt2.snapshot().beatRequirements.filter((r) => r.satisfied).length, 0, 'B2 刷新后 2.6 四条条件全未满足')
  rt2.onOrderResult(filled('buy', 'limit'), { side: 'buy', type: 'limit' })
  rt2.onOrderResult(filled('sell', 'limit'), { side: 'sell', type: 'limit' })
  rt2.onOrderResult(filled('buy', 'market'), { side: 'buy', type: 'market' })
  eq(rt2.snapshot().beatId, '2.6', 'B2 前三条委托满足后仍在 2.6（第四条还没给）')
  const beforeCorrected = rt2.snapshot().beatRequirements.find((r) => r.id === '2.6.correctedLimit')
  ok(!beforeCorrected.satisfied, 'B2 第四张限价单之前「修正后的限价单」尚未满足')
  rt2.onOrderResult(filled('buy', 'limit'), { side: 'buy', type: 'limit' })
  eq(rt2.snapshot().beatId, '2.7', 'B2 刷新后「修正后的限价单」被认下 → 2.6 可完成、第二章可完成')

  // 反证：没经历过拒单的运行时，同样的第四张限价单顶不掉 correctedLimit
  const rt3 = newRuntime({ sim, saveStore: new SaveStore({ storage: memStorage() }) })
  rt3.enterChapter(1)
  rt3.devGotoBeat(2, '2.6')
  eq(rt3._chapterRejectSeen, false, 'B2 反证：未拒单时 _chapterRejectSeen = false')
  rt3.onOrderResult(filled('buy', 'limit'), { side: 'buy', type: 'limit' })
  rt3.onOrderResult(filled('sell', 'limit'), { side: 'sell', type: 'limit' })
  rt3.onOrderResult(filled('buy', 'market'), { side: 'buy', type: 'market' })
  rt3.onOrderResult(filled('buy', 'limit'), { side: 'buy', type: 'limit' })
  eq(
    rt3.snapshot().beatRequirements.find((r) => r.id === '2.6.correctedLimit').satisfied,
    false,
    'B2 反证：没有拒单史时 correctedLimit 不满足（这正是刷新丢字段后的死局）',
  )
}

// ================================================================ B1 红线补救段不卡死
{
  // —— 场景 A：打断后什么都不做，完成补救段必须回到被打断的那一拍并解除暂停 ——
  const sim = new FakeSim()
  const store = new SaveStore({ storage: memStorage() })
  const rt = newRuntime({ sim, saveStore: store })
  rt.enterChapter(1)
  eq(rt.snapshot().panelId, null, 'B1 2.1 无面板')

  sim.navValue = 9000
  rt.noteNav(9000)
  let s = rt.snapshot()
  eq(s.moneyTier, 'red', 'B1 NAV<¥10,000 → 红档')
  eq(s.redLineActive, true, 'B1 红线触发')
  eq(s.extraSegment && s.extraSegment.origin, 'redLine', 'B1 插入的是红线补救段')
  eq(s.extraSegment && s.extraSegment.kind, 'remedial', 'B1 段种类 = remedial')
  eq(s.panelId, 'panel.extraSegment', 'B1 段一建立就开了自己的面板（卡死的根因）')
  eq(s.paused, true, 'B1 段期间真暂停')
  eq(s.interruptedBeatId, '2.1', 'B1 记住被打断的节拍')
  eq(s.remedialUsedThisChapter, true, 'B1 红线消耗一章一次的补救配额')

  // _afterMutate 的补开能力：面板被关掉后，任何一次玩家动作都会把面补回来
  rt.closePanel('panel.extraSegment')
  eq(rt.snapshot().panelId, 'panel.extraSegment', 'B1 面板消失后由 _afterMutate 补开（永远有面）')

  // 面板路径：面板上「继续」按钮最后一跳 = completeExtraSegment()
  eq(rt.completeExtraSegment(), 'resumed', 'B1 完成补救段 → resumed')
  s = rt.snapshot()
  eq(s.extraSegment, null, 'B1 段已清除')
  eq(s.panelId, null, 'B1 面板已关闭（解除暂停）')
  eq(s.paused, false, 'B1 已解除暂停')
  eq(s.redLineActive, false, 'B1 红线态已清')
  eq(s.interruptedBeatId, null, 'B1 打断标记已清')
  eq(s.beatId, '2.1', 'B1 回到被打断的节拍 2.1（不跳拍、不重放）')
  eq(s.beatRequirements.filter((r) => r.satisfied).length, 0, 'B1 回到被打断节拍时其条件确实未满足')

  // 推进真的恢复了：走产品出口完成 2.1
  rt.giveUp('2.1')
  eq(rt.snapshot().beatId, '2.2', 'B1 完成后节拍推进恢复（2.1 → 2.2）')

  // 配额：同章第二次红线不再触发；跨章边界重置
  sim.navValue = 500
  rt.noteNav(500)
  eq(rt.snapshot().extraSegment, null, 'B1 同章不再插入补救段')
  rt.enterChapter(0)
  eq(rt.snapshot().remedialUsedThisChapter, false, 'B1 跨章边界重置配额')

  // —— 场景 B：段期间的玩家动作被暂停（不消费本拍进度），段一结束就自然续上 ——
  const sim2 = new FakeSim()
  const rt2 = newRuntime({ sim: sim2 })
  rt2.enterChapter(1)
  sim2.navValue = 9000
  rt2.noteNav(9000)
  eq(rt2.snapshot().panelId, 'panel.extraSegment', 'B1 场景B：面已开')
  rt2.onOrderResult(reject('REJECT_1'), { side: 'buy', type: 'limit' })
  eq(rt2.snapshot().beatId, '2.1', 'B1 段期间节拍不推进')
  eq(
    rt2.snapshot().beatRequirements.filter((r) => r.satisfied).length,
    0,
    'B1 段期间不消费本拍完成条件（进度留在被打断的节拍上）',
  )
  eq(rt2.completeExtraSegment(), 'resumed', 'B1 场景B：完成补救段')
  eq(rt2.snapshot().beatId, '2.1', 'B1 场景B：仍停在被打断的节拍')
  // 同一个玩家动作在段结束后立刻生效 → 推进恢复
  rt2.onOrderResult(reject('REJECT_1'), { side: 'buy', type: 'limit' })
  eq(rt2.snapshot().beatId, '2.2', 'B1 段一结束，同一动作即可完成本拍并推进（不卡死）')

  // —— 场景 C：存档往返（刷新恢复）后红线段仍有面 ——
  const store3 = new SaveStore({ storage: memStorage() })
  const sim3 = new FakeSim()
  const rt3 = newRuntime({ sim: sim3, saveStore: store3 })
  rt3.enterChapter(1)
  sim3.navValue = 9000
  rt3.noteNav(9000)
  const doc3 = store3.read()
  eq(doc3 && doc3.chapter.panelId, 'panel.extraSegment', 'B1 场景C：存档记下面板')
  eq(doc3 && doc3.chapter.extraSegment.origin, 'redLine', 'B1 场景C：存档记下段来源')
  const rt4 = newRuntime({ sim: sim3 })
  rt4.loadFrom(doc3.chapter)
  eq(rt4.snapshot().panelId, 'panel.extraSegment', 'B1 场景C：刷新恢复后仍有面')
  eq(rt4.snapshot().paused, true, 'B1 场景C：恢复到暂停态')
  eq(rt4.completeExtraSegment(), 'resumed', 'B1 场景C：恢复后仍可完成')
  eq(rt4.snapshot().beatId, '2.1', 'B1 场景C：完成后回到 2.1')

  // —— 场景 D：没有可呈现面板的章节不建立段（不得卡死优先于「一定要插段」）——
  const sim4 = new FakeSim()
  const rt5 = newRuntime({ sim: sim4 })
  rt5.enterChapter(0) // 第一章：数据里没有 extraSegments / extraPanelId
  sim4.navValue = 9000
  rt5.noteNav(9000)
  eq(rt5.snapshot().extraSegment, null, 'B1 第一章无可呈现面板 → 不建立段')
  eq(rt5.snapshot().panelId, null, 'B1 第一章红线不抢面板')
  // 不卡死：第一章节拍照常推进
  rt5.chapterAck('1.0.start')
  eq(rt5.snapshot().beatId, '1.1', 'B1 第一章红线后节拍照常推进')
}

// ================================================================ 汇总
console.log(`\n断言通过 ${passed} 项`)
if (failures.length) {
  console.log(`失败 ${failures.length} 项：`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('全部通过 ✓')
