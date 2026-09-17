/**
 * 券商 App 主题 —— 深色、专业、单屏 1440×810。
 *
 * 由 BrokerShell 经 ShellRoot 注入为 <style>（见 ShellRoot.js）。
 * 全部游戏内文字走 DOM/CSS（`dom-css-digit-hud` 契约），因此配色与排版都在这里。
 *
 * 硬规则：涨 = 红、跌 = 绿（中国习惯）。方向色**只**由 --up / --down 两个变量驱动，
 * 任何 K 线、数字、徽章都不得反用 —— 改色值只改这两个变量。
 *
 * 红/绿被**专属保留给价格方向**。委托结果（成交 / 挂单 / 拒单）另用一套中性强调色，
 * 否则同一屏上「绿色」会同时表示「价格跌了」和「委托成交了」，语义撞车。
 */

export const THEME_CSS = `
#broker-shell {
  /* —— 价格方向色（唯一来源）—— */
  --up: #C2402F;
  --down: #2E7D5B;
  /* 方向色的半透明替身，供方向标签底色使用；由上面两个变量派生，不另写色值 */
  --up-soft: color-mix(in srgb, var(--up) 16%, transparent);
  --down-soft: color-mix(in srgb, var(--down) 16%, transparent);

  /* —— 委托结果色：与方向色解耦 —— 成交 = 蓝青（既非涨红也非跌绿），拒单 = 琥珀 —— */
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

  position: absolute;
  left: 0;
  top: 0;
  width: 1440px;
  height: 810px;
  box-sizing: border-box;
  padding: 10px;
  display: grid;
  grid-template-rows: 62px minmax(0, 1fr) 206px;
  gap: 8px;
  background: radial-gradient(1180px 560px at 50% -12%, #DFD6C8 0%, var(--bg) 64%);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  font-size: 13px;
  line-height: 1.5;
  pointer-events: auto;
}

#broker-shell * { box-sizing: border-box; }
/* UiLayer 根节点设了 pointer-events:none / user-select:none；本层整体接管指针与输入框选区 */
#broker-shell input { user-select: text; }

#broker-shell .panel {
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-radius: 10px;
  overflow: hidden;
}

#broker-shell .dir-up { color: var(--up); }
#broker-shell .dir-down { color: var(--down); }
#broker-shell .dir-flat { color: var(--muted); }
#broker-shell .num { font-variant-numeric: tabular-nums; }

/* ---------- 顶栏 ---------- */
#broker-shell .topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 14px;
  background: linear-gradient(180deg, #DED6C7, #E1DACC);
  border: 1px solid var(--hair);
  border-radius: 10px;
}
#broker-shell .topbar .brand { font-size: 16px; font-weight: 600; letter-spacing: 0.5px; }
#broker-shell .topbar .badge {
  font-size: 11px;
  color: var(--dim);
  border: 1px solid var(--hair);
  border-radius: 4px;
  padding: 0 6px;
  line-height: 17px;
}
#broker-shell .topbar .badge.halt { color: var(--gold); border-color: #4A3A18; }
#broker-shell .topbar .meta { color: var(--muted); font-size: 12px; }
#broker-shell .topbar .meta b { color: var(--text); font-weight: 600; }
#broker-shell .topbar .spacer { margin-left: auto; }
#broker-shell .topbar .stat { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; min-width: 92px; }
#broker-shell .topbar .stat .k { font-size: 10.5px; color: var(--dim); }
#broker-shell .topbar .stat .v { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
#broker-shell .topbar .stat .v.sm { font-size: 13px; font-weight: 500; }
#broker-shell .topbar .divider { width: 1px; height: 30px; background: var(--hair); }

#broker-shell button { font: inherit; pointer-events: auto; cursor: pointer; border: none; }
#broker-shell button:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
#broker-shell .cta {
  background: linear-gradient(180deg, #4A7C99, #3A6B8A);
  color: #fff;
  font-weight: 600;
  border-radius: 7px;
  padding: 8px 14px;
  white-space: nowrap;
}
#broker-shell .cta:hover { filter: brightness(1.1); }
#broker-shell .cta.closed {
  background: linear-gradient(180deg, #C3B8A4, #CEC4B5);
  color: var(--text-2);
}
#broker-shell .ghost {
  background: #DBD2C2;
  color: var(--muted);
  border: 1px solid var(--hair);
  border-radius: 7px;
  padding: 7px 11px;
  white-space: nowrap;
}
#broker-shell .ghost:hover { color: var(--text-2); border-color: #C8BAA2; }
#broker-shell .ghost.arm { background: #D9CFBE; color: #D9564A; border-color: #C7B9A0; }

/* ---------- 中部三列 ---------- */
#broker-shell .main {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr) 330px;
  gap: 8px;
  min-height: 0;
}

/* 自选行情 */
#broker-shell .watch { display: flex; flex-direction: column; min-height: 0; }
#broker-shell .watch-head {
  padding: 9px 12px 7px;
  font-size: 11px;
  color: var(--dim);
  border-bottom: 1px solid var(--hair-2);
  display: flex;
  justify-content: space-between;
}
#broker-shell .watch-list { flex: 1; min-height: 0; overflow-y: auto; padding: 2px 0; }
#broker-shell .qrow {
  padding: 5px 12px;
  border-left: 2px solid transparent;
  cursor: pointer;
  pointer-events: auto;
}
#broker-shell .qrow:hover { background: #DDD4C4; }
#broker-shell .qrow.sel { background: #DBD2C2; border-left-color: var(--accent); }
#broker-shell .qrow .l1 { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
#broker-shell .qrow .l2 {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--dim);
  font-variant-numeric: tabular-nums;
}
#broker-shell .qrow .nm { color: var(--text-2); font-size: 12.5px; }
#broker-shell .qrow.sel .nm { color: var(--text); font-weight: 600; }
#broker-shell .qrow .pct { font-size: 12px; font-variant-numeric: tabular-nums; }

/* 行情主区 */
#broker-shell .mid { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; min-height: 0; }
#broker-shell .mid-head { display: flex; align-items: baseline; gap: 9px; flex-wrap: wrap; }
#broker-shell .mid-name { font-size: 15px; font-weight: 600; }
#broker-shell .mid-sub { font-size: 11px; color: var(--dim); }
#broker-shell .mid-sub .sep { color: #C2B7A3; margin: 0 5px; }
#broker-shell .mid-price { display: flex; align-items: baseline; gap: 11px; flex-wrap: wrap; }
#broker-shell .mid-price .px { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
#broker-shell .mid-price .chg { font-size: 13.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
#broker-shell .mid-price .range { font-size: 11px; color: var(--dim); font-variant-numeric: tabular-nums; }

/* K 线（纯 DOM/CSS 蜡烛，无 canvas、无 Phaser） */
#broker-shell .chart {
  position: relative;
  flex: 1;
  min-height: 132px;
  border: 1px solid var(--hair-2);
  border-radius: 8px;
  background: linear-gradient(180deg, #E5DFD3, #E7E1D6);
  overflow: hidden;
}
#broker-shell .chart-gutter { position: absolute; right: 0; top: 0; bottom: 0; width: 52px; border-left: 1px solid #DDD4C5; }
#broker-shell .chart-plot { position: absolute; left: 0; right: 52px; top: 0; bottom: 0; }
#broker-shell .chart-gridline { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed #DAD0C0; }
#broker-shell .chart-glabel {
  position: absolute;
  right: 6px;
  font-size: 10px;
  color: #AFA087;
  transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
}
#broker-shell .chart-lastline { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed currentColor; opacity: 0.6; }
#broker-shell .chart-lastlabel {
  position: absolute;
  right: 4px;
  font-size: 10.5px;
  font-weight: 600;
  padding: 0 3px;
  border-radius: 3px;
  transform: translateY(-50%);
  font-variant-numeric: tabular-nums;
}
#broker-shell .chart-lastlabel.dir-up { background: var(--up-soft); }
#broker-shell .chart-lastlabel.dir-down { background: var(--down-soft); }
#broker-shell .k-candle { position: absolute; top: 0; bottom: 0; transform: translateX(-50%); }
#broker-shell .k-wick { position: absolute; left: 50%; width: 1px; margin-left: -0.5px; }
#broker-shell .k-body { position: absolute; left: 20%; width: 60%; border-radius: 1px; min-height: 2px; }
#broker-shell .k-candle.dir-up .k-wick,
#broker-shell .k-candle.dir-up .k-body { background: var(--up); }
#broker-shell .k-candle.dir-down .k-wick,
#broker-shell .k-candle.dir-down .k-body { background: var(--down); }
#broker-shell .k-candle.dir-flat .k-wick,
#broker-shell .k-candle.dir-flat .k-body { background: var(--muted); }
#broker-shell .chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dim);
  font-size: 12px;
}
#broker-shell .chart-caption {
  position: absolute;
  left: 8px;
  top: 5px;
  font-size: 10px;
  color: #B8AB94;
  letter-spacing: 0.4px;
}

/* 新闻卡 */
#broker-shell .news {
  background: var(--panel-2);
  border: 1px solid var(--hair);
  border-left: 2px solid var(--gold);
  border-radius: 8px;
  padding: 9px 11px;
  flex: 0 0 auto;
}
#broker-shell .news-head { display: flex; gap: 8px; align-items: center; }
#broker-shell .news-tag {
  color: var(--gold);
  font-size: 11px;
  border: 1px solid #4A3A18;
  border-radius: 4px;
  padding: 0 5px;
  line-height: 16px;
  white-space: nowrap;
  flex: 0 0 auto;
}
#broker-shell .news-title { font-size: 13px; color: var(--text); }
#broker-shell .news-why { font-size: 11px; color: var(--muted); margin-top: 5px; line-height: 1.6; }
#broker-shell .news-why b { color: var(--accent); font-weight: 500; }
#broker-shell .news-why .up { color: var(--up); }
#broker-shell .news-why .down { color: var(--down); }
#broker-shell .news-mentor { font-size: 11.5px; color: var(--text-2); margin-top: 5px; line-height: 1.65; }
#broker-shell .news-mentor .who { color: var(--gold); }

/* 下单面板 */
#broker-shell .ticket { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; min-height: 0; }
#broker-shell .seg { display: flex; gap: 6px; }
#broker-shell .seg button {
  flex: 1;
  padding: 7px 0;
  border-radius: 6px;
  background: #DBD2C2;
  color: var(--muted);
  border: 1px solid var(--hair);
  font-weight: 500;
}
#broker-shell .seg button:hover { color: var(--text-2); }
#broker-shell .seg button.on { color: #fff; font-weight: 600; border-color: transparent; }
#broker-shell .seg button.on.buy { background: var(--up); }
#broker-shell .seg button.on.sell { background: var(--down); }
#broker-shell .seg.small button { padding: 4px 0; font-size: 11.5px; }
#broker-shell .seg.small button.on { background: #D1C5B1; color: var(--text); }
#broker-shell .field {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--sunken);
  border: 1px solid var(--hair);
  border-radius: 6px;
  padding: 5px 9px;
}
#broker-shell .field .lab { font-size: 11px; color: var(--dim); flex: 0 0 40px; }
#broker-shell .field input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  pointer-events: auto;
}
#broker-shell .field input:disabled { color: var(--muted); }
#broker-shell .field .unit { font-size: 11px; color: var(--dim); flex: 0 0 auto; }
#broker-shell .ticket .hint { font-size: 11px; color: var(--dim); font-variant-numeric: tabular-nums; display: flex; justify-content: space-between; gap: 8px; }
#broker-shell .ticket .hr { height: 1px; background: var(--hair-2); }
#broker-shell .kv { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; padding: 1.5px 0; }
#broker-shell .kv .v { color: var(--text-2); }
#broker-shell .kv.total { font-size: 13px; font-weight: 600; padding-top: 3px; }
#broker-shell .kv.total .v { color: var(--text); }
#broker-shell .submit {
  margin-top: auto;
  width: 100%;
  padding: 9px 0;
  border-radius: 7px;
  text-align: center;
  font-weight: 600;
  color: #fff;
  background: var(--up);
}
#broker-shell .submit.sell { background: var(--down); }
#broker-shell .submit:hover:not(:disabled) { filter: brightness(1.08); }
#broker-shell .submit:disabled { background: #DAD0C0; color: #AFA087; cursor: not-allowed; }
#broker-shell .ticket .result { font-size: 11.5px; line-height: 1.55; border-radius: 6px; padding: 6px 8px; display: none; }
#broker-shell .ticket .result.show { display: block; }
#broker-shell .ticket .result.ok { background: var(--ok-soft); color: var(--ok); border: 1px solid var(--ok-line); }
#broker-shell .ticket .result.warn { background: rgba(224, 163, 62, 0.1); color: #B8862C; border: 1px solid #4A3A18; }
#broker-shell .ticket .result.bad { background: var(--reject-soft); color: var(--reject); border: 1px solid var(--reject-line); }

/* ---------- 底部：持仓 + 导师 ---------- */
#broker-shell .bottom { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 8px; min-height: 0; }
#broker-shell .positions { display: flex; flex-direction: column; min-height: 0; padding: 9px 13px 11px; }
#broker-shell .pos-head { display: flex; align-items: baseline; gap: 10px; padding-bottom: 6px; font-size: 11px; color: var(--dim); }
#broker-shell .pos-head .sum { font-variant-numeric: tabular-nums; }
#broker-shell .pos-head .title { color: var(--muted); }
#broker-shell .ptable { display: grid; grid-template-columns: 1.6fr 0.7fr 1fr 1fr 1.1fr 0.9fr; gap: 8px; }
#broker-shell .ptable.hd { color: var(--dim); font-size: 11px; padding-bottom: 4px; border-bottom: 1px solid var(--hair-2); }
#broker-shell .ptable.rw { padding: 5px 0; font-size: 12px; font-variant-numeric: tabular-nums; border-bottom: 1px solid #DFD7C9; }
#broker-shell .ptable.rw .nm { color: var(--text-2); }
#broker-shell .ptable.rw .nm em { font-style: normal; color: var(--dim); font-size: 11px; }
#broker-shell .pos-body { flex: 1; min-height: 0; overflow-y: auto; }
#broker-shell .pos-empty { color: var(--dim); font-size: 12px; padding: 14px 0; }
#broker-shell .lock { color: var(--gold); }

#broker-shell .mentor { display: flex; gap: 12px; padding: 11px 13px; min-height: 0; }
#broker-shell .mentor .portrait {
  width: 100px;
  height: 128px;
  flex: 0 0 100px;
  object-fit: cover;
  object-position: 50% 18%;
  border-radius: 9px;
  border: 1px solid var(--hair);
  background: var(--sunken);
}
#broker-shell .mentor .body { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
#broker-shell .mentor .who { color: var(--gold); font-size: 11.5px; }
#broker-shell .mentor .say { font-size: 12.5px; color: var(--text-2); line-height: 1.68; }
#broker-shell .mentor .foot { margin-top: auto; font-size: 10.5px; color: var(--dim); }

#broker-shell ::-webkit-scrollbar { width: 6px; height: 6px; }
#broker-shell ::-webkit-scrollbar-thumb { background: #D0C4B0; border-radius: 3px; }
#broker-shell ::-webkit-scrollbar-track { background: transparent; }
`
