#!/usr/bin/env bash
# test_chapter2_rejects —— 第二章四次拒单 / giveUp 出口 / 2.3 无持仓 / 2.5 选择题 / 出场条件 / §3.8 定向事件
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
PLAY screenshot -o "$(wpath "$EVIDENCE/ch2_after_walk.png")" > "$EVIDENCE/shot_tail.txt"

PLAY console -l error > "$EVIDENCE/console_errors.json"

python3 "$(wpath "$DIR/assert_chapter2_rejects.py")" "$(wpath "$EVIDENCE")"
