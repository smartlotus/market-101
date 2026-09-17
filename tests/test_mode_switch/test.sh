#!/usr/bin/env bash
# test_mode_switch —— §3.2 三模式切换 / freeDay 不推进章 / sandbox 无目标卡 /
# 自由窗口盈亏不计评级 / 回到主线的承接语 / §4 第二章确认后进 freeDay
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

PLAY eval < "$DIR/steps/reset.js" > "$EVIDENCE/00_reset.json"
PLAY refresh > "$EVIDENCE/00_refresh.json"

PLAY eval < "$DIR/drive.js" > "$EVIDENCE/drive_result.json"

PLAY console -l error > "$EVIDENCE/console_errors.json"

python3 "$(wpath "$DIR/assert_mode_switch.py")" "$(wpath "$EVIDENCE")"
