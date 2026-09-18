/**
 * 章节层主题 —— 场景层 / 对话层 / 常驻卡层 / 面板层 / 词典的**唯一**样式来源。
 *
 * 为什么单独一个模块：Stage 0 的 `scripts/ui/theme.js` 只服务 `#broker-shell`（五区域券商壳），
 * 而 Stage 1 的三层挂在 `#vibegame-ui` 的另一个兄弟节点（`#chapter-root`）与 `#game-container`
 * 下的面板宿主里，**不是** `#broker-shell` 的后代，因此拿不到它的 CSS 变量。
 * 这里把同一套色板再声明一次到两个作用域上，色值逐字取自 Stage 0 主题，不发明第二套视觉语言。
 *
 * 硬规则（PRD §2.3 / plan）：
 *   - 涨 = 红、跌 = 绿（中国习惯），方向色**只**由 `--up` / `--down` 驱动。
 *   - 委托结果色（成交 / 挂单 / 拒单）与方向色**分离**：`--ok` 蓝青 / `--reject` 琥珀。
 *     成交价、费用这类「委托结果」数值用 `--ok`，绝不用涨跌色。
 *   - 逻辑像素：只用 px / %，不用 vw / vh / position:fixed（`ui.md`）。
 *   - 层内可点元素显式 `pointer-events: auto`（UI root 默认 none）。
 */

/** 与 Stage 0 `scripts/ui/theme.js` 逐字相同的色板 + 章节层追加的几个中性色。 */
const PALETTE = `
  /* —— 价格方向色（唯一来源）—— */
  --up: #C2402F;
  --down: #2E7D5B;
  --up-soft: color-mix(in srgb, var(--up) 16%, transparent);
  --down-soft: color-mix(in srgb, var(--down) 16%, transparent);

  /* —— 委托结果色：与方向色解耦 —— 成交 = 蓝青，拒单 = 琥珀 —— */
  --ok: #2F6E7A;
  --ok-soft: rgba(47, 110, 122, 0.12);
  --ok-line: #2F6E7A;
  --reject: #8A5A12;
  --reject-soft: rgba(138, 90, 18, 0.16);
  --reject-line: #8A5A12;

  --bg: #D5C7AE;
  --screen: #E2D7C2;
  --panel: #FBF5E9;
  --panel-2: #F1E8D6;
  --sunken: #E7DCC7;
  --hair: #C4B393;
  --hair-2: #CFC0A1;
  --border: #8A7350;
  --text: #33291F;
  --text-2: #57493A;
  --muted: #7E6E56;
  --dim: #A08B6C;
  --accent: #3A6B8A;
  --gold: #D89A2C;

  /* —— 章节层专用（场景底 / 分档）—— */
  --scene-warm: #F0D9A8;
  --scene-marble: #C9AE83;
  --tier-green: #2E7D5B;
  --tier-yellow: #D89A2C;
  --tier-red: #C2402F;
`

const FONT_STACK = `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif`

export const CHAPTER_THEME_CSS = `
/* ==========================================================================
   作用域一：#chapter-root（场景层 / 对话层 / 常驻卡层），挂在 ui.root 上
   ========================================================================== */
#chapter-root {
${PALETTE}
  position: absolute;
  left: 0;
  top: 0;
  width: 1440px;
  height: 810px;
  box-sizing: border-box;
  pointer-events: none;
  color: var(--text);
  font-family: ${FONT_STACK};
  font-size: 13px;
  line-height: 1.5;
}

#chapter-root * { box-sizing: border-box; }
#chapter-root .dir-up { color: var(--up); }
#chapter-root .dir-down { color: var(--down); }
#chapter-root .dir-flat { color: var(--muted); }
#chapter-root .num { font-variant-numeric: tabular-nums; }
#chapter-root button { font: inherit; pointer-events: auto; cursor: pointer; border: none; }
#chapter-root button:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
#chapter-root .ch-hidden { display: none !important; }

/* 通用按钮：与券商壳 .cta / .ghost 同一手感 */
#chapter-root .ch-btn {
  background: linear-gradient(180deg, #4A7C99, #3A6B8A);
  color: #fff;
  font-weight: 600;
  border-radius: 7px;
  padding: 8px 15px;
  white-space: nowrap;
}
#chapter-root .ch-btn:hover { filter: brightness(1.1); }
#chapter-root .ch-btn.ghost {
  background: #DBD2C2;
  color: var(--text-2);
  border: 1px solid var(--hair);
  font-weight: 500;
}
#chapter-root .ch-btn.ghost:hover { border-color: #C8BAA2; color: var(--text); }
#chapter-root .ch-btn.gold {
  background: linear-gradient(180deg, #B8862C, #A8721F);
  color: #2A1D06;
}
#chapter-root .ch-btn.sm { padding: 5px 10px; font-size: 11.5px; border-radius: 6px; }

/* --------------------------------------------------------------------------
   场景层
   -------------------------------------------------------------------------- */
#chapter-root .ch-scene { position: absolute; inset: 0; pointer-events: none; }
/* 券商壳可见时（openAccount / full）：场景底收成底部环境带，不复盖券商界面 */
#chapter-root .ch-scene.band { top: auto; bottom: 0; height: 268px; }

#chapter-root .ch-scene-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 42%;
  filter: saturate(0.92) brightness(0.86);
}
#chapter-root .ch-scene-veil {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(235, 230, 221, 0.86) 0%, rgba(235, 230, 221, 0.22) 34%, rgba(235, 230, 221, 0.9) 100%),
    radial-gradient(760px 420px at 50% 46%, rgba(240, 217, 168, 0.12) 0%, transparent 70%);
}
#chapter-root .ch-scene.band .ch-scene-veil {
  background: linear-gradient(180deg, rgba(235, 230, 221, 0.96) 0%, rgba(235, 230, 221, 0.72) 60%);
}

/* —— 代码绘制的场景底（manifest key 缺省时的兜底，plan R7）—— */
#chapter-root .ch-draw { position: absolute; inset: 0; overflow: hidden; }
#chapter-root .ch-draw .floor {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 42%;
  background: linear-gradient(180deg, #1A1712 0%, #0D0C0A 100%);
}
#chapter-root .ch-draw .floor::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(90deg, rgba(240, 217, 168, 0.06) 0 1px, transparent 1px 84px);
}
#chapter-root .ch-draw .wall {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 58%;
  background:
    radial-gradient(900px 380px at 50% 96%, rgba(240, 217, 168, 0.16) 0%, transparent 72%),
    linear-gradient(180deg, #2A2419 0%, #3A3123 62%, #241F16 100%);
}
/* 大理石柱：代码绘制的银行大厅特征 */
#chapter-root .ch-draw .col {
  position: absolute;
  top: 6%;
  bottom: 34%;
  width: 54px;
  border-radius: 5px 5px 0 0;
  background: linear-gradient(90deg, #4A4234 0%, var(--scene-marble) 32%, #EFE3CB 50%, var(--scene-marble) 68%, #3A3428 100%);
  opacity: 0.92;
}
#chapter-root .ch-draw .col::after {
  content: '';
  position: absolute;
  left: -6px;
  right: -6px;
  top: -10px;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(180deg, #6B5F49, #3D3628);
}
#chapter-root .ch-draw .lightpool {
  position: absolute;
  left: 50%;
  top: 30%;
  width: 620px;
  height: 300px;
  transform: translate(-50%, -30%);
  background: radial-gradient(closest-side, rgba(240, 217, 168, 0.18), transparent 100%);
}
#chapter-root .ch-draw .counter {
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: 26%;
  height: 46px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, #5A4B33 0%, #2E271B 100%);
  border-top: 2px solid #7A6844;
}
/* 柜台后的格栅（业务窗口），给场景一个「这是银行」的轮廓 */
#chapter-root .ch-draw .grille {
  position: absolute;
  left: 18%;
  right: 18%;
  top: 16%;
  height: 32%;
  border-radius: 4px;
  background:
    repeating-linear-gradient(90deg, rgba(240, 217, 168, 0.14) 0 2px, transparent 2px 26px),
    linear-gradient(180deg, rgba(223, 218, 208, 0.9), rgba(231, 225, 214, 0.94));
  border: 1px solid rgba(240, 217, 168, 0.18);
}
/* 兜底用的通用室内底：无柱子，只有纵深与光池（场景 id 未知时也不出现空白矩形） */
#chapter-root .ch-draw.generic .col,
#chapter-root .ch-draw.generic .counter,
#chapter-root .ch-draw.generic .grille { display: none; }
#chapter-root .ch-draw.generic .wall {
  background:
    radial-gradient(760px 340px at 50% 88%, rgba(109, 92, 64, 0.14) 0%, transparent 72%),
    linear-gradient(180deg, #E0D8CA 0%, #DAD0C0 60%, #E2DBCE 100%);
}

#chapter-root .ch-scene-caption {
  position: absolute;
  left: 22px;
  top: 74px;
  display: flex;
  align-items: baseline;
  gap: 9px;
  color: var(--text-2);
  text-shadow: 0 1px 10px rgba(239, 236, 231, 0.8);
}
#chapter-root .ch-scene-caption .who { font-size: 15px; font-weight: 600; }
#chapter-root .ch-scene-caption .where { font-size: 11px; color: var(--dim); }
#chapter-root .ch-scene.band .ch-scene-caption { top: 10px; }

/* 场景内可点物件（活期存单等） */
#chapter-root .ch-prop {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  pointer-events: auto;
  cursor: pointer;
  background: none;
  padding: 0;
}
#chapter-root .ch-prop .paper {
  position: relative;
  width: 148px;
  height: 186px;
  border-radius: 4px;
  background: linear-gradient(174deg, #FBF3E0 0%, #EADFC4 100%);
  box-shadow: 0 14px 34px rgba(239, 236, 231, 0.62), 0 0 0 1px rgba(49, 43, 33, 0.16) inset;
  transition: transform 140ms ease-out, box-shadow 140ms ease-out;
}
#chapter-root .ch-prop .paper::before {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  top: 16px;
  height: 8px;
  background: #B9A88A;
  border-radius: 2px;
}
#chapter-root .ch-prop .paper::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 58px;
  height: 44px;
  background-image: repeating-linear-gradient(180deg, #C8BAA0 0 2px, transparent 2px 11px);
}
#chapter-root .ch-prop .paper .seal {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid rgba(174, 153, 116, 0.72);
  background: rgba(174, 153, 116, 0.14);
}
#chapter-root .ch-prop:hover .paper { transform: translateY(-5px) rotate(-1.2deg); box-shadow: 0 20px 40px rgba(239, 236, 231, 0.7); }
#chapter-root .ch-prop .cap {
  font-size: 12px;
  color: var(--text);
  background: rgba(233, 227, 217, 0.82);
  border: 1px solid var(--hair);
  border-radius: 999px;
  padding: 3px 11px;
  white-space: nowrap;
}
#chapter-root .ch-prop.on .cap { color: var(--text-2); border-color: var(--ok-line); }
/* 已完成（只做视觉强调，不禁用、不遮挡 —— PRD R3） */
#chapter-root .ch-prop.on .paper { filter: brightness(0.94); }

/* --------------------------------------------------------------------------
   对话层
   -------------------------------------------------------------------------- */
#chapter-root .ch-dialogue {
  position: absolute;
  left: 128px;
  right: 128px;
  bottom: 92px;
  display: flex;
  gap: 18px;
  padding: 16px 20px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background:
    linear-gradient(180deg, rgba(223, 215, 201, 0.96) 0%, rgba(229, 223, 212, 0.97) 100%);
  box-shadow: 0 22px 54px rgba(239, 236, 231, 0.62), 0 0 0 1px rgba(49, 43, 33, 0.03) inset;
  pointer-events: auto;
}
#chapter-root .ch-dialogue.bandless { bottom: 78px; }

#chapter-root .ch-portrait-wrap {
  position: relative;
  flex: 0 0 118px;
  width: 118px;
  height: 148px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--hair);
  background: linear-gradient(180deg, #DAD1C0, #E2DBCE);
}
#chapter-root .ch-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 16%;
  display: block;
}
#chapter-root .ch-portrait-wrap.offscreen { display: flex; align-items: center; justify-content: center; }
#chapter-root .ch-portrait-wrap.offscreen .ch-portrait { display: none; }
#chapter-root .ch-voice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 11.5px;
  letter-spacing: 1.5px;
}
#chapter-root .ch-voice .bars { display: flex; align-items: flex-end; gap: 3px; height: 26px; }
#chapter-root .ch-voice .bars i {
  width: 3px;
  border-radius: 2px;
  background: var(--muted);
  opacity: 0.75;
  animation: ch-voice 1150ms ease-in-out infinite;
}
#chapter-root .ch-voice .bars i:nth-child(1) { height: 10px; animation-delay: 0ms; }
#chapter-root .ch-voice .bars i:nth-child(2) { height: 22px; animation-delay: 130ms; }
#chapter-root .ch-voice .bars i:nth-child(3) { height: 15px; animation-delay: 260ms; }
#chapter-root .ch-voice .bars i:nth-child(4) { height: 26px; animation-delay: 390ms; }
#chapter-root .ch-voice .bars i:nth-child(5) { height: 12px; animation-delay: 520ms; }
@keyframes ch-voice {
  0%, 100% { transform: scaleY(0.55); opacity: 0.5; }
  50% { transform: scaleY(1); opacity: 0.95; }
}

#chapter-root .ch-say { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
#chapter-root .ch-say-head { display: flex; align-items: center; gap: 10px; }
#chapter-root .ch-speaker { color: var(--gold); font-size: 12px; font-weight: 600; letter-spacing: 0.4px; }
#chapter-root .ch-concept-tag {
  font-size: 10.5px;
  color: var(--muted);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 0 6px;
  line-height: 17px;
}
#chapter-root .ch-say-tools { margin-left: auto; display: flex; gap: 6px; }
#chapter-root .ch-tool {
  width: 26px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #DBD2C2;
  border: 1px solid var(--hair);
  color: var(--muted);
}
#chapter-root .ch-tool:hover { color: var(--text); border-color: #C8BAA2; }
#chapter-root .ch-tool.on { color: var(--gold); border-color: #4A3A18; background: #221C11; }
#chapter-root .ch-tool svg { display: block; }

#chapter-root .ch-line {
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--text);
  letter-spacing: 0.2px;
  min-height: 26px;
}
#chapter-root .ch-dialogue.folded .ch-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-2); }
#chapter-root .ch-dialogue.folded .ch-say-foot,
#chapter-root .ch-dialogue.folded .ch-choicebox { display: none; }

#chapter-root .ch-say-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: auto; }
#chapter-root .ch-say-foot .spacer { margin-left: auto; }
#chapter-root .ch-ask {
  font-size: 12px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 7px;
}

/* 内嵌选择题（对白层内的进度门禁） */
#chapter-root .ch-choicebox {
  margin-top: 8px;
  border-top: 1px solid var(--hair-2);
  padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
#chapter-root .ch-question { font-size: 13.5px; color: var(--text); line-height: 1.65; }
/* 门禁：未答完时把这道题提到最前（只是视觉强调，不禁用任何东西 —— PRD R3） */
#chapter-root .ch-dialogue.gated .ch-choicebox { border-top-color: var(--gold); }
#chapter-root .ch-dialogue.gated .ch-question { color: var(--text); font-weight: 600; }
#chapter-root .ch-dialogue.gated .ch-portrait { filter: brightness(1.06); }
#chapter-root .ch-opt {
  display: flex;
  gap: 9px;
  text-align: left;
  align-items: flex-start;
  width: 100%;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--sunken);
  border: 1px solid var(--hair);
  color: var(--text-2);
  font-size: 12.5px;
  line-height: 1.6;
}
#chapter-root .ch-opt:hover { border-color: #C8BAA2; color: var(--text); background: #DED6C8; }
#chapter-root .ch-opt .mk {
  flex: 0 0 15px;
  height: 15px;
  margin-top: 2px;
  border-radius: 50%;
  border: 1px solid var(--dim);
}
#chapter-root .ch-opt.picked { border-color: var(--accent); background: #DDD4C4; color: var(--text); }
#chapter-root .ch-opt.picked .mk { border-color: var(--accent); background: var(--accent); box-shadow: 0 0 0 3px rgba(144, 122, 85, 0.18) inset; }
#chapter-root .ch-feedback {
  margin-top: 2px;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--ok-soft);
  border: 1px solid var(--ok-line);
  color: #DCEBEE;
  font-size: 12.5px;
  line-height: 1.68;
}
#chapter-root .ch-gate {
  font-size: 11.5px;
  color: var(--gold);
  border: 1px dashed #4A3A18;
  background: rgba(224, 163, 62, 0.08);
  border-radius: 7px;
  padding: 6px 10px;
}

/* --------------------------------------------------------------------------
   常驻卡层
   -------------------------------------------------------------------------- */
#chapter-root .ch-resident {
  position: absolute;
  left: 14px;
  top: 84px;
  width: 306px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
#chapter-root .ch-card {
  pointer-events: auto;
  border-radius: 11px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(223, 215, 201, 0.95), rgba(229, 222, 210, 0.96));
  box-shadow: 0 14px 34px rgba(239, 236, 231, 0.5);
  padding: 12px 13px;
}
#chapter-root .ch-card .hd { display: flex; align-items: baseline; gap: 8px; }
#chapter-root .ch-card .hd .k { font-size: 10.5px; color: var(--dim); letter-spacing: 0.6px; }
#chapter-root .ch-card .hd .n { font-size: 11.5px; color: var(--gold); margin-left: auto; }
#chapter-root .ch-goal-title { font-size: 12.5px; color: var(--text); line-height: 1.62; margin-top: 6px; }
#chapter-root .ch-goal-teach { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 9px; }
#chapter-root .ch-chip {
  font-size: 10.5px;
  color: var(--text-2);
  background: #DBD2C2;
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 16px;
}
#chapter-root .ch-chip.ok { color: var(--ok); border-color: var(--ok-line); background: var(--ok-soft); }
#chapter-root .ch-goal-rows { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }
#chapter-root .ch-grow { display: flex; align-items: center; justify-content: space-between; gap: 9px; font-size: 12px; color: var(--muted); }
#chapter-root .ch-grow .v { color: var(--text-2); font-variant-numeric: tabular-nums; }
#chapter-root .ch-grow .v strong { color: var(--text); font-size: 14px; font-weight: 600; }
#chapter-root .ch-noscore {
  margin-top: 9px;
  font-size: 11.5px;
  color: var(--gold);
  border: 1px solid #4A3A18;
  background: rgba(224, 163, 62, 0.09);
  border-radius: 6px;
  padding: 5px 9px;
}
#chapter-root .ch-tier {
  margin-top: 9px;
  border-radius: 8px;
  padding: 9px 10px;
  border: 1px solid #4A3A18;
  background: rgba(224, 163, 62, 0.1);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
#chapter-root .ch-tier .line { font-size: 12px; color: #B8862C; line-height: 1.6; }
#chapter-root .ch-tier.red { border-color: #CDC0AA; background: rgba(144, 122, 84, 0.12); }
#chapter-root .ch-tier.red .line { color: #C2402F; }
#chapter-root .ch-tier button { align-self: flex-start; }
#chapter-root .ch-owed { margin-top: 10px; border-top: 1px solid var(--hair-2); padding-top: 8px; }
#chapter-root .ch-owed .k { font-size: 10.5px; color: var(--dim); }
#chapter-root .ch-owed .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
#chapter-root .ch-owed .ch-chip { color: var(--dim); }
#chapter-root .ch-seg {
  margin-top: 9px;
  font-size: 11.5px;
  color: var(--text-2);
  border: 1px solid var(--hair);
  border-radius: 6px;
  background: var(--sunken);
  padding: 6px 9px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
#chapter-root .ch-seg .tag { color: var(--accent); }

#chapter-root .ch-freewin .preview { margin-top: 7px; font-size: 12.5px; color: var(--text-2); line-height: 1.66; }
#chapter-root .ch-freewin .situation { margin-top: 6px; font-size: 11.5px; color: var(--muted); line-height: 1.6; }
#chapter-root .ch-freewin .foot { margin-top: 11px; display: flex; align-items: center; gap: 8px; }
#chapter-root .ch-freewin .foot .mode { font-size: 10.5px; color: var(--dim); margin-left: auto; }

/* 词典入口 + 词典面板（常驻在章节层，不暂停游戏） */
#chapter-root .ch-dict-entry {
  pointer-events: auto;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
  background: #DBD2C2;
  color: var(--text-2);
  border: 1px solid var(--hair);
  border-radius: 8px;
  padding: 7px 11px;
  font-size: 12px;
}
#chapter-root .ch-dict-entry:hover { border-color: #C8BAA2; color: var(--text); }

/* 导师对话历史入口（与词典入口同一款式、同一层，不暂停游戏） */
#chapter-root .ch-hist-entry {
  pointer-events: auto;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-top: 2px;
  background: #DBD2C2;
  color: var(--text-2);
  border: 1px solid var(--hair);
  border-radius: 8px;
  padding: 7px 11px;
  font-size: 12px;
}
#chapter-root .ch-hist-entry:hover { border-color: #C8BAA2; color: var(--text); }

/* ==========================================================================
   作用域二：面板层（ChapterOverlay 挂到 #game-container，不是 #chapter-root 的后代）
   ========================================================================== */
.ch-scrim {
  position: absolute;
  inset: 0;
  background: rgba(237, 232, 224, 0.74);
  backdrop-filter: blur(2.5px);
  z-index: 20;
}
.ch-panel {
${PALETTE}
  display: flex;
  flex-direction: column;
  align-items: stretch !important;
  justify-content: flex-start !important;
  gap: 0 !important;
  padding: 0 !important;
  border-radius: 14px !important;
  border: 1px solid var(--border) !important;
  background:
    linear-gradient(180deg, rgba(223, 215, 201, 0.99) 0%, rgba(230, 224, 213, 0.995) 100%) !important;
  box-shadow: 0 30px 80px rgba(239, 236, 231, 0.72), 0 0 0 1px rgba(49, 43, 33, 0.04) inset !important;
  overflow: hidden;
  color: var(--text);
  font-family: ${FONT_STACK};
  font-size: 13px;
  line-height: 1.5;
}
.ch-panel * { box-sizing: border-box; }
.ch-panel .dir-up { color: var(--up); }
.ch-panel .dir-down { color: var(--down); }
.ch-panel .dir-flat { color: var(--muted); }
.ch-panel .num { font-variant-numeric: tabular-nums; }
.ch-panel button { font: inherit; pointer-events: auto; cursor: pointer; border: none; }
.ch-panel button:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }

.ch-panel .ch-phd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px 12px;
  border-bottom: 1px solid var(--hair-2);
  background: linear-gradient(180deg, rgba(219, 209, 193, 0.9), rgba(226, 218, 205, 0.6));
}
.ch-panel .ch-phd .t { font-size: 16px; font-weight: 600; color: var(--text); letter-spacing: 0.4px; }
.ch-panel .ch-phd .kind { font-size: 10.5px; color: var(--dim); border: 1px solid var(--hair); border-radius: 4px; padding: 0 6px; line-height: 17px; }
.ch-panel .ch-phd .tag { margin-left: auto; font-size: 11px; color: var(--gold); }

.ch-panel .ch-pbody {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.ch-panel .ch-pfoot {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 12px 20px 14px;
  border-top: 1px solid var(--hair-2);
  background: rgba(232, 226, 215, 0.7);
}
.ch-panel .ch-pfoot .spacer { margin-left: auto; }
.ch-panel .ch-pfoot .note { font-size: 11px; color: var(--dim); }

.ch-panel .ch-btn {
  background: linear-gradient(180deg, #4A7C99, #3A6B8A);
  color: #fff;
  font-weight: 600;
  border-radius: 7px;
  padding: 9px 16px;
  white-space: nowrap;
}
.ch-panel .ch-btn:hover { filter: brightness(1.1); }
.ch-panel .ch-btn.ghost { background: #DBD2C2; color: var(--text-2); border: 1px solid var(--hair); font-weight: 500; }
.ch-panel .ch-btn.ghost:hover { border-color: #C8BAA2; color: var(--text); }
.ch-panel .ch-btn.gold { background: linear-gradient(180deg, #B8862C, #A8721F); color: #2A1D06; }
.ch-panel .ch-btn.sm { padding: 5px 11px; font-size: 11.5px; border-radius: 6px; }

/* —— 块：通用 —— */
.ch-panel .ch-blk { position: relative; }
/* 单条目块（text / bigNumber / formula / 卡片）的读标记落在整块右上角 */
.ch-panel .ch-blk.readable { cursor: pointer; border-radius: 9px; border-left: 3px solid transparent; padding-left: 5px; }
.ch-panel .ch-blk.readable:hover { background: rgba(219, 210, 194, 0.55); }
.ch-panel .ch-blk.readable.on { border-left-color: var(--ok-line); }
.ch-panel .ch-blk > .mk,
.ch-panel .ch-ev > .mk { position: absolute; right: 0; top: 0; display: block; }
.ch-panel .ch-li > .mk,
.ch-panel .ch-step > .mk { margin-left: auto; flex: 0 0 16px; display: block; }
.ch-panel .ch-blk-label { font-size: 11px; color: var(--dim); margin-bottom: 5px; }
.ch-panel .ch-text { font-size: 13.5px; color: var(--text-2); line-height: 1.75; }
.ch-panel .ch-big {
  border-radius: 11px;
  border: 1px solid var(--hair);
  background: linear-gradient(180deg, #DED6C8, #E4DCD0);
  padding: 13px 16px;
}
.ch-panel .ch-big .lab { font-size: 11px; color: var(--dim); }
.ch-panel .ch-big .v { font-size: 34px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; line-height: 1.28; }
.ch-panel .ch-big .v.sm { font-size: 26px; }
.ch-panel .ch-big .v.ok { color: var(--ok); }
.ch-panel .ch-big .sub { font-size: 11.5px; color: var(--muted); margin-top: 3px; }

.ch-panel .ch-kv { display: flex; flex-direction: column; gap: 1px; border-radius: 10px; border: 1px solid var(--hair); overflow: hidden; }
.ch-panel .ch-kvr {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 13px;
  background: var(--panel-2);
  border-left: 3px solid transparent;
  cursor: default;
}
.ch-panel .ch-kvr + .ch-kvr { border-top: 1px solid var(--hair-2); }
.ch-panel .ch-kvr .k { font-size: 12px; color: var(--muted); flex: 0 0 148px; }
.ch-panel .ch-kvr .v { margin-left: auto; font-size: 14px; color: var(--text); font-variant-numeric: tabular-nums; }
.ch-panel .ch-kvr .mk { flex: 0 0 16px; height: 16px; }
.ch-panel .ch-kv.readable .ch-kvr { cursor: pointer; border-left-color: var(--hair); }
.ch-panel .ch-kv.readable .ch-kvr:hover { background: #DDD4C4; }
.ch-panel .ch-kv.readable .ch-kvr.on { border-left-color: var(--ok-line); background: #E1DACC; }
.ch-panel .ch-kvr.unresolved .v { color: var(--dim); }

.ch-panel .ch-list { display: flex; flex-direction: column; gap: 6px; }
.ch-panel .ch-li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--sunken);
  border: 1px solid var(--hair);
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.66;
}
.ch-panel .ch-li .idx { color: var(--dim); font-variant-numeric: tabular-nums; flex: 0 0 20px; }

.ch-panel .ch-card-blk {
  position: relative;
  border-radius: 10px;
  border: 1px solid var(--hair);
  background: linear-gradient(180deg, #DED6C8, #E3DCCF);
  padding: 12px 14px;
}
/* 读标记：卡片类的标记落在右上角，行类是行尾（图标 only，不新增文案） */
.ch-panel .ch-card-blk > .mk { position: absolute; right: 12px; top: 12px; display: block; }
.ch-panel .ch-card-blk.readable .hd { padding-right: 22px; }
.ch-panel .ch-card-blk.hl { border-color: var(--hair); cursor: pointer; border-left: 3px solid transparent; }
.ch-panel .ch-card-blk.readable { cursor: pointer; border-left: 3px solid var(--hair); }
.ch-panel .ch-card-blk.readable:hover { background: #DDD4C4; }
.ch-panel .ch-card-blk.readable.on { border-left-color: var(--ok-line); background: #E1DACC; }
.ch-panel .ch-card-blk .hd { display: flex; align-items: center; gap: 8px; }
.ch-panel .ch-card-blk .hd .t { font-size: 13.5px; font-weight: 600; color: var(--text); }
.ch-panel .ch-card-blk .hd .tag { font-size: 10.5px; color: var(--gold); border: 1px solid #4A3A18; border-radius: 4px; padding: 0 6px; line-height: 16px; }
.ch-panel .ch-card-blk .hd .mk { margin-left: auto; flex: 0 0 16px; height: 16px; }
.ch-panel .ch-card-blk .def { font-size: 12.5px; color: var(--text-2); line-height: 1.7; margin-top: 6px; }
.ch-panel .ch-card-blk .exp { font-size: 12px; color: var(--muted); line-height: 1.7; margin-top: 6px; }
.ch-panel .ch-card-blk .meta { font-size: 11px; color: var(--dim); margin-top: 7px; display: flex; flex-wrap: wrap; gap: 5px; }
.ch-panel .ch-card-blk .meta .ch-chip,
.ch-panel .ch-chip {
  font-size: 10.5px;
  color: var(--text-2);
  background: #DBD2C2;
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 16px;
}
.ch-panel .ch-rule-text { font-size: 13px; color: var(--text); line-height: 1.75; margin-top: 6px; }
.ch-panel .ch-ev { display: flex; flex-direction: column; gap: 8px; }
.ch-panel .ch-ev .headline { font-size: 15px; color: var(--text); line-height: 1.6; }
.ch-panel .ch-ev .mentor { font-size: 12.5px; color: var(--text-2); line-height: 1.74; border-left: 2px solid var(--gold); padding-left: 10px; }
.ch-panel .ch-ev .sent { font-size: 11px; color: var(--dim); display: flex; gap: 8px; flex-wrap: wrap; }

.ch-panel .ch-formula { border-radius: 10px; border: 1px solid var(--hair); background: var(--sunken); padding: 13px 15px; }
.ch-panel .ch-formula .expr {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: #DCEBEE;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
.ch-panel .ch-formula .notes { margin: 9px 0 0; padding-left: 16px; }
.ch-panel .ch-formula .notes li { font-size: 11.5px; color: var(--muted); line-height: 1.72; }
.ch-panel .ch-steps { display: flex; flex-direction: column; gap: 8px; }
.ch-panel .ch-step {
  border-radius: 9px;
  border: 1px solid var(--hair);
  background: var(--sunken);
  padding: 11px 13px;
  border-left: 3px solid var(--hair-2);
}
.ch-panel .ch-step.on { border-left-color: var(--accent); background: #DFD6C8; }
.ch-panel .ch-step .t { font-size: 12.5px; font-weight: 600; color: var(--text); }
.ch-panel .ch-step .x { font-size: 12.5px; color: var(--text-2); line-height: 1.74; margin-top: 5px; }
.ch-panel .ch-step .n { font-size: 10.5px; color: var(--dim); font-variant-numeric: tabular-nums; }

.ch-panel .ch-choice { display: flex; flex-direction: column; gap: 8px; }
.ch-panel .ch-opt {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
  padding: 11px 13px;
  border-radius: 9px;
  background: var(--sunken);
  border: 1px solid var(--hair);
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.68;
  text-align: left;
}
.ch-panel .ch-opt:hover { border-color: #C8BAA2; color: var(--text); background: #DED6C8; }
.ch-panel .ch-opt .mk { flex: 0 0 15px; height: 15px; margin-top: 3px; border-radius: 50%; border: 1px solid var(--dim); }
.ch-panel .ch-opt.picked { border-color: var(--accent); background: #DDD4C4; color: var(--text); }
.ch-panel .ch-opt.picked .mk { border-color: var(--accent); background: var(--accent); }
.ch-panel .ch-feedback {
  padding: 10px 13px;
  border-radius: 9px;
  background: var(--ok-soft);
  border: 1px solid var(--ok-line);
  color: #DCEBEE;
  font-size: 12.5px;
  line-height: 1.72;
}
.ch-panel .ch-gate {
  font-size: 11.5px;
  color: var(--gold);
  border: 1px dashed #4A3A18;
  background: rgba(224, 163, 62, 0.08);
  border-radius: 7px;
  padding: 7px 11px;
}
.ch-panel .ch-refused { font-size: 12px; color: var(--reject); line-height: 1.7; }
.ch-panel .ch-mark-hint { font-size: 11.5px; color: var(--dim); }
.ch-panel .ch-grades { display: flex; gap: 6px; flex-wrap: wrap; }
.ch-panel .ch-grade {
  border: 1px solid var(--hair);
  border-radius: 8px;
  padding: 7px 11px;
  background: var(--sunken);
  min-width: 76px;
}
.ch-panel .ch-grade .g { font-size: 18px; font-weight: 600; color: var(--text-2); }
.ch-panel .ch-grade.on { border-color: var(--accent); background: #DDD4C4; }
.ch-panel .ch-grade.on .g { color: var(--text); }
.ch-panel .ch-grade .r { font-size: 10.5px; color: var(--dim); font-variant-numeric: tabular-nums; }

/* 词典面板（挂在 #chapter-root 下，不暂停游戏） */
#chapter-root .ch-dict { position: absolute; inset: 0; pointer-events: auto; display: flex; align-items: center; justify-content: center; }
#chapter-root .ch-dict .veil { position: absolute; inset: 0; background: rgba(237, 232, 224, 0.72); backdrop-filter: blur(2px); }
#chapter-root .ch-dict .sheet {
  position: relative;
  width: 1020px;
  height: 660px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(223, 215, 201, 0.99), rgba(231, 225, 214, 0.995));
  box-shadow: 0 30px 80px rgba(239, 236, 231, 0.72);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
#chapter-root .ch-dict .hd {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--hair-2);
}
#chapter-root .ch-dict .hd .t { font-size: 16px; font-weight: 600; }
#chapter-root .ch-dict .hd .spacer { margin-left: auto; }
#chapter-root .ch-dict .search {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--sunken);
  border: 1px solid var(--hair);
  border-radius: 7px;
  padding: 5px 10px;
  width: 300px;
}
#chapter-root .ch-dict .search input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font: inherit;
  font-size: 12.5px;
  pointer-events: auto;
  user-select: text;
}
#chapter-root .ch-dict .tabs { display: flex; gap: 6px; padding: 12px 18px 0; }
#chapter-root .ch-dict .tab {
  font-size: 12px;
  color: var(--muted);
  background: #DBD2C2;
  border: 1px solid var(--hair);
  border-radius: 7px;
  padding: 6px 13px;
}
#chapter-root .ch-dict .tab.on { color: #fff; background: #D1C5B1; border-color: #C8BAA2; font-weight: 600; }
#chapter-root .ch-dict .body { flex: 1; min-height: 0; display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 0; }
#chapter-root .ch-dict .idx {
  border-right: 1px solid var(--hair-2);
  overflow-y: auto;
  padding: 12px 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
#chapter-root .ch-dict .entry {
  text-align: left;
  border-radius: 7px;
  padding: 7px 10px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-2);
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 7px;
}
#chapter-root .ch-dict .entry:hover { background: #DDD4C4; color: var(--text); }
#chapter-root .ch-dict .entry.on { background: #DDD4C4; border-color: var(--hair); color: var(--text); font-weight: 600; }
#chapter-root .ch-dict .entry .tag { margin-left: auto; font-size: 10px; color: var(--gold); }
/* 「下一章你会用到它」只是指路：**不加禁用、不加灰行**（PRD §3），故颜色照常，只加一个标签 */
#chapter-root .ch-dict .entry .tag.next { color: var(--muted); margin-left: 6px; }
/* 折叠中的进阶条目：折叠外观（虚线边）而非禁用态，行照常可点 */
#chapter-root .ch-dict .entry.folded { border-color: var(--hair); }
#chapter-root .ch-dict .detail { overflow-y: auto; padding: 16px 20px 24px; }
#chapter-root .ch-dict .detail h3 { font-size: 17px; margin: 0 0 4px; color: var(--text); }
#chapter-root .ch-dict .detail .lbl { font-size: 11px; color: var(--dim); margin: 15px 0 5px; letter-spacing: 0.5px; }
#chapter-root .ch-dict .detail p { font-size: 13px; color: var(--text-2); line-height: 1.8; margin: 0; }
#chapter-root .ch-dict .detail .mt { color: var(--text-2); border-left: 2px solid var(--gold); padding-left: 11px; font-size: 12.5px; line-height: 1.78; }
#chapter-root .ch-dict .detail .rel { display: flex; flex-wrap: wrap; gap: 5px; }
#chapter-root .ch-dict .detail .detail-locked,
#chapter-root .ch-dict .detail .detail-folded {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 108px;
  margin-top: 8px;
  border: 1px dashed var(--hair);
  border-radius: 10px;
  background: var(--sunken);
}
/* 词典里的公式 / 门槛块与面板层同一套观感（同一个类名，两个作用域都要给样式） */
#chapter-root .ch-dict .ch-formula { border-radius: 10px; border: 1px solid var(--hair); background: var(--sunken); padding: 13px 15px; margin-top: 4px; }
#chapter-root .ch-dict .ch-formula .expr {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  color: #DCEBEE;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}
#chapter-root .ch-dict .ch-formula .notes { margin: 9px 0 0; padding-left: 16px; }
#chapter-root .ch-dict .ch-formula .notes li { font-size: 11.5px; color: var(--muted); line-height: 1.72; }
#chapter-root .ch-dict .meta { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
#chapter-root .ch-dict .ch-grades { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
#chapter-root .ch-dict .ch-grade { border: 1px solid var(--hair); border-radius: 8px; padding: 7px 11px; background: var(--sunken); min-width: 104px; }
#chapter-root .ch-dict .ch-grade .g { font-size: 18px; font-weight: 600; color: var(--text-2); }
#chapter-root .ch-dict .ch-grade.on { border-color: var(--accent); background: #DDD4C4; }
#chapter-root .ch-dict .ch-grade.on .g { color: var(--text); }
#chapter-root .ch-dict .ch-grade .r { font-size: 10.5px; color: var(--dim); font-variant-numeric: tabular-nums; line-height: 1.6; }
#chapter-root .ch-dict .ch-chip {
  font-size: 10.5px;
  color: var(--text-2);
  background: #DBD2C2;
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 1px 6px;
  line-height: 16px;
}
#chapter-root .ch-dict .scroll::-webkit-scrollbar,
#chapter-root .ch-dict .idx::-webkit-scrollbar,
#chapter-root .ch-dict .detail::-webkit-scrollbar { width: 6px; }
#chapter-root .ch-dict .idx::-webkit-scrollbar-thumb,
#chapter-root .ch-dict .detail::-webkit-scrollbar-thumb { background: #D0C4B0; border-radius: 3px; }

/* ---- 导师对话历史（复用词典的浮层骨架，换成一段一段的台词）---- */
#chapter-root .ch-hist .hist-settings { display: flex; gap: 6px; padding: 12px 18px 0; }
#chapter-root .ch-hist .hist-body { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 18px 20px; display: flex; flex-direction: column; gap: 9px; }
#chapter-root .ch-hist .hist-row {
  border: 1px solid var(--hair);
  border-left: 2px solid var(--gold);
  border-radius: 9px;
  background: var(--sunken);
  padding: 9px 12px;
}
#chapter-root .ch-hist .hist-meta { display: flex; align-items: center; gap: 7px; margin-bottom: 5px; }
#chapter-root .ch-hist .hist-meta .who { font-size: 11px; color: var(--text-2); font-weight: 600; }
#chapter-root .ch-hist .hist-line { font-size: 13px; color: var(--text-2); line-height: 1.78; }
#chapter-root .ch-hist .hist-empty {
  border: 1px dashed var(--hair);
  border-radius: 10px;
  background: var(--sunken);
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.8;
  padding: 16px 15px;
}
#chapter-root .ch-hist .hist-body::-webkit-scrollbar { width: 6px; }
#chapter-root .ch-hist .hist-body::-webkit-scrollbar-thumb { background: #D0C4B0; border-radius: 3px; }

/* ---- 对话层的「随时可以问他」两问（字面来自数据 copy.askBack）---- */
#chapter-root .ch-dialogue .ch-askbox { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 9px; }
#chapter-root .ch-dialogue .ch-askbox .ch-question { width: 100%; font-size: 12px; color: var(--muted); }
#chapter-root .ch-dialogue .ch-askbox .ch-ask-opt {
  pointer-events: auto;
  background: #DBD2C2;
  color: var(--text-2);
  border: 1px solid var(--hair);
  border-radius: 20px;
  padding: 6px 13px;
  font-size: 12px;
}
#chapter-root .ch-dialogue .ch-askbox .ch-ask-opt:hover { border-color: #C8BAA2; color: var(--text); }

/* ---- 进度与解锁（PRD §5）---- 复用词典的浮层骨架（.ch-dict .sheet），正文换成四段清单 ---- */
#chapter-root .ch-prog .body.prog-body { display: block; overflow-y: auto; padding: 6px 20px 22px; }
#chapter-root .ch-prog .prog-sec { margin-top: 16px; }
#chapter-root .ch-prog .prog-hd {
  font-size: 11.5px;
  color: var(--dim);
  letter-spacing: 0.6px;
  font-weight: 600;
  margin-bottom: 7px;
}
#chapter-root .ch-prog .prog-rows { display: flex; flex-direction: column; gap: 5px; }
#chapter-root .ch-prog .prog-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--hair);
  border-radius: 9px;
  background: var(--sunken);
  padding: 8px 12px;
  font-size: 12.5px;
  color: var(--text-2);
}
#chapter-root .ch-prog .prog-row .no { color: var(--dim); font-variant-numeric: tabular-nums; min-width: 58px; }
#chapter-root .ch-prog .prog-row .nm { color: var(--text); }
#chapter-root .ch-prog .prog-row .g {
  margin-left: auto;
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  min-width: 20px;
  text-align: right;
}
#chapter-root .ch-prog .prog-row .tag {
  margin-left: auto;
  font-size: 10.5px;
  border: 1px solid var(--hair);
  border-radius: 20px;
  padding: 2px 9px;
  color: var(--muted);
}
#chapter-root .ch-prog .prog-row .tag.done { color: var(--ok); border-color: var(--ok-line); }
#chapter-root .ch-prog .prog-row .tag.current { color: var(--gold); border-color: var(--reject-line); }
#chapter-root .ch-prog .prog-chips { display: flex; flex-wrap: wrap; gap: 5px; }
#chapter-root .ch-prog .prog-empty,
#chapter-root .ch-prog .prog-note {
  border: 1px dashed var(--hair);
  border-radius: 10px;
  background: var(--sunken);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.78;
  padding: 11px 13px;
}
#chapter-root .ch-prog .prog-note { margin-top: 18px; }
#chapter-root .ch-prog .body.prog-body::-webkit-scrollbar { width: 6px; }
#chapter-root .ch-prog .body.prog-body::-webkit-scrollbar-thumb { background: #D0C4B0; border-radius: 3px; }

/* ---- 净值曲线 + 结业评定（PRD §6）---- 曲线全部 DOM/CSS/SVG，轴标签与数值都是 DOM 文本 ---- */
#chapter-root .ch-nav .body.nav-body { display: block; overflow-y: auto; padding: 6px 20px 22px; }
#chapter-root .ch-nav .nav-sec { margin-top: 16px; }
#chapter-root .ch-nav .sec-hd {
  font-size: 11.5px;
  color: var(--dim);
  letter-spacing: 0.6px;
  font-weight: 600;
  margin-bottom: 8px;
}
#chapter-root .ch-nav .navchart {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  grid-template-rows: 260px auto auto;
  border: 1px solid var(--hair);
  border-radius: 11px;
  background: var(--sunken);
  padding: 10px 12px 8px;
}
#chapter-root .ch-nav .navchart .yaxis {
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  padding-right: 8px;
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
#chapter-root .ch-nav .navchart .plot { grid-column: 2; grid-row: 1; position: relative; }
#chapter-root .ch-nav .navchart .plot .svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#chapter-root .ch-nav .navchart .grid { stroke: var(--hair-2); stroke-width: 1; }
#chapter-root .ch-nav .navchart .refline { stroke: var(--gold); stroke-width: 1.4; stroke-dasharray: 5 4; }
#chapter-root .ch-nav .navchart .navline { fill: none; stroke: var(--ok); stroke-width: 2; stroke-linejoin: round; }
#chapter-root .ch-nav .navchart .navdot { fill: var(--ok); }
#chapter-root .ch-nav .navchart .reflab {
  position: absolute;
  right: 2px;
  transform: translateY(-50%);
  font-size: 10.5px;
  color: var(--gold);
  background: rgba(235, 230, 221, 0.82);
  border: 1px solid var(--reject-line);
  border-radius: 6px;
  padding: 1px 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
#chapter-root .ch-nav .navchart .xaxis { grid-column: 2; grid-row: 2; position: relative; height: 18px; margin-top: 4px; }
#chapter-root .ch-nav .navchart .xaxis .x-key { position: absolute; left: 0; top: 0; font-size: 10.5px; color: var(--dim); }
#chapter-root .ch-nav .navchart .xaxis .x-tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 10.5px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
#chapter-root .ch-nav .navchart .xaxis .x-tick.first { transform: translateX(0); }
#chapter-root .ch-nav .navchart .xaxis .x-tick.last { transform: translateX(-100%); }
#chapter-root .ch-nav .navchart .nav-legend {
  grid-column: 1 / -1;
  grid-row: 3;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
  font-size: 11.5px;
  color: var(--muted);
}
#chapter-root .ch-nav .navchart .nav-legend .lg { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
#chapter-root .ch-nav .navchart .nav-legend .key { width: 16px; height: 2px; border-radius: 2px; display: inline-block; }
#chapter-root .ch-nav .navchart .nav-legend .key.nav { background: var(--ok); }
#chapter-root .ch-nav .navchart .nav-legend .key.ref { background: var(--gold); height: 0; border-top: 2px dashed var(--gold); }
#chapter-root .ch-nav .nav-empty {
  margin-top: 10px;
  border: 1px dashed var(--hair);
  border-radius: 10px;
  background: var(--sunken);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.78;
  padding: 11px 13px;
}
#chapter-root .ch-nav .stand {
  border: 1px solid var(--hair);
  border-radius: 11px;
  background: var(--sunken);
  padding: 14px 16px;
}
#chapter-root .ch-nav .stand .tier-line { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
#chapter-root .ch-nav .stand .tier { font-size: 24px; font-weight: 600; color: var(--text); letter-spacing: 1px; }
#chapter-root .ch-nav .stand .tier-rule { font-size: 11.5px; color: var(--muted); }
#chapter-root .ch-nav .stand .cert {
  margin-top: 8px;
  font-size: 12px;
  color: var(--gold);
  border-left: 2px solid var(--gold);
  padding-left: 10px;
}
#chapter-root .ch-nav .stand .closing { margin-top: 10px; font-size: 12.5px; color: var(--text-2); line-height: 1.8; }
#chapter-root .ch-nav .stand .closing .who { color: var(--text); font-weight: 600; margin-right: 6px; }
#chapter-root .ch-nav .stand .formula {
  margin-top: 13px;
  border: 1px solid var(--hair);
  border-radius: 10px;
  background: var(--panel);
  padding: 11px 13px;
}
#chapter-root .ch-nav .stand .formula .expr {
  font-size: 11.5px;
  color: var(--text-2);
  border-bottom: 1px solid var(--hair-2);
  padding-bottom: 8px;
  margin-bottom: 7px;
  font-variant-numeric: tabular-nums;
}
#chapter-root .ch-nav .stand .frow { display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--muted); padding: 3px 0; }
#chapter-root .ch-nav .stand .frow .k { flex: 1; }
#chapter-root .ch-nav .stand .frow .v { font-variant-numeric: tabular-nums; color: var(--text-2); }
#chapter-root .ch-nav .stand .frow.result { border-top: 1px solid var(--hair-2); margin-top: 6px; padding-top: 8px; }
#chapter-root .ch-nav .stand .frow.result .k { color: var(--text); font-weight: 600; }
#chapter-root .ch-nav .stand .frow.result .v { font-size: 16px; font-weight: 600; }
#chapter-root .ch-nav .stand .grades { margin-top: 13px; }
#chapter-root .ch-nav .stand .g-hd { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: var(--muted); }
#chapter-root .ch-nav .stand .g-hd .t { color: var(--text-2); font-weight: 600; }
#chapter-root .ch-nav .stand .g-hd .n,
#chapter-root .ch-nav .stand .g-hd .c { font-variant-numeric: tabular-nums; }
#chapter-root .ch-nav .stand .g-rows { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
#chapter-root .ch-nav .stand .g-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--hair);
  border-radius: 8px;
  background: var(--panel);
  padding: 6px 10px;
  font-size: 11.5px;
  color: var(--muted);
}
#chapter-root .ch-nav .stand .g-row .nm { color: var(--text-2); }
#chapter-root .ch-nav .stand .g-row .g { font-size: 14px; font-weight: 600; color: var(--text); }
#chapter-root .ch-nav .stand .g-empty { font-size: 12px; color: var(--muted); line-height: 1.78; }
#chapter-root .ch-nav .stand .disc {
  margin-top: 13px;
  padding-top: 10px;
  border-top: 1px solid var(--hair-2);
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.78;
}
#chapter-root .ch-nav .body.nav-body::-webkit-scrollbar { width: 6px; }
#chapter-root .ch-nav .body.nav-body::-webkit-scrollbar-thumb { background: #D0C4B0; border-radius: 3px; }

/* ==========================================================================
   第四章「隔壁的三栋楼」—— 全部由代码绘制（无位图、无 canvas）
   ========================================================================== */

/* —— 街面场景底（cityStreet）—— */
#chapter-root .ch-draw .sky {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 62%;
  background: linear-gradient(180deg, #E4DDD1 0%, #D9D0BF 58%, #D0C4B0 100%);
}
#chapter-root .ch-draw .glow {
  position: absolute;
  left: 50%;
  top: 4%;
  width: 760px;
  height: 320px;
  transform: translateX(-50%);
  background: radial-gradient(closest-side, rgba(224, 163, 62, 0.14), transparent 100%);
}
/* 街对面的远景楼块（只有轮廓，不与三栋楼抢注意力） */
#chapter-root .ch-draw .farblock {
  position: absolute;
  top: 26%;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, #D9D0BF 0%, #DFD7C9 100%);
  border: 1px solid rgba(147, 125, 86, 0.14);
}
#chapter-root .ch-draw .pave {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 26%;
  height: 10%;
  background: linear-gradient(180deg, #D2CABC, #DBD4C8);
}
#chapter-root .ch-draw .kerb {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 34%;
  height: 3px;
  background: linear-gradient(90deg, rgba(240, 217, 168, 0.08), rgba(240, 217, 168, 0.26) 50%, rgba(240, 217, 168, 0.08));
}

/* —— 三栋楼：可点物件的「门脸」（屋顶 / 招牌 / 窗格 / 门 / 台阶）—— */
#chapter-root .ch-prop.tower { gap: 0; }
#chapter-root .ch-prop.tower .facade {
  position: relative;
  width: 156px;
  height: 232px;
  display: block;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(180deg, #C8BAA2 0%, #D0C4B0 46%, #D9CFBE 100%);
  border: 1px solid rgba(118, 101, 70, 0.22);
  box-shadow: 0 18px 40px rgba(239, 236, 231, 0.66);
  transition: transform 140ms ease-out, box-shadow 140ms ease-out, border-color 140ms ease-out;
}
#chapter-root .ch-prop.tower .facade .roof {
  position: absolute;
  left: -9px;
  right: -9px;
  top: -13px;
  height: 13px;
  border-radius: 3px;
  background: linear-gradient(180deg, #A18F71, #C2B7A4);
}
#chapter-root .ch-prop.tower .facade .sign {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 15px;
  height: 30px;
  border-radius: 3px;
  background: linear-gradient(180deg, #3A3222, #241F16);
  border: 1px solid var(--reject-line);
  color: var(--gold);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}
#chapter-root .ch-prop.tower .facade .win {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 58px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}
#chapter-root .ch-prop.tower .facade .win i {
  height: 17px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(224, 163, 62, 0.30), rgba(116, 98, 68, 0.16));
  box-shadow: 0 0 0 1px rgba(118, 101, 70, 0.12) inset;
}
#chapter-root .ch-prop.tower .facade .door {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 40px;
  height: 52px;
  transform: translateX(-50%);
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, #CCBFA8, #DFD6C8);
  border: 1px solid rgba(118, 101, 70, 0.22);
  border-bottom: none;
}
#chapter-root .ch-prop.tower .facade .steps {
  position: absolute;
  left: 50%;
  bottom: -7px;
  width: 74px;
  height: 7px;
  transform: translateX(-50%);
  border-radius: 0 0 3px 3px;
  background: linear-gradient(180deg, #D0C7B8, #DBD5C9);
}
#chapter-root .ch-prop.tower:hover .facade {
  transform: translateY(-6px);
  border-color: var(--ok-line);
  box-shadow: 0 24px 48px rgba(239, 236, 231, 0.72);
}
#chapter-root .ch-prop.tower.on .facade { filter: brightness(0.94); }
#chapter-root .ch-prop.tower .cap { margin-top: 12px; }

/* —— 面板内：三栋楼的介绍（tower 块）—— */
.ch-panel .ch-tower { display: flex; gap: 18px; align-items: flex-start; }
.ch-panel .ch-tower .facade {
  position: relative;
  flex: 0 0 132px;
  height: 196px;
  border-radius: 4px;
  background: linear-gradient(180deg, #C8BAA2 0%, #D0C4B0 46%, #D9CFBE 100%);
  border: 1px solid rgba(118, 101, 70, 0.22);
}
.ch-panel .ch-tower .facade .roof {
  position: absolute;
  left: -7px;
  right: -7px;
  top: -11px;
  height: 11px;
  border-radius: 3px;
  background: linear-gradient(180deg, #A18F71, #C2B7A4);
}
.ch-panel .ch-tower .facade .sign {
  position: absolute;
  left: 9px;
  right: 9px;
  top: 13px;
  height: 26px;
  border-radius: 3px;
  background: linear-gradient(180deg, #3A3222, #241F16);
  border: 1px solid var(--reject-line);
  color: var(--gold);
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ch-panel .ch-tower .facade .win {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 50px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.ch-panel .ch-tower .facade .win i {
  height: 15px;
  border-radius: 2px;
  background: linear-gradient(180deg, rgba(224, 163, 62, 0.30), rgba(116, 98, 68, 0.16));
}
.ch-panel .ch-tower .facade .door {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 34px;
  height: 44px;
  transform: translateX(-50%);
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, #CCBFA8, #DFD6C8);
  border: 1px solid rgba(118, 101, 70, 0.22);
  border-bottom: none;
}
.ch-panel .ch-tower .facade .base {
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 62px;
  height: 6px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, #D0C7B8, #DBD5C9);
}
.ch-panel .ch-tower .bd { flex: 1; min-width: 0; }
.ch-panel .ch-tower .nm { font-size: 15px; font-weight: 600; color: var(--text); }
.ch-panel .ch-tower .tg { margin-top: 4px; font-size: 11.5px; color: var(--dim); }
.ch-panel .ch-tower .lines { margin: 10px 0 0; padding-left: 16px; }
.ch-panel .ch-tower .lines li { font-size: 12.5px; color: var(--text-2); line-height: 1.82; }
.ch-panel .ch-tower .say {
  margin-top: 12px;
  display: flex;
  gap: 8px;
  border-left: 2px solid #C8BAA2;
  padding-left: 10px;
}
.ch-panel .ch-tower .say .who { flex: 0 0 auto; font-size: 12px; color: var(--gold); }
.ch-panel .ch-tower .say .x { font-size: 12.5px; color: var(--text-2); line-height: 1.82; }

/* —— 面板内：挂单簿（orderBook 块）—— */
.ch-panel .ch-book .bk-lab { font-size: 12px; color: var(--muted); margin-bottom: 9px; }
.ch-panel .ch-book .bk-grid { display: flex; gap: 16px; }
.ch-panel .ch-book .bk-col { flex: 1; min-width: 0; }
.ch-panel .ch-book .bk-col .hd {
  font-size: 11px;
  color: var(--dim);
  border-bottom: 1px solid var(--hair-2);
  padding-bottom: 6px;
  margin-bottom: 6px;
}
.ch-panel .ch-book .bk-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-left: 3px solid transparent;
  padding-left: 6px;
}
.ch-panel .ch-book .bk-row .p { flex: 0 0 74px; font-size: 12.5px; color: var(--text-2); }
.ch-panel .ch-book .bk-row .q { flex: 0 0 62px; font-size: 12px; color: var(--muted); }
.ch-panel .ch-book .bk-row .bar {
  display: block;
  height: 8px;
  border-radius: 2px;
  background: linear-gradient(90deg, #C4B49A, #B1A289);
  min-width: 4px;
}
.ch-panel .ch-book .bk-col.bids .bk-row .bar { background: linear-gradient(90deg, #C8B9A1, #B8AB94); }
.ch-panel .ch-book .bk-deal { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.ch-panel .ch-book .bk-note { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.78; }

/* —— 面板内：配对游戏（matchGame 块）—— */
.ch-panel .ch-mg .mg-prompt { font-size: 13px; color: var(--text); line-height: 1.8; }
.ch-panel .ch-mg .mg-prog { margin-top: 5px; font-size: 11.5px; color: var(--dim); font-variant-numeric: tabular-nums; }
.ch-panel .ch-mg .mg-cards { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.ch-panel .ch-mg .mg-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 116px;
  padding: 9px 11px;
  border-radius: 9px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-left: 3px solid var(--hair);
  color: var(--text-2);
  text-align: left;
}
.ch-panel .ch-mg .mg-card:hover { background: #DDD4C4; }
.ch-panel .ch-mg .mg-card.picked { border-color: var(--accent); border-left-color: var(--accent); background: #DAD0C0; }
.ch-panel .ch-mg .mg-card.done { border-left-color: var(--ok-line); background: #E1DACC; }
.ch-panel .ch-mg .mg-card .nm { font-size: 13px; font-weight: 600; color: var(--text); }
.ch-panel .ch-mg .mg-card .sub { font-size: 10.5px; color: var(--dim); }
.ch-panel .ch-mg .mg-card .mk { font-size: 10.5px; color: var(--ok); }
.ch-panel .ch-mg .mg-targets { margin-top: 14px; display: flex; flex-direction: column; gap: 7px; }
.ch-panel .ch-mg .mg-target {
  display: block;
  width: 100%;
  text-align: left;
  padding: 9px 12px;
  border-radius: 9px;
  background: var(--sunken);
  border: 1px solid var(--hair-2);
  color: var(--text-2);
  font-size: 12.5px;
  line-height: 1.7;
}
.ch-panel .ch-mg .mg-target:hover { background: #DDD4C4; border-color: var(--hair); }

/* —— 面板内：流程走查（flowWalk 块）—— */
.ch-panel .ch-fw .fw-prompt { font-size: 13px; color: var(--text); line-height: 1.8; }
.ch-panel .ch-fw .fw-prog { margin-top: 5px; font-size: 11.5px; color: var(--dim); font-variant-numeric: tabular-nums; }
.ch-panel .ch-fw .fw-rail { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.ch-panel .ch-fw .fw-empty { font-size: 12px; color: var(--dim); }
.ch-panel .ch-fw .fw-step {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--ok-line);
  background: #E1DACC;
  border-radius: 9px;
  padding: 8px 11px;
}
.ch-panel .ch-fw .fw-step .n {
  flex: 0 0 20px;
  font-size: 12px;
  color: var(--ok);
  font-variant-numeric: tabular-nums;
}
.ch-panel .ch-fw .fw-step .lb { font-size: 12.5px; color: var(--text-2); }
.ch-panel .ch-fw .fw-pool { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.ch-panel .ch-fw .fw-card {
  padding: 9px 12px;
  border-radius: 9px;
  background: var(--panel-2);
  border: 1px solid var(--hair);
  color: var(--text-2);
  font-size: 12.5px;
  text-align: left;
}
.ch-panel .ch-fw .fw-card:hover { background: #DDD4C4; }
.ch-panel .ch-fw .fw-card.done { border-color: var(--ok-line); background: #E1DACC; color: var(--ok); }

/* ==========================================================================
   第三章「一篮子里的一颗蛋」—— 产品并排对照 / 码排文档（全部由代码绘制）
   ========================================================================== */

/* —— 产品对比（compare 块）—— 左列 ETF、右列场外基金，逐行对齐 —— */
.ch-panel .ch-cmp {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0 12px;
}
.ch-panel .ch-cmp-h,
.ch-panel .ch-cmp-r {
  display: grid;
  grid-template-columns: 96px 1fr 1fr;
  gap: 10px;
  align-items: start;
}
.ch-panel .ch-cmp-h {
  padding-bottom: 6px;
  border-bottom: 2px solid var(--border);
}
.ch-panel .ch-cmp-h .lt,
.ch-panel .ch-cmp-h .rt {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.ch-panel .ch-cmp-h .lt { color: var(--accent); }
.ch-panel .ch-cmp-h .rt { color: var(--gold); }
.ch-panel .ch-cmp-r {
  padding: 9px 10px;
  border: 1px solid var(--hair);
  border-radius: 3px;
  background: var(--panel-2);
  cursor: pointer;
  pointer-events: auto;
}
.ch-panel .ch-cmp-r:hover { background: #F7F0E1; border-color: var(--border); }
.ch-panel .ch-cmp-r.read { border-color: var(--ok-line); background: #EEF3F3; }
.ch-panel .ch-cmp-r .k { font-size: 12.5px; color: var(--muted); line-height: 1.5; }
.ch-panel .ch-cmp-r .lt,
.ch-panel .ch-cmp-r .rt { font-size: 12.5px; color: var(--text-2); line-height: 1.6; }
.ch-panel .ch-cmp-r .lt { border-left: 3px solid var(--accent); padding-left: 8px; }
.ch-panel .ch-cmp-r .rt { border-left: 3px solid var(--gold); padding-left: 8px; }
.ch-panel .ch-cmp-r .nt {
  grid-column: 1 / -1;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

/* —— 码排文档（docCard 块）—— 基金招募说明书的关键字段 —— */
.ch-panel .ch-doc {
  margin: 8px 0 12px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: #FDFAF1;
  box-shadow: 0 2px 0 rgba(90, 74, 48, 0.10);
}
.ch-panel .ch-doc-t {
  padding: 11px 16px 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  border-bottom: 1px dashed var(--hair);
}
.ch-panel .ch-doc-s {
  padding: 7px 16px 0;
  font-size: 12px;
  color: var(--muted);
}
.ch-panel .ch-doc-b { padding: 8px 16px 12px; }
.ch-panel .ch-doc-f {
  display: grid;
  grid-template-columns: 118px 1fr;
  gap: 10px;
  padding: 7px 8px;
  border-bottom: 1px dotted var(--hair);
  cursor: pointer;
  pointer-events: auto;
  border-radius: 2px;
}
.ch-panel .ch-doc-f:last-child { border-bottom: none; }
.ch-panel .ch-doc-f:hover { background: #F5EEE0; }
.ch-panel .ch-doc-f.read { background: #EEF3F3; }
.ch-panel .ch-doc-f .k { font-size: 12.5px; color: var(--muted); }
.ch-panel .ch-doc-f .v { font-size: 13px; color: var(--text); line-height: 1.6; }
/* —— 期权链（optionChain 块）—— 第八章：3 序列 × 5 档 × CALL/PUT —— */
.ch-panel .ch-doc-f .nt {
  grid-column: 2;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}
.ch-panel .ch-opt { margin: 8px 0 12px; }
.ch-panel .ch-opt-head {
  font-size: 12.5px; color: var(--muted); padding: 0 2px 8px; line-height: 1.6;
}
.ch-panel .ch-opt-empty { font-size: 13px; color: var(--muted); padding: 12px 2px; }
.ch-panel .ch-opt-s {
  border: 1px solid var(--border); border-radius: 3px; background: #FDFAF1;
  margin-bottom: 10px; overflow: hidden;
}
.ch-panel .ch-opt-sh {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 8px 12px; background: var(--panel-2); border-bottom: 1px solid var(--hair);
}
.ch-panel .ch-opt-sh .nm { font-size: 13px; font-weight: 700; color: var(--text); }
.ch-panel .ch-opt-sh .d { font-size: 12px; color: var(--muted); }
.ch-panel .ch-opt-g {
  display: grid; grid-template-columns: 74px 1fr 1fr; gap: 1px;
  background: var(--hair);
}
.ch-panel .ch-opt-th {
  background: #F6F0E3; font-size: 11.5px; color: var(--muted);
  padding: 5px 8px; text-align: center;
}
.ch-panel .ch-opt-th.k { text-align: left; }
.ch-panel .ch-opt-k {
  background: #F9F4E9; font-size: 12.5px; color: var(--text-2);
  padding: 8px; display: flex; align-items: center;
}
.ch-panel .ch-opt-c {
  background: #FFFCF4; padding: 7px 9px; cursor: pointer; pointer-events: auto;
  display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline;
}
.ch-panel .ch-opt-c:hover { background: #F7F0E1; }
.ch-panel .ch-opt-c.read { background: #EEF3F3; box-shadow: inset 0 0 0 1px var(--ok-line); }
.ch-panel .ch-opt-c .v { font-size: 13px; color: var(--text); font-weight: 600; }
.ch-panel .ch-opt-c .t { font-size: 11.5px; color: var(--muted); }
.ch-panel .ch-opt-c .m { font-size: 11px; padding: 0 4px; border-radius: 2px; }
.ch-panel .ch-opt-c .m.itm { background: rgba(194, 64, 47, 0.14); color: var(--up); }
.ch-panel .ch-opt-c .m.atm { background: rgba(216, 154, 44, 0.18); color: #8A5A12; }
.ch-panel .ch-opt-c .m.otm { background: rgba(58, 107, 138, 0.12); color: var(--accent); }
.ch-panel .ch-opt-c .lv { font-size: 11.5px; color: var(--gold); }

/* —— 概念徽章（手写 SVG，DOM 引用）——
   尺寸三档：xs 索引行 / sm 概念卡头 / md 词典详情。
   徽章是装饰层：加载失败或该概念没有徽章时不占位，故这里不设最小尺寸。 */
.ch-badge {
  display: inline-block;
  flex: none;
  vertical-align: middle;
  image-rendering: auto;
}
.ch-badge.xs { width: 16px; height: 16px; margin-right: 6px; }
.ch-badge.sm { width: 24px; height: 24px; margin-right: 8px; }
.ch-badge.md { width: 40px; height: 40px; margin-right: 10px; }

/* 词典详情：徽章与标题并排（仅在该概念有徽章时才包这一层） */
.ch-detail-head,
.detail-head {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}
.detail-head h3 { margin: 0; }
`

export default CHAPTER_THEME_CSS
