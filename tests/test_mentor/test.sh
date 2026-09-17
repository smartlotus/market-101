#!/usr/bin/env bash
# test_mentor —— 导师周老师：五个开口时机的穷举 / 每概念主动讲解上限 2 次 / 静音下计数照常累加 /
#                freeDay·sandbox 不主动弹窗 / 无隐藏层（存档白名单） / R10 章内只有一个说话面
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

# 清档 + 刷新 → 回到产品开局（未开户、cash=0、节拍 1.0）
PLAY eval < "$DIR/steps/reset.js" > "$EVIDENCE/00_reset.json"
PLAY refresh > "$EVIDENCE/00_refresh.json"

PLAY eval < "$DIR/drive.js" > "$EVIDENCE/drive_result.json"

# 空转 30 帧：没有任何玩家操作时也不得凭空开口（drive.js 收尾停在「章内 + 无台词」的拍上）。
PLAY continue -f 30 > "$EVIDENCE/continue.json"
PLAY eval 'const c = sceneTree.nodes.get("broker").runtimeState().chapter; return { mode: c.mode, beatId: c.beatId, line: c.mentor.line, counts: c.mentor.explainCounts, started: true };' \
  > "$EVIDENCE/idle_line.json"

PLAY console -l error > "$EVIDENCE/console_errors.json"

python3 "$(wpath "$DIR/assert_mentor.py")" "$(wpath "$EVIDENCE")"
