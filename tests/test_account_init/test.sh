#!/usr/bin/env bash
# test_account_init —— 初始账户 / 默认选中标的 / 限价买入 ΔNAV = −fee
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

# MSYS 路径 → Windows 路径。python3 与 `vibegame play screenshot -o` 都是原生程序，
# 不认 `/c/...` 形式；非 Windows 平台原样返回。
wpath() { if command -v cygpath >/dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

PLAY activate
PLAY console --clear
PLAY network --clear

# 驱动：全部经 BrokerShell 测试钩子（reset / submitOrder），不爬 DOM
PLAY eval < "$DIR/drive.js" > "$EVIDENCE/drive.json"

# 契约约定的快照历史（harness 层快照，含 nodes.broker.runtime）
PLAY snapshot >> "$EVIDENCE/snapshot.jsonl"

python3 "$(wpath "$DIR/assert_account_init.py")" "$(wpath "$EVIDENCE/drive.json")"
