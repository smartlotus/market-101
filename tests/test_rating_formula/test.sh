#!/usr/bin/env bash
# test_rating_formula —— PRD §3.3 评级公式 / 门槛 / 黄档 ×0.5 / L1 相对口径 / 外来入金 / 大盘对照行
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

# steps/lib.js（章节驱动 + 注入探针外壳）与 drive.js 是同一个 eval 脚本的两段
cat "$DIR/steps/lib.js" "$DIR/drive.js" | PLAY eval > "$EVIDENCE/drive_result.json"

PLAY console -l error > "$EVIDENCE/console_errors.json"

python3 "$(wpath "$DIR/assert_rating_formula.py")" "$(wpath "$EVIDENCE")"
