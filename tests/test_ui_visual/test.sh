#!/usr/bin/env bash
# test_ui_visual —— 五区域布局 / K 线外观 / 涨跌配色 / 导师长文案 / 拒单与休市视觉态
#
# 每个视觉态：跑一个 step 脚本改状态（Runtime 钩子）→ 跑 metrics.js 取 DOM 度量
# → 截图。断言在 assert_ui_visual.py（可度量部分自动化，外观审美仍留给 reviewer 看截图）。
#
# 契约（.vibegame/spec/test/index.md）：PORT 来自环境；产物只写 evidence/；
# 断言失败退出非零且**不**关闭运行时。
set -u

command -v dirname >/dev/null 2>&1 || export PATH="/usr/bin:/bin:$HOME/.local/bin:$PATH"

: "${PORT:?PORT is required}"
DIR="$(cd "$(dirname "$0")" && pwd)"
EVIDENCE="$DIR/evidence"
ROOT="$(cd "$DIR/../.." && pwd)"
mkdir -p "$EVIDENCE"
cd "$ROOT"

PLAY() { vibegame play --port "$PORT" "$@"; }
wpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

PLAY activate
PLAY console --clear
PLAY network --clear

# run_step <编号> <step 脚本名> <截图文件名>
run_step() {
  PLAY eval < "$DIR/steps/$2" > "$EVIDENCE/state_$1.json"
  PLAY eval < "$DIR/metrics.js" > "$EVIDENCE/dom_$1.json"
  PLAY screenshot -o "$(wpath "$EVIDENCE/$3")" > "$EVIDENCE/shot_$1.txt"
}

run_step 01 01_default.js      01-layout-default.png
run_step 02 02_up_event.js     02-klines-gain-RED.png
run_step 03 03_down_event.js   03-klines-loss-GREEN.png
run_step 04 04_after_buy.js    04-after-buy.png
run_step 05 05_after_advance.js 05-after-advance-day.png
run_step 06 06_rejected.js     06-rejected-order.png
run_step 07 07_weekend.js      07-weekend-closed.png
run_step 08 08_mentor_long.js  08-mentor-long-line-B01.png

PLAY console -l error > "$EVIDENCE/console_errors.json"

python3 "$(wpath "$DIR/assert_ui_visual.py")" "$(wpath "$EVIDENCE")"
