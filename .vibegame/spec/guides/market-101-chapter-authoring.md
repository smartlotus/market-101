# market-101 章节编写约定（Stage 1 起，Stage 2 增补块型 / 章级字段 / 全局面板 / 评定）

> 由 task `002-linear-spine` 建立。**新增任何一章（第三章及以后）之前必读**。
> 本文件只规定「怎么写」，不规定「写什么」——节拍内容、文案与门槛一律来自 `.vibegame/GDD.md`
> 的 `## 主线章节地图` 与当次任务的 `prd.md`。两者冲突时以当次 `prd.md` 为准。

## 一条铁律：章节是数据，不是代码

新增一章**只允许改数据**（`config/chapters.json` + `config/concepts.json`），不得改
`scripts/chapter/ChapterRuntime.js` 的解释逻辑。若某一拍需要新的**完成条件种类**，那是
解释器要扩的能力，必须先更新本文件与架构指南，再改解释器——不允许在某一拍里塞临时 JS。

## `config/chapters.json` 结构

```
{
  "chapters": [
    {
      "id": 1,
      "name": "第一笔钱",
      "preview": "一句话预告（自由窗口常驻卡显示下一章的名字与预告）",
      "implemented": true,          // false = 只作预告卡（如本任务的第三章 stub）
      "rated": false,               // 是否参与章末评级（PRD §3.3）
      "noScoreLabel": "本章不打分",  // rated=false 时章目标卡明写
      "goalCard": { "title": "...", "teach": ["conceptKey", "..."] },
      "savePoints": ["1.5"],         // 2–3 个自然停顿点，落在节拍交界
      "directedEvents": ["I04", "C03"],
      "beats": [ /* 见下 */ ]
    }
  ]
}
```

## 节拍字段

| 字段 | 作用 |
|------|------|
| `id` | 节拍号 + 章号（`'2.4'`）。**顺序由数组下标决定**，代码不解析该字符串 |
| `title` | 章目标卡/节拍进度显示用短标题 |
| `shell` | `'hidden'` / `'openAccount'` / `'full'` —— 本拍券商壳露多少 |
| `scene` | 场景层 id（`null` = 无场景层）；场景底走「manifest key 优先、代码绘制兜底」 |
| `sceneImageKey` | 可选 manifest key；缺省时用代码绘制场景底 |
| `mentor` | 本拍的导师发言（`speaker: 'offscreen'\|'face'`），可挂在拍首、拍中或条件触发的 `trigger` 上 |
| `require[]` | **完成条件**（全部满足才推进，见下） |
| `panels` | 本拍会打开的面板 id（面板 id 必须已在 `scenes/main.scene.json` 的 `ChapterOverlay.config.menus` 里静态声明） |
| `savePoint` | 本拍完成后写一次存档 |
| `forceEvent` | 钉死本拍消耗开市日时的定向事件 id |
| `advanceDay` | 本拍是否消耗一个交易日（用于节拍进度与定向事件队列） |
| `rejectExpected` | 第二章四类拒单节拍声明期望的 `reasonCode`（仅用于节拍文案与断言，不构成自动触发） |
| `giveUp` | 可选的「我暂时不想试」出口：玩家选择后系统代为演示一次，本拍完成（防卡死） |
| `extra` | 加演段（A 级）/ 补救段（D 级）声明；**不计入 `beatCount`** |
| `hints` | 视图层的提示文案（`1 手约` 列标签 / 超资金提示 / 回退按钮），按章取第一份 |
| `highlight` | 顶栏控件名 → 只做视觉强调（`advanceDayButton`），不禁用不置灰 |
| `propStyle` | 可选：场景层可点物件的外观名（如 `'tower'`），纯 CSS，视图自有排版 |

## 章级字段（Stage 2 追加）

| 字段 | 作用 |
|------|------|
| `unlocks` | `{instruments:[id]}`。**走完本章理解确认后**解锁的品种（`unlockedInstruments` 的唯一来源）；**词典条目的归属由词条自己的 `chapter` 决定，不在这里重复声明** |
| `noRemedial` | `true` = 本章红线路径空转（不建补救段、不开面、不出声），呼吸章用 |
| `matchGames` | 配对游戏数据：`{prompt, cards:[{id,name,sub}], targets:[{key,text}], pairs:[{cardId,targetKey,requireId}]}`；`requireId` 指向本拍一个 `interact` 完成条件（卡面用 `name`/`sub`，职责文本用 `text`） |
| `flowWalks` | 顺序走查数据：`{prompt, cards:[{id,label}], order:[stepId...], finishRequireId}`；`cards` 是**展示顺序**，`order` 是**必须的点击顺序**（两者故意不同），`finishRequireId` 指向本拍一个 `interact` 完成条件 |
| `pinnedEvents` | `[{beatId,eventId}]`：该拍进入时把定向事件钉进优先队列（真正被抽到需要本拍消耗一个开市日） |

## 顶层 `panels`（全局面板注册表，Stage 2 追加）

可在**任意节拍中**打开的面板（词典全文 / 导师对话历史 / 进度与解锁 / 净值与结业评定）声明在
`config/chapters.json` 的**顶层 `panels`** 对象里；`PanelHost` 先在本章 `panels` 里找，找不到再到这里找。
**lead 裁决（2026-09-17）**：这四块「参考资料」面板**豁免真暂停**，允许作为挂在 `#chapter-root` 上的
独立浮层实现（回合制游戏没有实时时钟，「真暂停」对它们只是外观问题）。因此运行时**不**挂起在屏的
节拍面板、**没有** `suspendedPanelId` 挂起 / 恢复机制；它们只需保证打开时不改游戏状态、不顶掉节拍面板。

## `require[]` 的闭合集合（不得自创）

| kind | 满足条件 |
|------|---------|
| `interact` | 指定 UI 互动控件被操作并回报（`chapterAck(id)`） |
| `read` | 指定面板被打开**并读满**（`chapterRead(panelId, count)`，如概念卡三连） |
| `select` | 选中的标的满足声明（固定 id 或 `cheapestAffordable`） |
| `submit` | 出现一次满足 `expect` 的委托结果（`{accepted:true}` 或 `{reasonCode:'REJECT_n'}`） |
| `choice` | 指定选择题被作答（`chapterAnswer(id,key)`，**不判对错**；答错只重讲） |
| `advanceDay` | 本拍发生过一次交易日推进 |

**Stage 2 明确：集合仍然只有这六种。** 配对游戏与顺序走查**不新增 kind** —— 它们的状态由
`ChapterRuntime` 的两个玩家动作持有（`chapterMatch(gameId,cardId,targetKey)` /
`chapterFlowStep(walkId,stepId)`，与 `chapterAnswer` 同形，DOM 与 `eval` 同路），
满足时**标记数据里声明的那个 `interact` 完成条件**；错误只返回 `{ok:false}`，不改任何状态，
因此「无限重试、不计数、不显示『错』」「错序不重置已走步骤」是结构性的，不需要在视图里补判。

要点：
- **没有任何自动推进路径**。禁止「进入本拍 N 秒后自动完成」「播放完台词自动完成」这类实现。
- **禁止把文本段落当互动**。每块面板至少有一个 `actions[]`，否则不允许打开。
- 需要玩家**主动越界**才能学到的规则（如故意拒单），必须用 `submit(expect:{reasonCode})` 表达，
  并且**必须**同时提供 `giveUp` 出口。

## 面板（互动容器）约定

- 面板内容 = `blocks[]`（块型见下）+ `actions[]`，由 `scripts/ui/chapter/PanelHost.js` 渲染进
  `ChapterOverlay` 的内容宿主。
- **块型全集**（`config/chapters.json` 只允许用这些）：
  `text` / `bigNumber` / `kvRows` / `list` / `formula` / `choiceGroup` / `steps` /
  `conceptCard` / `ruleCard` / `eventCard`（Stage 1）；
  `dictionary` / `mentorHistory` / `progressUnlock` / `navStanding` / `matchGame` / `flowWalk`（Stage 2）。
  后 6 个把专用视图挂进块内，**不吃** `read` 计数（不产生读条目）。
- 面板 id 一律 `pausedGame: true`（全屏/半屏接管必须真停住下面的游戏），且必须在
  `scenes/main.scene.json` 的 `ChapterOverlay.config.menus` 里**静态声明**（全局与章内面板一视同仁）。
- 所有面板状态存在 `ChapterRuntime` 里，DOM 只是投影——这样「面板打开时刷新」才能恢复。
- 数值一律 DOM/CSS 文本（`digit` 契约）；涨 = 红、跌 = 绿；委托结果色必须与方向色分离。
- **块型 `navStanding` 的数值来源是 `navHistory` 与 `graduationStanding`，参考线取宿主传入的
  `initialCash`**（不得在视图里写字面量 `100000`）。

## 评级（参与评级的章节）

- 窗口：本章第一个节拍开始 → 本章最后一个节拍结束。自由交易日窗口、纯自由模式、章与章之间**不进统计**。
- 三项输入全部由 `ChapterRuntime` 在自己的窗口内采样，**不得**向市场层写回任何东西。
- 采样点 = 窗口内每一次会改变 NAV 的动作 + 窗口首尾（`NAV₀` = 窗口首个采样，`NAV₁` = 结算瞬间）。
- `costRatio` 只统计**已成交**的费用与金额（挂单不计）；外来入金只记「补足本金 / 重置账户」。
- 评级只允许两个输出：本章档次（A/B/C/D）、结算面板数据。**A 级只给内容（加演段 + 词典进阶条目）**。
- 文案禁用词：失败 / 不及格 / 差 / 淘汰 / 降级 / 扣分。D 级一律写「本章需要再摆一次」。
- 加演段与补救段**不增加 `beatCount`**，显示为「加演」/「再摆一次」。

## 导师

- 开口时机只有五类（章开场 / 节拍推进且首次遇概念 / 被拒单·亏损·触线 / 章末 / 玩家呼叫），
  不得新增第六类。自由交易日与章内自由操作**绝不主动弹窗**（唯一例外：风险警示线）。
- **一切发言只走 `MentorScheduler.request()` 这一个闸门**（Stage 2 硬规则）。新增发言必须过闸门：
  - 承接语（回主线）→ `timing: CHAPTER_OPEN` + `source:'resume'`；
  - 选择题选项反馈 → `timing: REACTIVE` + `source:'choiceFeedback'`；
  - 风险警示线 → `timing: REACTIVE` + `isRiskWarning:true` + `source:'riskWarning'`（**只在 `freeDay`**，
    沙盒不开口；章内红线走补救段那条路径）。
  `source` 是诊断字段，**不是第六类时机**；`MentorScheduler` 的穷举表因此保持权威。
- 同一概念最多**主动**讲 2 次；计数跨章、跨存档保留；玩家主动呼叫不计入；静音状态下照常累加。
- **对话历史不属于 `MentorScheduler`**：它存在 `ChapterRuntime.mentorHistory`（进存档白名单），
  写入点是唯一的 `_setMentorLine()`；每条记录带所属章/拍与 `source`。
- **不得携带任何隐藏层**：不得有碎片收集、道具状态、身份揭示、延迟台词；**空的伏笔容器也不允许**。
  `mentor.js` 的状态面只有「讲解计数 + 静音 + 主动提示开关」三项，`saveStore` 白名单会自动挡住新增的隐藏状态。

## 存档

- 存档时机：进入 `savePoints`、节拍完成、模式切换、补足本金 / 重置、评级结算、面板打开。
- 内容 = 世界快照（`MarketSim.toJSON()`）+ 章节快照（`ChapterRuntime.toJSON()`）+ 版本号。
- 恢复定位到「最后完成节拍的下一个节拍的**起点**」。
- 新增可持久化字段必须同时登记进 `saveStore` 的白名单；**不得**为了省事绕过白名单。
- Stage 2 追加的章节白名单键（新章若用到新状态，按同一形态继续追加）：
  `unlockedChapters` / `advancedUnlocked` / `chapterGrades` / `injectionsTotal` / `mentorHistory` /
  `matchProgress` / `flowProgress`。`mentor` 子树**仍然只有三项**。
  （**无** `suspendedPanelId`：四块「参考资料」面板按 lead 裁决豁免真暂停、挂在 `#chapter-root`
  上，不经过 `openPanel()`，没有挂起 / 恢复路径，故不登记。）

## 结业评定（三档，全部都是毕业）

- `scripts/chapter/standing.js` 是纯函数；输入 = 已记录的章末评级 + `injectionsTotal` + 当前 NAV + 初始本金。
- 优秀 = 记录中 `A ≥ 4` **且**调整后累计收益 `> 0`；良好 = `A + B ≥ 4`；其余**全部**为结业
  （含亏掉大部分本金、含反复补足本金）。
- **调整后累计收益 = `(NAV_final − Σ全部外来入金 − ¥100,000) / ¥100,000`**；分母是固定初始本金。
  外来入金只累计「补足本金 / 重置账户」的净增额（重置记 `max(0, ¥100,000 − 重置前 NAV)`），
  首次 ¥100,000 入金不算。**剔除外来入金是整个设计最不能简化的一条。**
- 三档差别**只有**：证书上的一行字、老周的收场话、评级记录表的完整度。
  三档**不得**改变任何解锁、任何内容、任何后续可玩性。
- 门槛按字面实现，**分母永不硬编码**为「7」：只统计实际记录到的评级行数。

## 新增一章的自检清单

1. `config/chapters.json` 只加了数据，解释器未改（除非本文件同步更新了条件种类）。
2. 每一拍的 `require[]` 都能用上述六种 kind 表达；没有自动推进路径；配对/走查用两个运行时动作 + `interact`。
3. 定向事件 `forceEvent` / `pinnedEvents` / `directedEvents` 已按 GDD 节拍表填好；正文照录、未改写。
4. 章级 `unlocks.instruments` 已填（**只放品种**；词典归属由词条自己的 `chapter` 决定）。
5. 不参与评级的章：`rated:false` + `noScoreLabel` + `goalCard.graded:false`；呼吸章另加 `noRemedial:true`。
6. 评级章节已核对：窗口、外来入金剔除、五项锁、文案禁用词。
7. 存档白名单已登记所有新增持久字段。
8. 面板 id（含**顶层全局面板注册表**里的）已在场景 JSON 的 `config.menus` 静态声明。
9. 新块型只从本文件列的块型全集里取；新增块型必须先改本文件与 `PanelHost`，再写数据。
10. `vibegame run` + `vibegame play eval` 走一遍全章，确认每拍都能推进且不卡死。
