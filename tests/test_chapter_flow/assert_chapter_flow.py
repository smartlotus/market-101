#!/usr/bin/env python3
"""test_chapter_flow 断言（读 evidence/drive_result.json）。

契约：断言失败 → exit 1（运行时保持存活，便于事后 reattach）。
"""
import json
import sys
from pathlib import Path

EVIDENCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "evidence"
raw = json.loads((EVIDENCE / "drive_result.json").read_text(encoding="utf-8"))
R = raw["result"]

fails = []
checks = 0


def ok(name, cond, detail=""):
    global checks
    checks += 1
    if not cond:
        fails.append(f"{name}: {detail}")
    print(("  PASS " if cond else "  FAIL ") + name + ("" if cond else "  <- " + str(detail)))


# ── §1 开局落在节拍 1.0 ──────────────────────────────────────────────────────
i = R["initial"]
print("[§1 开局落在节拍 1.0]")
ok("chapterId == 1", i["chapterId"] == 1, i["chapterId"])
ok("beatId == '1.0'", i["beatId"] == "1.0", i["beatId"])
ok("beatIndex == 0", i["beatIndex"] == 0, i["beatIndex"])
ok("mode == 'chapter'", i["mode"] == "chapter", i["mode"])
ok("shellMode == 'hidden'", i["shellMode"] == "hidden", i["shellMode"])
ok("accountOpened == False", i["accountOpened"] is False, i["accountOpened"])
ok("cash == 0", i["cash"] == 0, i["cash"])
ok("NAV == 0", i["NAV"] == 0, i["NAV"])
ok("dayIndex == 1（日期未推进）", i["dayIndex"] == 1, i["dayIndex"])
ok("inGameDate == 2026-01-05（未推进）", i["inGameDate"] == "2026-01-05", i["inGameDate"])
ok("defaultInstrumentId == '601398'", i["selectedInstrumentId"] == "601398", i["selectedInstrumentId"])
ok("panelId is null", i["panelId"] is None, i["panelId"])
ok("券商壳 display:none（开户前不可见）", i["shellDisplay"] == "none", i["shellDisplay"])
ok("券商壳 data-shell-mode == hidden", i["shellDataMode"] == "hidden", i["shellDataMode"])
ok("券商壳无可见文本", i["shellTextVisible"] == "", repr(i["shellTextVisible"]))
ok("无打开的面板", i["openPanels"] == [], i["openPanels"])
ok("首拍 require = interact:1.0.start",
   [(r["kind"], r["id"]) for r in i["requirements"]] == [("interact", "1.0.start")], i["requirements"])

# ── §3.1 节拍只能顺序推进 ────────────────────────────────────────────────────
print("[§3.1 顺序推进 + 无跳拍路径]")
sa = R["skipAttempts"]
ok("跳过尝试前在 1.0", sa["before"] == "1.0", sa["before"])
for a in sa["attempts"]:
    ok(f"钩子 {a['name']} 不能推进", a["beatId"] == "1.0" and a["beatIndex"] == 0,
       f"beatId={a['beatId']} beatIndex={a['beatIndex']} err={a['err']}")

walk = R["walk"]
ok("走完整章记录 >= 12 步", len(walk) >= 12, len(walk))
# 这些步只完成了本拍的一部分 require（或面板未关）→ beatIndex 必须一动不动
NEGATIVE_TAGS = {
    "1.1 openDeposit",             # 只完成了 interact，read 未满
    "1.1 read 1 then close",       # 只读了 2 条里的 1 条
    "1.5.5 read 1 then close",     # 三张概念卡只读了 1 张
    "1.8 review open (not closed)",  # 复盘面板未关
}
prev_idx = 0
for w in walk:
    tag, idx = w["tag"], w["beatIndex"]
    delta = idx - prev_idx
    if tag in NEGATIVE_TAGS:
        ok(f"[负例] {tag} 不推进（require 未全满足）", delta == 0, f"beatIndex {prev_idx} -> {idx}")
    else:
        ok(f"{tag} 后 beatIndex 恰好 +1", delta == 1, f"beatIndex {prev_idx} -> {idx}")
    prev_idx = idx
ok("终局 beatId == '1.9'", walk[-1]["beatId"] == "1.9", walk[-1]["beatId"])

# ── §3.4 理解确认题（T+1）────────────────────────────────────────────────────
print("[§3.4 章末理解确认题：选错只重讲 / 选对推进]")
ch = R["choice"]
ok("1.9 有 pendingChoice", ch["hasPendingChoice"], ch["hasPendingChoice"])
ok("选择题 id 题干为 T+1 题", ch["question"].startswith("你昨天买的那 100 股"), ch["question"])
ok("两个选项", len(ch["optionKeys"]) == 2, ch["optionKeys"])
ok("confirm 面板已打开", ch["panelOpen"], ch["panelOpen"])
aw = ch["afterWrong"]
ok("错答被记录（answeredKey）", aw["answeredKey"] == "limit", aw["answeredKey"])
ok("错答不满足 choice 条件（只重讲）",
   aw["requirements"] == ["choice:1.9.confirm=false"], aw["requirements"])
ok("错答后 beatId 仍是 '1.9'", aw["beatId"] == "1.9", aw["beatId"])
ok("错答反馈无「答错」字样", "答错" not in (aw["feedbackForWrong"] or ""), aw["feedbackForWrong"])
ok("错答时章末确认被拒绝（未答对）", aw["confirmResult"].get("ok") is False, aw["confirmResult"])
ok("错答不给任何否定措辞（屏幕无「答错」）", "答错" not in aw["dialogueText"], "found in dialogue")
ok("同题可无限重试（再答一次仍被记录）",
   ch["afterRetryWrong"]["answeredKey"] == "limit" and ch["afterRetryWrong"]["beatId"] == "1.9",
   ch["afterRetryWrong"])
ac = ch["afterCorrect"]
ok("选对后 choice 条件满足",
   ac["requirements"] == ["choice:1.9.confirm=true"], ac["requirements"])
ok("选对后章末确认成功", ac["confirmResult"].get("ok") is True, ac["confirmResult"])
ok("确认后 chapterId == 2", ac["chapterId"] == 2, ac["chapterId"])
ok("确认后 beatId == '2.1'", ac["beatId"] == "2.1", ac["beatId"])

# ── beatCount / 加演段文案 ───────────────────────────────────────────────────
print("[Edge Case beatCount 显示：加演段不增 beatCount、remainingBeats 不变]")
ex = R["extraSpin"]
ce = ex["atChapterEnd"]
ok("章末 beatCount == 7", ce["beatCount"] == 7, ce["beatCount"])
ok("章末 7 拍全部完成", ce["completed"] == 7, ce["completed"])
ok("章末 remainingBeats == 0", ce["remainingBeats"] == 0, ce["remainingBeats"])
ok("章末打开结算面板", "settlement" in ce["openPanels"], ce["openPanels"])
ok("章末评级 A（注入加演段）", ce["rating"]["grade"] == "A", ce["rating"])
ok("章末 extraSegment.kind == 'advanced'", ce["extraSegment"]["kind"] == "advanced", ce["extraSegment"])
ie = ex["inExtra"]
ok("段内 beatCount 不变（== 7）", ie["beatCount"] == 7, ie["beatCount"])
ok("段内 remainingBeats 不变（== 0）", ie["remainingBeats"] == 0, ie["remainingBeats"])
ok("段内 completedBeats 不变（== 7）", ie["completed"] == 7, ie["completed"])
ok("段面板已打开", "extraSegment" in ie["openPanels"], ie["openPanels"])
ok("段内文案含「加演」", "加演" in (ie["panelText"] or ""), (ie["panelText"] or "")[:120])
ok("段内有 2 个步骤", ie["extraSteps"] == 2, ie["extraSteps"])
ok("步进到底 stepIndex == 1", ex["afterSteps"]["stepIndex"] == 1, ex["afterSteps"])
ok("步进期间 remainingBeats 仍为 0", ex["afterSteps"]["remainingBeats"] == 0, ex["afterSteps"])
ok("段结束后 extraSegment 清空", ex["afterComplete"]["extraSegment"] is None, ex["afterComplete"])
ok("段结束后 remainingBeats 仍为 0", ex["afterComplete"]["remainingBeats"] == 0, ex["afterComplete"])
ok("段结束后进入理解确认面板", "confirm" in ex["afterComplete"]["openPanels"], ex["afterComplete"])

# ── §3.7 章内残留清理 ────────────────────────────────────────────────────────
print("[§3.7 章内残留清理]")
res = R["residual"]
ok("跨章前有未成交挂单", res["before"]["pendingOrderCount"] >= 1, res["before"])
ok("跨章前有 T+1 锁定 100 股", res["before"]["lockedQty"] == 100, res["before"])
ok("跨章前冻结资金 > 0", res["before"]["frozenCash"] > 0, res["before"])
ok("跨章确认成功", res["confirmResult"].get("ok") is True, res["confirmResult"])
ok("进入第二章 2.1", res["after"]["chapterId"] == 2 and res["after"]["beatId"] == "2.1", res["after"])
ok("进入瞬间 pendingOrders == []", res["after"]["pendingOrderCount"] == 0, res["after"])
ok("进入瞬间 lockedQty == 0", res["after"]["lockedQty"] == 0, res["after"])
ok("进入瞬间 frozenCash == 0", res["after"]["frozenCash"] == 0, res["after"])
ok("持仓本身保留", res["after"]["positionQty"] == res["before"]["qty"], res["after"])

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
