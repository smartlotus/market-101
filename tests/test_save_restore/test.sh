#!/usr/bin/env bash
# test_save_restore —— §3.1 存档恢复到「最后完成节拍之后」/ 节拍中途恢复 / 面板打开时刷新 /
# §4 章节进度重置 / B2 回归（`chapterRejectSeen` 跨刷新存活，否则 2.6 无出口）
#
# 需要在步骤之间 `play refresh`（真刷新页面），所以拆成多个 step 文件。
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

# 场景 1：savePoint 拍完成后刷新
cat "$DIR/steps/lib.js" "$DIR/steps/01_before.js" | PLAY eval > "$EVIDENCE/01_before.json"
PLAY refresh > "$EVIDENCE/01_refresh.json"
cat "$DIR/steps/lib.js" "$DIR/steps/02_after.js" | PLAY eval > "$EVIDENCE/02_after.json"

# 场景 2：节拍中途存档后刷新
cat "$DIR/steps/lib.js" "$DIR/steps/03_midbeat_before.js" | PLAY eval > "$EVIDENCE/03_midbeat_before.json"
PLAY refresh > "$EVIDENCE/03_refresh.json"
cat "$DIR/steps/lib.js" "$DIR/steps/04_midbeat_after.js" | PLAY eval > "$EVIDENCE/04_midbeat_after.json"

# 场景 3：面板打开时刷新
cat "$DIR/steps/lib.js" "$DIR/steps/05_panel_before.js" | PLAY eval > "$EVIDENCE/05_panel_before.json"
PLAY refresh > "$EVIDENCE/05_refresh.json"
cat "$DIR/steps/lib.js" "$DIR/steps/06_panel_after.js" | PLAY eval > "$EVIDENCE/06_panel_after.json"

# 场景 4（B2 回归）：chapterRejectSeen 跨刷新存活
cat "$DIR/steps/lib.js" "$DIR/steps/07_rejectseen_before.js" | PLAY eval > "$EVIDENCE/07_rejectseen_before.json"
PLAY refresh > "$EVIDENCE/07_refresh.json"
cat "$DIR/steps/lib.js" "$DIR/steps/08_rejectseen_after.js" | PLAY eval > "$EVIDENCE/08_rejectseen_after.json"

# 场景 5：章节进度重置
cat "$DIR/steps/lib.js" "$DIR/steps/09_reset.js" | PLAY eval > "$EVIDENCE/09_reset.json"

# 场景 6（反证）：全程无拒单时 2.6 不可完成
cat "$DIR/steps/lib.js" "$DIR/steps/10_control_no_reject.js" | PLAY eval > "$EVIDENCE/10_control.json"

PLAY console -l error > "$EVIDENCE/console_errors.json"

python3 "$(wpath "$DIR/assert_save_restore.py")" "$(wpath "$EVIDENCE")"
