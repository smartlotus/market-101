#!/usr/bin/env bash
# test_calendar —— 交易日历 / 连续休市 / 休市日持仓不重估 / 休市日当日涨跌幅为 0
#
# 契约（.vibegame/spec/test/index.md）：PORT 来自环境；产物只写 evidence/；
# 断言失败退出非零且**不**关闭运行时。
set -u

# 本机 bash 默认 PATH 缺失核心目录（`dirname` 等找不到）；仅在缺失时补上。
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

PLAY eval < "$DIR/drive.js" > "$EVIDENCE/drive.json"
PLAY snapshot >> "$EVIDENCE/snapshot.jsonl"

python3 "$(wpath "$DIR/assert_calendar.py")" "$(wpath "$EVIDENCE/drive.json")"
