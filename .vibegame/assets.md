# Asset Inventory

<!-- Maintained by artist agent. Do not edit manually. -->

## Characters

| Asset key | 文件路径 | 尺寸 | 出现时机 | 状态 |
|---|---|---|---|---|
| `mentor_portrait` | `assets/character/mentor_portrait.png` | 1024×1536 | 全程常驻：导师对话框立绘 | 已完成（本任务的定稿参考图） |

- **manifest**：`assets/manifest.json`（引擎默认读取路径；`project.json` 未设置 `manifests` 字段，故按默认 `["assets/manifest.json"]` 加载）
- **类型**：`image`；**`pivot`**: `[0.5, 0.5]`（UI 立绘，非地面锚定角色，故显式指定为居中锚点）
- **内容**：周老师（昵称老周）半身立绘，正面视角。中年男性，细框圆眼镜，花白短发，米白色针织毛衣，双手交叠于身前，笑容温和；背景为暖色居家办公室——左侧绿植、右侧冒着热气的咖啡杯、身后轻微模糊的 K 线墙（**无可读文字/数字**）。
- **风格**：温暖手绘 / 水彩质感，柔边、低饱和暖色调（暖中性色 + 绿植柔和绿 + 咖啡琥珀色），刻意与冷峻券商 UI 形成对比。
- **情绪目标**：安心（reassurance）——像一个不会让小白觉得自己笨的邻家长辈，而非华尔街式或说教式形象。

### 备选变体（未注册，供 lead 选择）

| 变体 | 文件路径 | 说明 |
|---|---|---|
| v2 | `assets/artifacts/mentor_v2_clean.png` | 更近的半身（胸像），一只手抬起作讲解手势，身份/服装/场景与定稿一致 |
| v3 | `assets/artifacts/mentor_v3_clean.png` | 半身，微微前倾、双手搭在桌上，暖金色午後光，绿植更完整 |

> 变体属于未定稿候选，按规则保留在 `assets/artifacts/`（不进入 `assets/` 根、不写入 manifest）。lead 选定后，我会把选中版本替换为 `assets/character/mentor_portrait.png` 并同步更新 manifest 与本文件。

## Scenes

| Asset key | 文件路径 | 尺寸 | 出现时机 | 情绪定位 | 状态 |
|---|---|---|---|---|---|
| `scene_bank` | `assets/scene/bank-hall.png` | 1672×941（16:9，比例 1.7768） | 第一章开场：银行大堂 | 秩序 / 安全感 | 已完成 |

- **manifest**：`assets/manifest.json`，键 `scene_bank` → `{ "type": "image", "path": "scene/bank-hall.png", "pivot": [0.5, 0.5] }`。
  - 路径相对于 `assets/manifest.json` 所在目录，即 `assets/scene/bank-hall.png`。
  - 显式写 `pivot: [0.5, 0.5]`：这是整屏背景，非地面锚定资产；不写会退回默认 `[0.5, 1]`（底边居中），若运行时代码按 pivot 定位会整体上移半个身位。
  - **不透明位图**（RGB，无 alpha），不用抠底。
- **内容（画面实际内容）**：白天的现代银行客户服务大堂。正对视角：一排玻璃隔断的柜台上方悬挂一条长条**叫号屏**（屏内容为模糊的柔和色块，无数字无文字）；柜台内有深色显示器与空白立牌；左侧一排鼠尾草绿扶手等候椅与一只小边几；**画面中部偏左、齐膝高的小木桌上放着一叠空白存单与一支插在笔座里的笔**；右侧落地窗投下暖白日光，窗前及柜台旁数盆阔叶绿植；抛光地面有柔和反光。**画面内没有任何人物**（委托允许 0–2 个模糊远景人物，取 0 以彻底避免「有张脸成为视觉焦点」）。
- **风格**：与 `mentor_portrait` 同一水彩手绘家族——纸张颗粒可见、柔边、低饱和暖中性色（米白/燕麦/浅木色）+ 绿植鼠尾草绿 + 窗光的冷白，完成度与立绘同级。
- **情绪目标**：平常、安心、略显乏味——这是「before」画面：玩家还不懂钱之前的生活。刻意不做成交易大厅、金库或赌场。
- **【给 programmer 的交接】存单热点位置（估算值，非精确测量）**：存单叠 + 笔座在归一化坐标（左上原点）约 **x 0.25–0.33、y 0.44–0.55**，中心 ≈ **(0.28, 0.50)**。即画面中部偏左、略高于竖直中线——**不在下三分之一内**，所以压在画面下半的对话框不会遮住这个点击热点。该数值是我在 4× 放大图上目测所得，请以运行时实测为准（CSS 层可用百分比定位，或按 `background-size: cover` 自行换算）。
- **构图约束（已按委托满足）**：下三分之一为安静的地面/低矮家具，无密集细节、无小物件；四边留有余量与空白（等候椅、绿植、柜台、小桌均完整落在画框内，没有被画框切断）；视觉重心在中部横带。
- **分辨率说明**：1672×941 对 1440×810 画布约 1.16×，与 `mentor_portrait`（1024×1536 对 100×128 的显示框）同量级。本机生图通路在当前比例提示下就是这个尺寸档，**未做任何放大重采样**（不做 resize 以免引入模糊）。

### 备选变体（未注册，供 lead 选择）

| 变体 | 文件路径 | 说明 |
|---|---|---|
| bank v1 | `assets/artifacts/raw/scene_bank_v1_2026-09-16T08-40-34.png` | 1536×1024（3:2）。水彩颗粒更重、更暖，柜台的柜员窗/圆形传单口/显示器更清晰；**但等候椅被画框左边缘切断**，且存单台是一块偏大的木墩（更像讲台而非小桌），故未选为定稿 |

> 定稿选取理由：v2 同时满足「四边不留重要细节被切」「存单桌小、齐膝、易发现且不抢眼」「原生 16:9」三条硬要求；v1 在第三条上需额外裁切，且在第一条上失分。v1 原图按规则保留在 `raw/`，未做二次加工。

## Sprites

(none yet)

## Tilesets

(none yet)

## Audio

(none yet)

## Missing / Blocked

> **2026-09-17 更新：Codex 生图额度已耗尽。** 批量脚本 `assets/artifacts/batch_gen.py` 已备好 17 个素材的 prompt
> （6 张导师表情 + 4 张场景 + 1 张黑天鹅 + 6 枚概念徽章），逐张重试 3 次后全部失败，
> 末次返回官方限流：`You've hit your usage limit ... try again at **Sep 19th, 2026 6:13 PM**`。
> **恢复时间：2026-09-19 18:13**。届时可原地重跑（脚本**断点续跑**，已完成的会跳过）：
> `cd games/market-101 && "$(uv tool dir --bin)/vibegame" python assets/artifacts/batch_gen.py`
> 进度与失败原因记录在 `.vibegame/logs/art-batch.jsonl`。
> 在此之前，下列素材一律沿用**代码绘制**实现，不得用占位色块充数。

- `mentor_expressions`（导师表情集：讲解 / 欣慰 / 提醒 / 偷笑 / 严肃，v2 新增：示弱·为难 / 告别·释然）——**未开始**，属于后续任务。
- `mentor_distant`（导师侧影/背影）、`scene_graduation`（结业证书场景）——未开始。
- `scene_office`（导师办公室）、`scene_cafe`（咖啡馆）、`scene_trading_floor`（交易大厅）、`scene_exchange`（交易所大厅）、`scene_late_night`（深夜书桌）、`event_black_swan`（黑天鹅插画）——未开始。
- `concept_badge`（概念徽章）、`achievement_card`（成就卡）、`chapter_card`（章节完成卡，8 张）——未开始。
- `scene_bank` **已完成**，不再是缺口。

## Handoff notes

### 生图工具与水印（重要，含一处流程变更）

- **本机有两条生图通路，水印行为不同**：
  1. `vibegame art gen image`（`.env` 的 `IMAGE_PROVIDER=Codex`）——**当前不可用**：上游 `artist/imagegen.py` 里有 `if model not in _supported_models(provider)` 的守卫，而 Codex provider 的 `SUPPORTED_MODELS` 是空集（注释写明「模型由账号侧决定」），因此在 Codex provider 下该命令必然报 `Codex does not support `（model 为空）。这是上游代码问题，不是配置问题。
  2. **本项目当前实际使用的通路**：`assets/artifacts/gen_codex.py`（用 `vibegame python` 运行），直接调用 `artist.providers.codex` 的 `t2i/i2i`，行为与 `cmd_image` 对齐（同样写 `.vibegame/logs/imagegen.jsonl`）。用法见该脚本头部注释。
- **路径注意**：`~/.codex/config.toml` 的默认模型是 `gpt-6-astra`，而 npm 全局的 codex CLI 是 `0.149.1`，会报 `The 'gpt-6-astra' model requires a newer version of Codex`。解决办法是显式指定 Codex 桌面版自带的较新 CLI（`codex-cli 0.154.0-alpha.6.2`）：
  `--codex-bin "C:/Users/28389/AppData/Local/OpenAI/Codex/bin/12219cbfbcbddde7/codex.exe"`。
  这只是一个参数，**没有改动任何全局配置或升级全局 CLI**。
- **水印结论（本次实测）**：**Codex 通路生成的图不烧入「AI生成 / WORKBUDDY」水印**。本次两张图都已在目标角落做 6× 放大复核：`assets/artifacts/sb_v2_corner_raw6.png` 为定稿的右下角 6× 放大，画面内只有地砖纹理，无任何文字/logo。
- **因此本次未运行 `assets/artifacts/clean_wm.py`，这是刻意的**：该脚本是对右下角一块矩形区域做 `cv2.inpaint`，对本来就没有水印的图会破坏画面（实测对比：`assets/artifacts/sb_v2_corner_raw6.png` 原图 vs `assets/artifacts/sb_v2_corner_clean6.png` 清理后——后者把地面反光糊成一片）。**如果后续某张图确实带了 WORKBUDDY 水印（例如改用 WorkBuddy 内置生图工具），再对那几张单独跑 clean_wm.py。**
- **硬约束复核（无任何可读文字）**：定稿已逐区放大复核——叫号屏仅为柔和色块（`sb_v2_zone_screen.png`）；左墙挂画为纯抽象色块（`sb_v2_zone_leftwall.png`）；右墙灰色铭牌完全空白（`sb_v2_zone_rightwall.png`）；柜台立牌为空白矩形、传单口为圆环（`sb_v2_zone_counters.png`）；存单为空白纸叠、无印刷线无字（`sb_v2_zone_table.png`）。画面内无字母、数字、汉字、招牌文案、logo、水印、K 线标签。
- **`vibegame vlm` 在本机不可用**（`VLM_API_KEY not set`），本文件的复核结论均由我在放大图上逐区目视得出，复核用的裁剪图已留在 `assets/artifacts/` 供随时复核。
- **raw 原始文件**按规则保留、不重命名不删除：
  - `assets/artifacts/raw/Warm_hand_painted_illustration_2026-09-15T12-59-03.png`（mentor 定稿 v1 源）
  - `assets/artifacts/raw/Same_person_as_image_1__keep_t_2026-09-15T13-03-45.png`（mentor v2 源）
  - `assets/artifacts/raw/Same_person_as_image_1__keep_t_2026-09-15T13-05-39.png`（mentor v3 源）
  - `assets/artifacts/raw/scene_bank_v1_2026-09-16T08-40-34.png`（scene_bank 备选 v1 源）
  - `assets/artifacts/raw/scene_bank_v2_2026-09-16T08-46-13.png`（scene_bank 定稿源，与 `assets/scene/bank-hall.png` 字节一致）
- **提示词存档**：`assets/artifacts/prompt_scene_bank.md`（v1）、`assets/artifacts/prompt_scene_bank_v2.md`（定稿 v2）。
- **后续资产一致性**：
  - 导师相关新图（表情集、侧影、结业场景）必须以 `assets/character/mentor_portrait.png` 作为 i2i 参考（`-i`），保持同一个人（脸型 / 眼镜 / 发型 / 毛衣 / 场景）。
  - 后续场景图必须以 `assets/character/mentor_portrait.png` 作为**风格锚点**（`-i`）以对齐水彩家族，并在提示词里显式声明「参考图仅定义画风与完成度，不要复制其人物与构图」（本次两张均如此，避免把导师本人画进大堂）。
  - **每个场景都要保留各自可辨识的情绪差异**（GDD Art Requirements v2.0 新增原则）：银行大堂=秩序/安心，办公室=庇护，咖啡馆=平等/陪伴，交易大厅=紧张（且每出现一次强度递增），交易所=肃穆，深夜书桌=孤独。
- **不透明底**：两项目前资产均为不透明位图，**非**透明底，这是刻意设计。

---

> Use the `language` value defined in `.vibegame/global.json` to write this file. Keep code identifiers, file paths, asset keys, and engine vocabulary in English.
