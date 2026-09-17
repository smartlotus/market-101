# market-101 架构约定（Stage 0 起，后续 Stage 共用）

> 由 task `001-shell-and-loop` 建立，`002-linear-spine` 追加「线性互动层」一章，
> `003-learn-layer` 追加「教学层（词典 / 导师 / 解锁 / 评定）」一章。
> 后续 Stage（ETF/基金/港股/美股/加密/期权、后续章节与尾声、结业典礼）实现前先读本文件；
> 新增章节前另读 [`market-101-chapter-authoring.md`](./market-101-chapter-authoring.md)。

## 一句话架构

这是一个 **DOM-UI 重度** 券商模拟器：整个界面是浏览器 DOM（深色券商风），由引擎 UI Layer（`sceneTree.ui`）挂载，**不**用 Phaser 精灵画任何东西，`Phaser.Text` 被禁止（所有文字 = DOM/CSS）。

## 分层（Node-vs-non-Node 的工程落地）

1. **纯逻辑层 `scripts/sim/`（普通 JS 模块，不继承 `Node`）**
   - 只做算术 / 状态 / 规则：账户、行情、事件抽签、撮合、费用、日历。
   - 无 DOM、无 `Node`、无 `update()`。`vibegame play eval` 可直接构造并断言。
   - 单一门面 `MarketSim.js` 持有 `Account` / `QuoteEngine` / `EventDeck` / `Calendar` / `pendingOrders`，暴露 `advanceDay()` / `submitOrder(spec)` / `reset()` / `selectInstrument(id)` / `snapshot()`。
2. **宿主 Node `scripts/BrokerShell.js`（唯一拥有 `runtimeState()` 的节点）**
   - 在 `scenes/main.scene.json` 的 root 上；无 `visual`、无 `collider`，`ready()` 里 `ui.mount()` 整个 DOM 树，持有一个 `MarketSim` 实例。
   - 把 `MarketSim.snapshot()` 包装成 `runtimeState()` 返回给 Runtime API 快照。
   - 暴露测试方法（供 `eval` 调用）：`advanceDay()`、`submitOrder(...)`、`reset()`、`selectInstrument(id)`、`devSetEvent(spec)`。
3. **视图层 `scripts/ui/*`（普通 JS 类，构造签名 `(root, ui)`）**
   - 每个区域一个 View，持有 `update(state)` 方法，把 `MarketSim.snapshot()` 渲染进 DOM。
   - 五块区域：顶栏 / 自选行情 / 行情主区（含 K 线 + 新闻卡）/ 下单面板 / 持仓与导师。
   - 数字一律 DOM/CSS 文本（digit HUD 契约 `dom-css-digit-hud`）；涨跌方向用 CSS class `dir-up` / `dir-down`，由 CSS 变量上色。

## K 线图路线（硬决策）

**纯 DOM/CSS 蜡烛图，不用 `<canvas>`、不用 Phaser。**
- 每根蜡烛 = 一个绝对/弹性定位的 DOM 元素：实体 `div`（红=`dir-up`、绿=`dir-down`）+ 上下影线 `div`。
- 价格轴刻度 / 最新价标签 = 叠加的 DOM 文本（`span`），满足「游戏内文字是 DOM/CSS」。
- 理由：①引擎禁 `Phaser.Text`，本项目 chrome 全 DOM/CSS；②DOM 蜡烛可被 CSS 统一上色、可访问、且测试可读 class；③绕开 canvas 文本合规问题。
- 资产图视窗内 K 线 < 2 根时显示空状态文案（不报错）。

## 数据存放（本任务建立，后续 Stage 追加字段）

- `config/instruments.json` —— 标的基础数据（code / name / board / limitPct / startPrice）。
- `config/events.json` —— 20 件事件 **逐条照录 GDD**，不得改写中文文案；`market` 全 `"A_SHARE"`，`day` 为 `null`（引擎动态分配），`fxTarget` 仅 M03 为 `"USD"` 其余 `null`，`conceptKeys` 为 `[]`（Stage 0 占位）。
- 加载：宿主 Node `ready()` 用引擎 `fetchJson('config/xxx.json')` 异步加载（参考 `liunian` 的 `VnDirector.js`）。

## 涨跌配色（硬规则，全项目统一）

涨 = 红、跌 = 绿（中国习惯）。任何 K 线、数字、徽章、按钮表达方向时都遵守。具体色值写在 `scripts/ui/theme.css` 的 CSS 变量（`--up` / `--down`），Stage 0 取 A 股常见值，后续如需由 artist 调整只改此处。

## 颜色 / 字体等未定细节

- 字体：系统 CJK 无衬线栈（`PingFang SC` / `Microsoft YaHei` / `sans-serif`），不联网拉字体，离线可用。
- 具体 `--up` / `--down` 十六进制由 architect 在 Stage 0 初定，后续可被 artist 微调（只改 CSS 变量）。

## 命名 / 注入约定

- `MarketSim` 的 `snapshot()` 字段是 Runtime 状态契约的唯一来源；新增 Stage 时往里加字段，并同步更新 task 的 `plan.md` Runtime State Contract。
- **`snapshot()` 既有字段只增不改**：字段名、类型、语义不得变更（Stage 0 的回归测试按名断言）；新状态一律**追加**。章节层状态以 `chapter` 子对象挂在宿主 Node 的 `runtimeState()` 顶层（`{...sim.snapshot(), chapter}`）。
- 拒单原因码统一枚举：`OK` / `REJECT_1`..`REJECT_9`（与 GDD 拒单表编号一致），`rejectText` 为中文可读文案。本任务已用到的额外码：`REJECT_10`（数量 ≤ 0）。

---

# 线性互动层（Stage 1，task `002-linear-spine` 建立）

## 层叠关系（在 Stage 0 五区域壳之上）

```
#game-container
├── canvas
├── #vibegame-ui (z=10, pointer-events:none)   ← UiLayer.root
│   ├── #broker-shell        Stage 0 五区域壳（可按节拍隐藏 / 只露开户门）
│   └── #chapter-root        场景层 + 对话层 + 常驻卡层（章目标卡 / 自由窗口卡）
└── vg-menu-* (z=20)         面板层 = ChapterOverlay（真暂停）
```

- **面板层永远在 `#vibegame-ui` 之上**：它由 `ChapterOverlay` 挂到 `#game-container`，不挂在 UI root 里。
- 层内可点元素必须显式 `pointer-events: auto`（UI root 默认 `none`）。
- 面板**互斥**：同刻只允许一个面板；切换时 `hidePanel(prev)` + `showPanel(next)` 必须在**同一次同步调用**内完成，避免 `sceneTree.running` 被观察到中间态为 `true`。

## 目录与职责（Stage 1 追加）

| 路径 | 职责 | 约束 |
|------|------|------|
| `config/chapters.json` | 章节/节拍**内容与完成条件**的唯一数据源 | 中文文案照录 PRD；新增章节 = 只加数据 |
| `config/concepts.json` | 概念词典条目（含四张规则卡与进阶条目） | 只放条目，不放逻辑 |
| `scripts/chapter/runtime.js` | 节拍状态机 / 完成条件求值 / 三模式 / 评级编排 / 存档编排 | **纯 JS**，无 DOM、不继承 `Node` |
| `scripts/chapter/rating.js` | 评级纯函数（`rar`/`maxDD`/`costRatio`/`S`/档次） | **不得 import `scripts/sim/*`** |
| `scripts/chapter/mentor.js` | 导师开口时机的调度与计数 | 状态面**只有**讲解计数与静音 |
| `scripts/chapter/saveStore.js` | `localStorage` 读写 + 白名单校验 | 未知键**丢弃** |
| `scripts/ChapterOverlay.js` | 唯一新增 Node，`extends GameOverlayModule` | 面板真暂停的唯一权威 |
| `scripts/ui/chapter/*` | 场景层 / 对话层 / 面板容器 / 常驻卡 / 词典 | 普通视图类，持有 `update(state)` |

## 五条硬规则（后续 Stage 必须遵守）

1. **节拍推进只能由 UI 互动驱动**。`config/chapters.json` 里每拍的 `require[]` 取自一个**闭合的小集合**：`interact` / `read` / `select` / `submit` / `choice` / `advanceDay`。集合之外不得新增「自动推进」或「读文本即过关」的路径 —— 这是「每个非交易互动都必须在 UI 上完成」的结构性保证。DOM 控件回调与 `eval` 钩子必须走**同一条** `chapterAck / chapterAnswer / chapterRead / chapterClosePanel` 代码路径。
2. **评级与市场层单向依赖**：`chapter → sim` 只读 `snapshot()`、只调 sim 已存在的动作 API；`scripts/sim/**` 不得 import `scripts/chapter/**`，也不得新增任何接收评级结果的 setter。评级只写两个输出（本章档次、结算面板数据）。
3. **存档 schema 白名单**：`saveStore` 逐键校验，未知键直接丢弃。任何「伏笔容器」（碎片 / 道具 / 身份 / 延迟台词）在物理上无法进入存档 —— 这是「导师不得携带任何隐藏层」的落地方式。
4. **节拍级存档 + 节拍起点恢复**：存档只落在节拍边界与声明为 `savePoint` 的节拍；恢复永远回到「最后完成节拍的下一个节拍的起点」，节拍中途不设中间存档。面板状态全部存在 `ChapterRuntime` 里（DOM 只是投影），因此「面板打开时刷新」也能恢复。
5. **场景层资产可缺省**：场景底优先用已注册 manifest key（`ui.setImage`），key 缺失时回退到代码绘制（CSS/SVG）。位图到位后只改 config，不改视图代码。

## 开局状态（Stage 1 起，与 Stage 0 不同）

- 开局 `mode='chapter'`、`chapterId=1`、`beatId='1.0'`；账户**未开户**（`accountOpened=false`、`cash=0`、`dayOpen=false`，日期不推进）；券商壳 `shellMode='hidden'`。
- `¥100,000` 由第一章节拍 1.3「入金」产生（`fundInitial()`，**不是**外来入金）；第一个交易日会话由 `beginFirstDay()` 在 1.3 之后开启。
- `defaultInstrumentId` = `601398`（买得起的最低价款）；节拍 1.4 另调 `selectCheapestAffordable()` 保证「默认高亮 = 买得起的最低价款」这一产品规则。
- 因此 **Stage 0 的回归测试若依赖「开局即可交易」，必须先用 `devSkipToSandbox()` 前置**（该钩子进入与 Stage 0 沙盒完全一致的状态，是合法状态而非测试专用 hack）。

---

# 教学层（Stage 2，task `003-learn-layer` 建立）

## 三条结构性隔离（后续 Stage 不得破坏）

1. **解锁只由「走完一章」驱动。** 唯一持久字段是 `chapter.unlockedChapters`（int[]），
   在 `confirmChapter()` 成功路径追加；`unlockedInstruments` 是**派生量**（`unlockedChapters` ×
   各章 `unlocks.instruments` 现算），**不落盘、不留第二份真相**。解锁路径**不得读** NAV、余额、
   `chapterGrades` 或 `rating` 的任何字段。
2. **成绩只写评定。** `scripts/chapter/standing.js` 与 `scripts/chapter/rating.js` 一样是**纯函数模块**
   （0 import、不 import `scripts/sim/*`）；`scripts/sim/**` 不得 import `scripts/chapter/**`。
   结业评定（优秀/良好/结业）只读「已记录的评级 + 毕生外来入金 + 当前 NAV + 初始本金」，
   **不写回任何东西**，也不参与解锁（PRD「解锁看理解，推进看成绩，毕业看两样都过」）。
3. **毕生外来入金与窗口内入金是两个量。** `injectionsTotal`（毕生，用于结业评定）在
   `noteInjection()` 里**无论模式与评级窗口**都累加；`ratingInputs.externalInjectionInWindow`
   保持 Stage 1 的窗口语义不变。初始 ¥100,000 由 `simAction:'fundInitial'` 产生，**从不经过
   `noteInjection`**，故永远不算外来入金。

## 词典（状态归属）

- 正文 = `config/concepts.json`（数据，`{key,name,chapter,advanced,def,explain,metaphor,related}` + 可选 `topic`）。
- **章节绑定**：`chapter` = 首次出现的章；已学章（∈ `unlockedChapters`，或当前章）展开全文，
  未学章只显名称 + 「下一章你会用到它」，但**可点开**、**不得禁用/灰行**。
- **进阶条目**：`advanced: true` 的条目由 `chapter.advancedUnlocked`（持久化，A 级结算时并入该章声明的
  `settlement.extraSegments.advanced.unlockConcepts`）判定；未解锁只折叠显名称，**搜索不得泄露正文**。
  ⚠️ 不得退回 Stage 1 的「当前 `extraSegment.unlockConcepts`」临时判定（段一结束会重新折叠）。

## 导师（状态面）

- `MentorScheduler` 的状态面**永远只有三项**：`explainCounts` / `muted` / `proactiveEnabled`。
  **对话历史不在这里** —— 它属于 `ChapterRuntime.mentorHistory`（进存档白名单），
  写入点是唯一的 `_setMentorLine()`。这样 `saveStore` 的 `mentor` 白名单仍只放行三项，
  「导师无隐藏层」在物理层依然成立。
- **章内一切发言只走 `MentorScheduler.request()` 一个闸门**（穷举五类时机）。任何新增发言都必须
  在 `request()` 里过一遍：承接语用 `timing: CHAPTER_OPEN`、选项反馈用 `timing: REACTIVE`，
  两者都带诊断字段 `source`（`resume` / `choiceFeedback` / `riskWarning` / `playerCall` / `beat` / `grade` / `segment`），
  `source` **不是**第六类时机。
- `request()` 的 `isRiskWarning` 参数有真实调用方：`freeDay` 中 `NAV < ¥10,000` 的**风险警示线**
  （GDD 明文的唯一例外）。沙盒不开口（干净避风港）；章内红线的补救段是另一条路径。

## 全局面板与挂起/恢复

- 需要在**任意节拍中**打开的面板（词典全文 / 导师对话历史 / 进度与解锁 / 净值与结业评定）
  声明在 `config/chapters.json` 的**顶层 `panels`**（全局面板注册表），而不是某章 `panels` 里。
- 它们**豁免真暂停**（lead 裁决 2026-09-17）：本作是回合制，没有实时时钟，故这四块面板作为
  挂在 `#chapter-root` 上的独立浮层实现，**不**占 `ChapterOverlay` 的暂停语义。
- **没有挂起/恢复**：它们不经过 `openPanel()`，也就不动 `panelId`、不会把节拍面板顶掉，
  因此运行时**不**存在 `suspendedPanelId`（存档白名单里也没有这个键）。
  它们只需保证：打开时不改游戏状态、不顶掉当前节拍面板、关闭后能继续当前节拍。

## 两个新互动（配对 / 顺序走查）

- 配对游戏与流程图走查**不新增 `require[]` kind**：进度状态在 `ChapterRuntime`
  （`matchProgress` / `flowProgress`），玩家动作是 `chapterMatch(gameId, cardId, targetKey)` 与
  `chapterFlowStep(walkId, stepId)`，与 `chapterAnswer` 同形；DOM 点击与 `eval` 钩子走同一条路径。
  正确时**标记该章数据声明的 `interact` 完成条件**；错误时只返回 `{ok:false}`，**不改任何状态**
  （天然满足「无限重试、不计数、不显示『错』」「错序不重置已走步骤」）。

## 第四章的两个数据开关

- `rated: false` + `noScoreLabel: '本章不打分'` + `goalCard.graded: false`：呼吸章不评级。
- `noRemedial: true`：红线路径在本章**空转**（不建补救段、不开面、不出声），节拍照常推进。
