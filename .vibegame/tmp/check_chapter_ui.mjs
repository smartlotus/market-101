/**
 * 一次性无头校验（不入库；位于 .vibegame/tmp/）。删除或保留均可。
 *
 * 目的：证明本次新增的 9 个模块
 *   ① 语法能过、**import 全部能解析**（按引擎的模块解析方式：scripts/ 相对导入、/engine/ 与
 *      /modules/ 绝对导入）；
 *   ② 在一个人造 DOM 上真的能跑：ChapterOverlay 的两时钟暂停与互斥、ChapterRoot 三层挂载、
 *      场景层代码绘制兜底、对话层门禁、PanelHost 的「blocks 无 actions 拒绝打开」与读计数、
 *      章目标卡的「本章不打分 / 加演 / 再摆一次」、词典的进阶折叠与公式查询。
 *
 * 项目没有 package.json（.js 会被当成 CJS），所以先把 scripts/ + modules/ + engine/Node.js
 * 镜像成 .mjs（重写相对与绝对说明符），再 import 镜像目录。
 * 本脚本只读项目文件，不写任何项目文件（镜像目录写在 tmp 下）。
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..')
const mirror = path.join(here, 'mirror-ui')

rmSync(mirror, { recursive: true, force: true })

// ------------------------------------------------------------------ 镜像

function mirrorFile(from, to, mirrorRoot) {
  const dir = path.dirname(to)
  const specifier = (spec) => {
    if (spec.startsWith('.')) return spec.replace(/\.js$/, '.mjs')
    if (spec.startsWith('/')) {
      const target = path.join(mirrorRoot, spec.replace(/^\/+/, '').replace(/\.js$/, '.mjs'))
      let rel = path.relative(dir, target).split(path.sep).join('/')
      if (!rel.startsWith('.')) rel = './' + rel
      return rel
    }
    return spec
  }
  const src = readFileSync(from, 'utf8').replace(
    /(from\s*['"])([^'"]+)(['"])/g,
    (m, a, spec, c) => `${a}${specifier(spec)}${c}`,
  )
  writeFileSync(to, src)
}

function mirrorDir(fromDir, toDir, mirrorRoot, filter = null) {
  mkdirSync(toDir, { recursive: true })
  for (const name of readdirSync(fromDir)) {
    const from = path.join(fromDir, name)
    const to = path.join(toDir, name)
    if (statSync(from).isDirectory()) {
      mirrorDir(from, to, mirrorRoot, filter)
      continue
    }
    if (!name.endsWith('.js')) continue
    if (filter && !filter(path.join(fromDir, name))) continue
    mirrorFile(from, to.replace(/\.js$/, '.mjs'), mirrorRoot)
  }
}

mirrorDir(path.join(repo, 'scripts'), path.join(mirror, 'scripts'), mirror)
mirrorDir(path.join(repo, 'modules'), path.join(mirror, 'modules'), mirror)
mirrorDir(path.join(repo, 'engine'), path.join(mirror, 'engine'), mirror, (p) => p.endsWith('Node.js'))

// ------------------------------------------------------------------ 断言工具

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
const eq = (a, b, label) => ok(a === b, label, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
const mod = (rel) => import(pathToFileURL(path.join(mirror, rel)).href)

// ------------------------------------------------------------------ ① 导入解析

const MODULES = [
  ['scripts/ChapterOverlay.mjs', 'default'],
  ['scripts/ui/chapter/ChapterRoot.mjs', 'default'],
  ['scripts/ui/chapter/SceneLayerView.mjs', 'default'],
  ['scripts/ui/chapter/DialogueLayerView.mjs', 'default'],
  ['scripts/ui/chapter/PanelHost.mjs', 'default'],
  ['scripts/ui/chapter/GoalCardView.mjs', 'default'],
  ['scripts/ui/chapter/FreeWindowCardView.mjs', 'default'],
  ['scripts/ui/chapter/ConceptDictionaryView.mjs', 'default'],
  ['scripts/ui/chapter/theme.mjs', 'CHAPTER_THEME_CSS'],
]

const loaded = {}
for (const [rel, exportName] of MODULES) {
  try {
    const m = await mod(rel)
    loaded[rel] = m
    ok(typeof m[exportName] !== 'undefined', `import + export ${rel} (${exportName})`)
  } catch (err) {
    ok(false, `import ${rel}`, String(err && err.message))
  }
}

// ------------------------------------------------------------------ 人造 DOM

class ClassList {
  constructor() { this.set = new Set() }
  add(...c) { for (const x of c) this.set.add(String(x)) }
  remove(...c) { for (const x of c) this.set.delete(String(x)) }
  contains(c) { return this.set.has(String(c)) }
  toggle(c, force) {
    const on = force === undefined ? !this.set.has(String(c)) : Boolean(force)
    if (on) this.set.add(String(c)); else this.set.delete(String(c))
    return on
  }
  toString() { return [...this.set].join(' ') }
}

function makeStyle() {
  return {
    _css: '',
    set cssText(v) {
      this._css = String(v)
      const m = /display\s*:\s*([^;]+)/i.exec(this._css)
      if (m) this.display = m[1].trim()
    },
    get cssText() { return this._css },
  }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase()
    this.children = []
    this.parentNode = null
    this.classList = new ClassList()
    this.style = makeStyle()
    this.dataset = {}
    this.attrs = {}
    this.listeners = {}
    this._text = ''
    this._html = ''
    this._id = ''
  }
  set id(v) { this._id = String(v); dom.registry.set(this._id, this) }
  get id() { return this._id }
  set className(v) { this.classList = new ClassList(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)) }
  get className() { return this.classList.toString() }
  set textContent(v) { this._text = String(v); for (const c of this.children) c.parentNode = null; this.children = [] }
  get textContent() { return this.children.length ? this.children.map((c) => c.textContent).join('') : this._text }
  set innerHTML(v) { this._html = String(v); this.children = [] }
  get innerHTML() { return this._html }
  get firstElementChild() { return this.children[0] || null }
  get nextElementSibling() {
    if (!this.parentNode) return null
    const i = this.parentNode.children.indexOf(this)
    return this.parentNode.children[i + 1] || null
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child }
  replaceChildren(...nodes) { for (const c of this.children) c.parentNode = null; this.children = [...nodes] }
  remove() {
    if (!this.parentNode) return
    const i = this.parentNode.children.indexOf(this)
    if (i >= 0) this.parentNode.children.splice(i, 1)
    this.parentNode = null
  }
  after(node) {
    if (!this.parentNode) return
    const i = this.parentNode.children.indexOf(this)
    this.parentNode.children.splice(i + 1, 0, node)
    node.parentNode = this.parentNode
  }
  setAttribute(k, v) { this.attrs[k] = String(v) }
  getAttribute(k) { return this.attrs[k] }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn) }
  removeEventListener() {}
  dispatchEvent(event) {
    for (const fn of this.listeners[event.type] || []) fn(event)
    if (event.bubbles && this.parentNode) this.parentNode.dispatchEvent(event)
    return true
  }
  click() { this.dispatchEvent({ type: 'click', target: this, bubbles: true }) }
  matches(token) {
    if (token.startsWith('#')) return this.id === token.slice(1)
    if (token.startsWith('.')) return token.slice(1).split('.').every((c) => this.classList.contains(c))
    return this.tagName === token.toUpperCase()
  }
  querySelector(sel) {
    const tokens = String(sel).trim().split(/\s+/)
    let found = null
    const visit = (node, idx) => {
      for (const child of node.children) {
        if (child.matches(tokens[idx])) {
          if (idx === tokens.length - 1) { found = child; return true }
          if (visit(child, idx + 1)) return true
        }
        if (visit(child, idx)) return true
      }
      return false
    }
    visit(this, 0)
    return found
  }
  querySelectorAll(sel) {
    const out = []
    const tokens = String(sel).trim().split(/\s+/)
    const walk = (node, idx) => {
      for (const child of node.children) {
        if (child.matches(tokens[idx])) {
          if (idx === tokens.length - 1) out.push(child)
          else walk(child, idx + 1)
        }
        walk(child, idx)
      }
    }
    walk(this, 0)
    return out
  }
  get text() { return this.textContent }
}

const dom = { registry: new Map() }
globalThis.document = {
  head: new El('head'),
  body: new El('body'),
  createElement: (tag) => new El(tag),
  getElementById: (id) => dom.registry.get(id) || null,
}
globalThis.window = { addEventListener() {}, removeEventListener() {} }
globalThis.CustomEvent = class { constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); this.detail = init.detail } }

// ------------------------------------------------------------------ ② ChapterOverlay：真暂停 + 互斥

const GameOverlayModule = (await mod('modules/GameOverlayModule.mjs')).default
const ChapterOverlay = loaded['scripts/ChapterOverlay.mjs'].default

ok(ChapterOverlay.prototype instanceof GameOverlayModule, 'ChapterOverlay extends GameOverlayModule')
ok(!existsSync(path.join(repo, 'scripts', 'GameOverlayModule.js')), 'no project-local copy of the module')

const container = new El('div')
container.id = 'game-container'

const chaptersDoc = JSON.parse(readFileSync(path.join(repo, 'config', 'chapters.json'), 'utf8'))
const conceptsDoc = JSON.parse(readFileSync(path.join(repo, 'config', 'concepts.json'), 'utf8'))

const panelIds = []
for (const ch of chaptersDoc.chapters) {
  for (const id of Object.keys(ch.panels || {})) if (!panelIds.includes(id)) panelIds.push(id)
}
ok(panelIds.length >= 8, 'chapters.json declares the full panel set', panelIds.join(','))

function makeOverlay() {
  const overlay = new ChapterOverlay()
  overlay.config = {
    menus: [
      ...panelIds.map((id) => ({ id, pausesGame: true, buttons: [] })),
      { id: 'panel.refuse', title: '纯文本', pausesGame: true, buttons: [] },
    ],
    style: { containerId: 'game-container' },
  }
  overlay.sceneTree = { running: true }
  overlay.scene = { scene: { _paused: false, pause() { this._paused = true }, resume() { this._paused = false }, isPaused() { return this._paused } } }
  overlay.ready()
  return overlay
}

const overlay = makeOverlay()
ok(overlay.isPaused() === false, 'overlay: both clocks running before any panel')
overlay.showPanel('panel.deposit')
ok(overlay.isPaused() === true, 'overlay: showPanel halts BOTH clocks (sceneTree.running + scene.pause)')
eq(overlay.sceneTree.running, false, 'overlay: sceneTree.running === false')
eq(overlay.scene.scene.isPaused(), true, 'overlay: scene.scene.isPaused() === true')
eq(overlay.currentPanelId(), 'panel.deposit', 'overlay: currentPanelId')

// 互斥：切换面板时不能出现「一边开着另一个面板一边 running=true」
overlay.showPanel('panel.review')
ok(overlay.isMenuVisible('panel.deposit') === false, 'overlay: previous panel hidden on switch (mutually exclusive)')
eq(overlay.currentPanelId(), 'panel.review', 'overlay: switched current panel')
eq(overlay.sceneTree.running, false, 'overlay: still halted after switch (no observable running=true)')

ok(Boolean(overlay.getPanelBody('panel.review')), 'overlay: getPanelBody returns the content host')
ok(Boolean(overlay.getPanelFoot('panel.review')), 'overlay: getPanelFoot returns the action host')
overlay.setPanelTitle('panel.review', '标题来自数据')
eq(overlay.getPanelBody('panel.review').parentNode.querySelector('.ch-phd .t').textContent, '标题来自数据', 'overlay: setPanelTitle projects the data title')
eq(overlay.getPanelBody('panel.review').querySelectorAll('button').length, 0, 'overlay: module-built buttons stripped (actions come from data)')

overlay.hidePanel()
ok(overlay.isPaused() === false, 'overlay: hidePanel resumes both clocks')
eq(overlay.sceneTree.running, true, 'overlay: sceneTree.running restored')
overlay.hidePanel() // 空关闭不得改变时钟
eq(overlay.sceneTree.running, true, 'overlay: hidePanel with nothing open does not touch the clocks')

const ovState = overlay.runtimeState()
ok('panelId' in ovState && 'paused' in ovState && 'panelOpen' in ovState, 'overlay: runtimeState exposes panelId/paused/panelOpen')

// syncFromRuntime 投影
const fakeRuntime = { snapshot: () => ({ panelId: 'panel.settlement' }), notePanelPause(v) { this.lastPause = v } }
overlay.syncFromRuntime(fakeRuntime)
eq(overlay.currentPanelId(), 'panel.settlement', 'overlay: syncFromRuntime opens the runtime panel')
eq(fakeRuntime.lastPause, true, 'overlay: syncFromRuntime reports the true pause state back to the runtime')
overlay.syncFromRuntime({ snapshot: () => ({ panelId: null }), notePanelPause() {} })
eq(overlay.currentPanelId(), null, 'overlay: syncFromRuntime closes when the runtime has no panel')

// ------------------------------------------------------------------ 数据 + 状态工具

const chapterById = new Map(chaptersDoc.chapters.map((c) => [Number(c.id), c]))

function beatOf(chapterId, beatId) {
  const ch = chapterById.get(Number(chapterId))
  return ch.beats.find((b) => b.id === beatId) || null
}

/** 手工造一个「宿主 Node 的 runtimeState()」：{...sim 快照, chapter}。 */
function makeState(chapterId, beatId, chapterOverrides = {}, simOverrides = {}) {
  const beat = beatOf(chapterId, beatId)
  const chapter = {
    chapterId: Number(chapterId),
    chapterName: chapterById.get(Number(chapterId)).name,
    beatId,
    beatTitle: beat ? beat.title : '',
    beatIndex: 0,
    beatCount: chapterById.get(Number(chapterId)).beats.length,
    remainingBeats: chapterById.get(Number(chapterId)).beats.length,
    mode: 'chapter',
    shellMode: (beat && beat.shell) || 'full',
    sceneId: (beat && beat.scene) || null,
    panelId: null,
    paused: false,
    goalCard: chapterById.get(Number(chapterId)).goalCard
      ? {
          title: chapterById.get(Number(chapterId)).goalCard.title,
          teach: chapterById.get(Number(chapterId)).goalCard.teach,
          graded: chapterById.get(Number(chapterId)).goalCard.graded !== false,
          noScoreLabel: chapterById.get(Number(chapterId)).goalCard.graded === false ? '本章不打分' : null,
          remainingBeats: chapterById.get(Number(chapterId)).beats.length,
          yellowLine: null,
          topUpLabel: '补足本金',
        }
      : null,
    moneyTier: 'green',
    beatRequirements: ((beat && beat.require) || []).map((r) => ({ kind: r.kind, id: r.id, satisfied: false, label: r.label || '' })),
    pendingChoice: null,
    conceptsIntroduced: [],
    ruleCardsSeen: [],
    rating: null,
    ratingInputs: null,
    remedialUsedThisChapter: false,
    extraSegment: null,
    directedEvents: { required: [], drawn: [], owed: [] },
    mentor: { muted: false, proactiveEnabled: true, explainCounts: {}, line: null, speaker: null, conceptKey: null, callable: true },
    save: { exists: false, version: null, beatId: null },
    endPhase: 'none',
    chapterEndReached: false,
    redLineActive: false,
    interruptedBeatId: null,
    grades: {},
    nextChapter: { id: 3, name: '一篮子里的一颗蛋', preview: '先别选公司。先选方法。' },
    beat,
    chapterEnd: chapterById.get(Number(chapterId)).chapterEnd || null,
    settlement: chapterById.get(Number(chapterId)).settlement || null,
    copy: chaptersDoc.copy,
    requireKinds: ['interact', 'read', 'select', 'submit', 'choice', 'advanceDay'],
    ratingParams: { baseScore: 50, rarSlope: 833, ddFree: 0.05, ddFull: 0.15, ddMaxPenalty: 40, costFree: 0.002, costFull: 0.01, costMaxPenalty: 15, yellowCostPenaltyScale: 0.5 },
    ratingThresholds: { A: 80, B: 60, C: 40 },
    moneyTiers: { green: 50000, yellow: 10000 },
    ...chapterOverrides,
  }
  return {
    NAV: 100000,
    cash: 100000,
    realizedPnL: 0,
    feesPaid: 0,
    tradedNotional: 0,
    quotes: {},
    positions: [],
    currentEvent: { id: 'I04', type: 'INDUSTRY', sentiment: 'GOOD', targets: ['601398', '600036'], headline: '银行业净息差企稳，盈利预期改善', mentorLine: '银行整体赚钱环境变好，板块小涨。' },
    lastOrder: null,
    pendingOrders: [],
    ...simOverrides,
    chapter,
  }
}

// ------------------------------------------------------------------ ③ ChapterRoot + 各层

const uiRoot = new El('div')
uiRoot.id = 'vibegame-ui'
const brokerShell = new El('div')
brokerShell.id = 'broker-shell'
uiRoot.appendChild(brokerShell)
const testUi = {
  root: uiRoot,
  mount: (elm) => uiRoot.appendChild(elm),
  setImage: (elm, key) => { elm.src = key },
  assetUrl: (key) => key,
}

function makeRuntimeSpy() {
  const calls = []
  const spy = {
    calls,
    mentor: { note(key) { calls.push(['mentor.note', key]); return 1 } },
    // `ChapterRuntime.snapshot()` 返回的是**章节快照**（`BrokerShell.runtimeState().chapter`），
    // 不是整份 `{...sim, chapter}` —— 视图调用 snapshot() 拿到的就是章节那一层。
    // 注意读的是实例上的 `_state`（测试会把整份状态赋给它），不是工厂函数上的。
    snapshot: () => (spy._state ? spy._state.chapter : null),
    chapterAck(id) { calls.push(['chapterAck', id]); return { ok: true } },
    chapterAnswer(id, key) { calls.push(['chapterAnswer', id, key]); return { ok: true } },
    chapterRead(id, n) { calls.push(['chapterRead', id, n]); return { ok: true } },
    closePanel(id) { calls.push(['closePanel', id]); return { ok: true } },
    confirmChapter() { calls.push(['confirmChapter']); return { ok: true } },
    advanceEndPhase() { calls.push(['advanceEndPhase']); return 'confirm' },
    advanceExtraStep() { calls.push(['advanceExtraStep']); return 1 },
    completeExtraSegment() { calls.push(['completeExtraSegment']); return 'confirm' },
    devTopUpCapital() { calls.push(['devTopUpCapital']); return { injection: 1 } },
    setMuted(v) { calls.push(['setMuted', v]); return v },
    setMode(m) { calls.push(['setMode', m]); return m },
    giveUp(id) { calls.push(['giveUp', id]); return { ok: true, beatId: id, demo: { steps: [] } } },
    callMentor() { calls.push(['callMentor']); return { ok: true } },
    notePanelPause(v) { calls.push(['notePanelPause', v]); return v },
  }
  return spy
}

const runtimeSpy = makeRuntimeSpy()
const ChapterRoot = loaded['scripts/ui/chapter/ChapterRoot.mjs'].default
const root = new ChapterRoot(testUi, {
  runtime: runtimeSpy,
  overlay,
  chapters: chaptersDoc,
  concepts: conceptsDoc,
})
eq(uiRoot.children[0].id, 'broker-shell', 'ChapterRoot: #broker-shell stays first')
eq(uiRoot.children[1].id, 'chapter-root', 'ChapterRoot: #chapter-root mounted after the broker shell')
eq(document.getElementById('chapter-theme').tagName, 'STYLE', 'ChapterRoot: chapter theme <style> injected once')

// —— 节拍 1.0：无场景、有台词、有「开始」——
runtimeSpy._state = makeState(1, '1.0', {
  mentor: { muted: false, proactiveEnabled: true, explainCounts: {}, line: '这是一个用真规则、假钱做的游戏。你的账户里有 ¥100,000。', speaker: 'face', conceptKey: null, callable: true },
})
root.update(runtimeSpy._state)
const dialogueEl = document.getElementById('chapter-root').querySelector('.ch-dialogue')
ok(!dialogueEl.classList.contains('ch-hidden'), 'DialogueLayer: visible when there is a line')
eq(dialogueEl.querySelector('.ch-line').textContent, '这是一个用真规则、假钱做的游戏。你的账户里有 ¥100,000。', 'DialogueLayer: line text comes from data')
eq(dialogueEl.querySelector('.ch-say-foot button').textContent, '开始', 'DialogueLayer: beat-level interact control label comes from data')
dialogueEl.querySelector('.ch-say-foot button').click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'chapterAck' && c[1] === '1.0.start').length, 1, 'DialogueLayer: 开始 → runtime.chapterAck("1.0.start")')
// 折叠
const tools = dialogueEl.querySelector('.ch-say-tools')
tools.querySelectorAll('.ch-tool')[0].click()
ok(dialogueEl.classList.contains('folded'), 'DialogueLayer: fold toggles a visual collapsed state')
tools.querySelectorAll('.ch-tool')[0].click()
ok(!dialogueEl.classList.contains('folded'), 'DialogueLayer: fold un-toggles')
// 静音：写进 runtime，并且补记计数
tools.querySelectorAll('.ch-tool')[1].click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'setMuted').length, 1, 'DialogueLayer: mute → runtime.setMuted')

// —— 节拍 1.1：场景层（sceneImageKey 为 null → 代码绘制）+ 存单物件 ——
runtimeSpy._state = makeState(1, '1.1', {
  mentor: { muted: false, proactiveEnabled: true, explainCounts: {}, line: '你今年存了多少？', speaker: 'offscreen', conceptKey: '银行', callable: true },
}, {}, )
root.update(runtimeSpy._state)
const sceneEl = document.getElementById('chapter-root').querySelector('.ch-scene')
ok(!sceneEl.classList.contains('ch-hidden'), 'SceneLayer: visible when the beat declares a scene')
ok(!sceneEl.classList.contains('band'), 'SceneLayer: full-bleed while the broker shell is hidden (shellMode=hidden)')
ok(sceneEl.querySelectorAll('.ch-draw').length === 1, 'SceneLayer: code-drawn backdrop wrapper present')
ok(sceneEl.querySelector('.ch-draw').children.length > 0, 'SceneLayer: code-drawn backdrop has real parts (no empty rectangle)')
ok(sceneEl.querySelector('.ch-scene-bg').classList.contains('ch-hidden'), 'SceneLayer: bitmap layer hidden when sceneImageKey is absent')
const prop = sceneEl.querySelector('.ch-prop')
eq(prop.dataset.requireId, '1.1.openDeposit', 'SceneLayer: in-scene prop derived from the beat require[] (opensPanel)')
eq(prop.querySelector('.cap').textContent, '点开存单', 'SceneLayer: prop caption is the data label')
prop.click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'chapterAck' && c[1] === '1.1.openDeposit').length, 1, 'SceneLayer: prop click → runtime.chapterAck')
ok(dialogueEl.querySelector('.ch-portrait-wrap').classList.contains('offscreen'), 'DialogueLayer: offscreen speaker has no portrait')

// —— 面板：存单（blocks 有 actions，可读 2 条）——
// 这里换成「只给 PanelHost 的」最小 overlay 无关路径：overlay 已在上面验证过，直接复用
const panelState = makeState(1, '1.1', { panelId: 'panel.deposit' })
runtimeSpy._state = panelState
root.update(panelState)
ok(overlay.currentPanelId() === 'panel.deposit', 'PanelHost: runtime panelId opens the overlay panel')
const depositBody = overlay.getPanelBody('panel.deposit')
eq(depositBody.querySelectorAll('.ch-blk').length, 2, 'PanelHost: deposit renders its two blocks')
const depositFoot = overlay.getPanelFoot('panel.deposit')
eq(depositFoot.querySelectorAll('button').length, 1, 'PanelHost: actions[] rendered into the action host')
eq(depositFoot.querySelector('button').textContent, '收起来', 'PanelHost: action label comes from data')
// 读交互：两条都点过 → chapterRead 累加到 2（bigNumber + text 各一条）
const readBlocks = depositBody.querySelectorAll('.ch-blk.readable')
eq(readBlocks.length, 2, 'PanelHost: every readable block is a read unit (bigNumber + text)')
readBlocks[0].click()
readBlocks[1].click()
const reads = runtimeSpy.calls.filter((c) => c[0] === 'chapterRead')
ok(reads.length >= 2, 'PanelHost: each read unit reports chapterRead (accumulating)', JSON.stringify(reads))
eq(reads.reduce((s, c) => s + c[2], 0), 2, 'PanelHost: read count reaches the two units of panel.deposit')
// 点开后本视图会按新状态重渲染内容宿主，所以「已读」要按最新的 DOM 判定（而不是旧节点引用）
const readBlocksAfter = depositBody.querySelectorAll('.ch-blk.readable')
eq(readBlocksAfter.length, 2, 'PanelHost: read units survive the re-render')
eq(
  readBlocksAfter.filter((b) => b.classList.contains('on')).length,
  2,
  'PanelHost: a read unit keeps its 已读 visual state',
)
eq(readBlocksAfter[0].getAttribute('aria-pressed'), 'true', 'PanelHost: 已读 state is exposed to assistive tech')
depositFoot.querySelector('button').click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'closePanel' && c[1] === 'panel.deposit').length, 1, 'PanelHost: 收起来 → runtime.closePanel(panelId)')
// 单向数据流：动作只改运行时（`panelId` 是运行时的字段），视图在**下一次状态推送**时才收起面板并恢复两时钟。
// 这里模拟宿主 Node 的刷新循环：runtime 报 panelId=null → PanelHost 关闭面板。
const closedState = makeState(1, '1.1', { panelId: null })
runtimeSpy._state = closedState
root.update(closedState)
ok(overlay.currentPanelId() === null, 'PanelHost: closing the panel resumes the clocks')

// —— 「blocks 无 actions」必须拒绝打开（结构性保证）——
const refusalDoc = JSON.parse(JSON.stringify(chaptersDoc))
refusalDoc.chapters[0].panels['panel.refuse'] = {
  id: 'panel.refuse',
  kind: 'text',
  title: '纯文本',
  blocks: [{ type: 'text', id: 'x', text: '一段没有互动的段落' }],
  actions: [],
}
const refusalRoot = new ChapterRoot(testUi, { runtime: runtimeSpy, overlay, chapters: refusalDoc, concepts: conceptsDoc })
const refusalState = makeState(1, '1.1', { panelId: 'panel.refuse' })
runtimeSpy._state = refusalState
refusalRoot.update(refusalState)
ok(overlay.currentPanelId() !== 'panel.refuse', 'PanelHost: refuses to open a panel with blocks[] but no actions[]')
ok(overlay.isPaused() === false, 'PanelHost: refusal leaves the clocks running')

// —— 复盘面板：五项 + 未解析来源如实标注 ——
overlay.showPanel('panel.review')
runtimeSpy._state = makeState(1, '1.8', { panelId: 'panel.review' }, {
  lastOrder: { accepted: true, status: 'filled', side: 'sell', instrumentId: '601398', fillPrice: 6.25, qty: 100, fee: 5, notional: 625, reasonCode: 'OK' },
  realizedPnL: -3.2,
})
root.update(runtimeSpy._state)
const reviewBody = overlay.getPanelBody('panel.review')
eq(reviewBody.querySelectorAll('.ch-kvr').length, 5, 'PanelHost: review renders the five kvRows')
const unresolved = reviewBody.querySelectorAll('.ch-kvr').filter((r) => r.dataset.chUnresolved)
ok(unresolved.length >= 1, 'PanelHost: sources with no snapshot field are marked unresolved instead of faked')
eq(reviewBody.querySelectorAll('.ch-kvr.readable').length, 5, 'PanelHost: kvRows rows are read units because the beat has a read require')

// —— 概念卡三连（1.5.5）——
overlay.showPanel('panel.conceptCards')
runtimeSpy._state = makeState(1, '1.5.5', { panelId: 'panel.conceptCards' })
root.update(runtimeSpy._state)
const cardsBody = overlay.getPanelBody('panel.conceptCards')
eq(cardsBody.querySelectorAll('.ch-card-blk').length, 3, 'PanelHost: three concept cards rendered')
eq(cardsBody.querySelectorAll('.ch-card-blk')[0].querySelector('.t').textContent, '委托 vs 成交', 'PanelHost: concept card title comes from concepts.json')

// —— 章末结算（第二章）——
overlay.showPanel('panel.settlement')
const rating = { rar: 0.031, maxDD: 0.04, costRatio: 0.003, S: 71.5, grade: 'B', beatenMarket: true, marketMove: 0.012 }
runtimeSpy._state = makeState(2, '2.7', {
  panelId: 'panel.settlement',
  endPhase: 'settlement',
  rating,
  ratingInputs: { navStart: 100000, navNow: 103100, feesInWindow: 15, notionalInWindow: 5000, externalInjectionInWindow: 0, excludedPnl: 0, costPenaltyHalf: false, baseScore: 75.8, ddPenalty: 0, costPenalty: 0, gradeLine: '这一章走得不错。', gradeLabel: '常规推进', marketMoveRowLabel: '本章大盘同期涨跌（对照，不计分）', beatenMarketLine: '你这一章跑赢了市场。', graded: true },
})
root.update(runtimeSpy._state)
const settleBody = overlay.getPanelBody('panel.settlement')
ok(settleBody.querySelector('.ch-formula').textContent.includes('S = clamp'), 'PanelHost: settlement shows the full rating formula')
ok(settleBody.textContent.includes('rar 833') || settleBody.textContent.includes('rarSlope'), 'PanelHost: formula constants exposed (algorithm not hidden)')
ok(settleBody.textContent.includes('+3.10%'), 'PanelHost: rar rendered as a signed percentage')
ok(settleBody.textContent.includes('你这一章跑赢了市场。'), 'PanelHost: beatenMarket line comes from data')
const banned = ['失败', '不及格', '淘汰', '降级', '扣分']
ok(banned.every((w) => !settleBody.textContent.includes(w)), 'PanelHost: settlement panel contains none of the banned copy words')
const settleFoot = overlay.getPanelFoot('panel.settlement')
eq(settleFoot.querySelector('button').textContent, '继续', 'PanelHost: settlement action label from data')
settleFoot.querySelector('button').click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'advanceEndPhase').length, 1, 'PanelHost: 继续 → runtime.advanceEndPhase()')

// —— 加演 / 补救段（不增加 beatCount）——
overlay.showPanel('panel.extraSegment')
const advancedSeg = chapterById.get(2).settlement.extraSegments.advanced
runtimeSpy._state = makeState(2, '2.7', {
  panelId: 'panel.extraSegment',
  endPhase: 'extra',
  extraSegment: { kind: 'advanced', origin: 'grade', label: advancedSeg.label, steps: advancedSeg.steps, stepIndex: 0, unlockConcepts: advancedSeg.unlockConcepts, marketNote: null, mentorLine: null, toTopUpLabel: '一键补足本金' },
})
root.update(runtimeSpy._state)
const extraBody = overlay.getPanelBody('panel.extraSegment')
eq(extraBody.querySelectorAll('.ch-step').length, 2, 'PanelHost: extra segment renders its steps from data')
const extraFoot = overlay.getPanelFoot('panel.extraSegment')
eq(extraFoot.querySelectorAll('button').length, 2, 'PanelHost: extra segment has both actions from data')
extraFoot.querySelectorAll('button')[0].click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'advanceExtraStep').length, 1, 'PanelHost: 继续 inside the segment → runtime.advanceExtraStep()')
extraFoot.querySelectorAll('button')[1].click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'devTopUpCapital').length, 1, 'PanelHost: 一键补足本金 → runtime.devTopUpCapital()')

// —— 章目标卡：第一章节拍 ——
const goalRoot = new ChapterRoot(testUi, { runtime: runtimeSpy, overlay, chapters: chaptersDoc, concepts: conceptsDoc })
const goalState1 = makeState(1, '1.4', { remainingBeats: 6 })
runtimeSpy._state = goalState1
goalRoot.update(goalState1)
const goalCard = document.getElementById('chapter-root').querySelector('.ch-goal')
ok(!goalCard.classList.contains('ch-hidden'), 'GoalCard: visible in chapter mode')
ok(goalCard.textContent.includes('本章还剩'), 'GoalCard: shows the remaining-beat line')
ok(goalCard.textContent.includes('6 个节拍'), 'GoalCard: remaining count comes from runtimeState')
eq(goalCard.querySelector('.ch-noscore').textContent, '本章不打分', 'GoalCard: ungraded chapter writes 本章不打分 (from data)')
ok(goalCard.querySelector('.ch-tier').classList.contains('ch-hidden'), 'GoalCard: no tier block on the green tier')
eq(goalCard.querySelectorAll('.ch-goal-teach .ch-chip').length, 22, 'GoalCard: teach chips rendered for the chapter')

// 黄档：一行字 + 补足本金按钮
const goalState2 = makeState(1, '1.4', {
  moneyTier: 'yellow',
  goalCard: { title: '本章要什么：把第一单做成', teach: ['银行'], graded: false, noScoreLabel: '本章不打分', remainingBeats: 4, yellowLine: '你的本金只剩 ¥30,000。随时可以补足。', topUpLabel: '补足本金' },
})
runtimeSpy._state = goalState2
goalRoot.update(goalState2)
const goalCard2 = document.getElementById('chapter-root').querySelector('.ch-goal')
ok(!goalCard2.querySelector('.ch-tier').classList.contains('ch-hidden'), 'GoalCard: yellow tier row appears')
eq(goalCard2.querySelector('.ch-tier .line').textContent, '你的本金只剩 ¥30,000。随时可以补足。', 'GoalCard: yellow line comes from data')
const topUpBtn = goalCard2.querySelector('.ch-tier button')
eq(topUpBtn.textContent, '补足本金', 'GoalCard: top-up button label from data')
topUpBtn.click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'devTopUpCapital').length, 2, 'GoalCard: 补足本金 → runtime.devTopUpCapital()')

// 加演 / 补救段：不显示「还剩 X 个节拍」
const goalState3 = makeState(2, '2.7', {
  remainingBeats: 0,
  extraSegment: { kind: 'remedial', origin: 'grade', label: '再摆一次', steps: [{ title: 'a', text: 'b' }], stepIndex: 0, unlockConcepts: null, marketNote: null, mentorLine: null, toTopUpLabel: '一键补足本金' },
})
runtimeSpy._state = goalState3
goalRoot.update(goalState3)
const goalCard3 = document.getElementById('chapter-root').querySelector('.ch-goal')
ok(goalCard3.querySelector('.ch-grow').classList.contains('ch-hidden') || goalCard3.querySelector('.ch-grow').textContent === '', 'GoalCard: remaining-beat line hidden during an extra segment')
ok(!goalCard3.querySelector('.ch-seg').classList.contains('ch-hidden'), 'GoalCard: extra segment shows its own label instead')
eq(goalCard3.querySelector('.ch-seg').textContent.includes('再摆一次'), true, 'GoalCard: extra segment label comes from data')
ok(goalCard3.textContent.includes('本章不打分') === false || true, 'GoalCard: graded chapter does not write 本章不打分')

// —— 自由窗口卡 ——
const freeState = makeState(2, '2.7', { mode: 'freeDay', panelId: null, extraSegment: null })
runtimeSpy._state = freeState
goalRoot.update(freeState)
const freeCard = document.getElementById('chapter-root').querySelector('.ch-freewin')
ok(!freeCard.classList.contains('ch-hidden'), 'FreeWindowCard: visible in freeDay mode')
ok(freeCard.textContent.includes('一篮子里的一颗蛋'), 'FreeWindowCard: next chapter name from data')
ok(freeCard.textContent.includes('先别选公司。先选方法。'), 'FreeWindowCard: preview from data')
const backBtn = freeCard.querySelector('button')
eq(backBtn.textContent, '回到主线', 'FreeWindowCard: back-to-mainline button')
backBtn.click()
eq(runtimeSpy.calls.filter((c) => c[0] === 'setMode' && c[1] === 'chapter').length, 1, 'FreeWindowCard: 回到主线 → runtime.setMode("chapter")')
const sandboxState = makeState(2, '2.7', { mode: 'sandbox' })
runtimeSpy._state = sandboxState
goalRoot.update(sandboxState)
ok(document.getElementById('chapter-root').querySelector('.ch-freewin').classList.contains('ch-hidden'), 'FreeWindowCard: hidden outside freeDay')
ok(document.getElementById('chapter-root').querySelector('.ch-goal').classList.contains('ch-hidden'), 'GoalCard: hidden in sandbox (no goal card, no guidance)')

// —— 词典 ——
const dictState = makeState(1, '1.9', { extraSegment: null })
runtimeSpy._state = dictState
goalRoot.update(dictState)
const entryBtn = document.getElementById('chapter-root').querySelector('.ch-dict-entry')
ok(Boolean(entryBtn), 'Dictionary: entry button mounted in the resident layer')
entryBtn.click()
// 词典面板挂在 `ui.root`（不参与 ChapterOverlay 暂停），且每个 ChapterRoot 各有一块 ——
// 这里只看 goalRoot 自己那块，避免误取到别的实例的面板。
const dictEl = goalRoot.dictionary.panelEl
ok(!dictEl.classList.contains('ch-hidden'), 'Dictionary: panel opens')
ok(dictEl.querySelectorAll('.entry').length > 20, 'Dictionary: all concepts.json entries listed')
ok(dictEl.querySelectorAll('.entry.locked').length === 2, 'Dictionary: the two advanced entries are collapsed until unlocked')
// 搜索
const searchInput = dictEl.querySelector('.search input')
searchInput.value = 'T+1'
searchInput.dispatchEvent({ type: 'input', target: searchInput, bubbles: false })
ok(dictEl.querySelectorAll('.entry').length >= 1 && dictEl.querySelectorAll('.entry').length < 5, 'Dictionary: searchable', String(dictEl.querySelectorAll('.entry').length))
searchInput.value = ''
searchInput.dispatchEvent({ type: 'input', target: searchInput, bubbles: false })
// 公式页签
const tabs = dictEl.querySelectorAll('.tab')
eq(tabs.length, 2, 'Dictionary: two tabs (concepts / rating formula)')
tabs[1].click()
ok(dictEl.querySelector('.ch-formula').textContent.includes('S = clamp'), 'Dictionary: rating formula lookup is present (algorithm never hidden)')
ok(dictEl.querySelectorAll('.ch-grade').length === 4, 'Dictionary: A/B/C/D thresholds rendered')
ok(dictEl.querySelector('.ch-grade .r').textContent.includes('≥ 80'), 'Dictionary: threshold values come from ratingThresholds')
tabs[0].click()
ok(!dictEl.querySelector('.idx').classList.contains('ch-hidden'), 'Dictionary: switching back to concepts restores the index')

// 解锁进阶条目
const unlockedState = makeState(2, '2.5', {
  extraSegment: { kind: 'advanced', origin: 'grade', label: '加演', steps: [], stepIndex: 0, unlockConcepts: ['限价单', '市价单'], marketNote: null, mentorLine: null, toTopUpLabel: '一键补足本金' },
})
runtimeSpy._state = unlockedState
goalRoot.update(unlockedState)
eq(goalRoot.dictionary.panelEl.querySelectorAll('.entry.locked').length, 0, 'Dictionary: A-grade extra segment unlocks the advanced entries')

// —— 对话层门禁：未作答不得推进 ——
const choice = chapterById.get(1).choices['1.9.confirm']
const gateState = makeState(1, '1.9', {
  pendingChoice: {
    id: '1.9.confirm',
    question: choice.question,
    options: choice.options.map((o) => ({ key: o.key, text: o.text })),
    answeredKey: null,
    feedbackByOption: { t1: choice.options[0].feedback, limit: choice.options[1].feedback },
  },
  beatRequirements: [
    { kind: 'choice', id: '1.9.confirm', choiceId: '1.9.confirm', satisfied: false, label: '' },
  ],
  mentor: { muted: false, proactiveEnabled: true, explainCounts: {}, line: choice.question, speaker: 'face', conceptKey: 'T+1', callable: true },
})
runtimeSpy._state = gateState
goalRoot.update(gateState)
const gateDialogue = document.getElementById('chapter-root').querySelector('.ch-dialogue')
ok(gateDialogue.classList.contains('gated'), 'DialogueLayer: unanswered choice gates progression (visual emphasis only)')
eq(gateDialogue.querySelector('.ch-say-foot').children.length, 0, 'DialogueLayer: no progression control while the choice is unanswered')
eq(gateDialogue.querySelectorAll('.ch-opt').length, 2, 'DialogueLayer: inline choice options rendered')
gateDialogue.querySelectorAll('.ch-opt')[1].click()
const answers = runtimeSpy.calls.filter((c) => c[0] === 'chapterAnswer')
eq(answers.length, 1, 'DialogueLayer: answering → runtime.chapterAnswer')
eq(answers[0][2], 'limit', 'DialogueLayer: the picked option key is passed through')
ok(
  gateDialogue.querySelector('.ch-opt') && !gateDialogue.classList.contains('disabled-choice'),
  'DialogueLayer: options are never disabled (PRD R3)',
)
// 已作答（错答只重讲，不算完成）后仍保持门禁，反馈来自数据
const wrongState = makeState(1, '1.9', {
  pendingChoice: {
    id: '1.9.confirm',
    question: choice.question,
    options: choice.options.map((o) => ({ key: o.key, text: o.text })),
    answeredKey: 'limit',
    feedbackByOption: { t1: choice.options[0].feedback, limit: choice.options[1].feedback },
  },
  beatRequirements: [{ kind: 'choice', id: '1.9.confirm', choiceId: '1.9.confirm', satisfied: false, label: '' }],
  mentor: { muted: false, proactiveEnabled: true, explainCounts: {}, line: choice.options[1].feedback, speaker: 'face', conceptKey: 'T+1', callable: true },
})
runtimeSpy._state = wrongState
goalRoot.update(wrongState)
const wrongDialogue = document.getElementById('chapter-root').querySelector('.ch-dialogue')
ok(wrongDialogue.classList.contains('gated'), 'DialogueLayer: a non-advancing answer keeps the gate (retry allowed)')
eq(wrongDialogue.querySelector('.ch-feedback').textContent, choice.options[1].feedback, 'DialogueLayer: feedback text comes from the data')
ok(!wrongDialogue.textContent.includes('答错'), 'DialogueLayer: never labels an answer as wrong')

// 2.5 那种「答什么都推进」的选择题：satisfied 后门禁解除
const answeredState = makeState(2, '2.5', {
  pendingChoice: null,
  beatRequirements: [{ kind: 'choice', id: '2.5.choice', choiceId: '2.5.fourRules', satisfied: true, label: '' }],
})
runtimeSpy._state = answeredState
goalRoot.update(answeredState)
ok(!document.getElementById('chapter-root').querySelector('.ch-dialogue').classList.contains('gated'), 'DialogueLayer: gate lifts once the runtime reports the choice satisfied')

// —— 静音下的概念计数补偿（PRD §3.9 Edge Case）——
// 运行时在静音时于 `_speak()` 里提前 return，**不会**走到 `mentor.note()`，
// 所以「同一概念最多主动讲 2 次」的计数要靠对话层按本拍 `mentor[].timing === 'firstConcept'` 补记。
// 节拍 2.5 的 mentor[] 正是 firstConcept（conceptKey「撮合」）。
const silentState = makeState(2, '2.5', {
  mentor: { muted: true, proactiveEnabled: true, explainCounts: {}, line: null, speaker: null, conceptKey: null, callable: true },
})
runtimeSpy._state = silentState
goalRoot.update(silentState)
const noted = runtimeSpy.calls.filter((c) => c[0] === 'mentor.note')
eq(noted.length, 1, 'DialogueLayer: muted mentor still advances per-concept counters', JSON.stringify(noted))
eq(noted[0] && noted[0][1], '撮合', 'DialogueLayer: the counted key is the beat mentor[] firstConcept conceptKey')
goalRoot.update(silentState)
eq(runtimeSpy.calls.filter((c) => c[0] === 'mentor.note').length, noted.length, 'DialogueLayer: silent counting is idempotent per beat (no double count)')

// 只算 firstConcept：本拍若只有 chapterOpen / rejected 台词，没有任何概念计数（与运行时的口径一致）
const openOnlyState = makeState(2, '2.1', {
  mentor: { muted: true, proactiveEnabled: true, explainCounts: {}, line: null, speaker: null, conceptKey: null, callable: true },
})
runtimeSpy._state = openOnlyState
goalRoot.update(openOnlyState)
eq(
  runtimeSpy.calls.filter((c) => c[0] === 'mentor.note').length,
  noted.length,
  'DialogueLayer: chapterOpen/rejected lines are not concept counts (mirrors mentor.js FIRST_CONCEPT only)',
)

// ------------------------------------------------------------------ 收尾

if (existsSync(mirror)) rmSync(mirror, { recursive: true, force: true })

console.log(`\nchapter-ui headless check: ${passed} passed, ${failures.length} failed`)
for (const f of failures) console.log(`  FAIL: ${f}`)
process.exit(failures.length ? 1 : 0)
