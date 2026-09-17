#!/usr/bin/env python3
"""test_mode_switch 断言（读 evidence/drive_result.json）。

plan.md Verification Plan 里 test_mode_switch 的 3 行：
  §3.2 三模式 setMode 三向切换；freeDay 不推进任何章、可连续推进多日、常驻卡显示下一章；
       sandbox 无目标卡 / 无引导
  §3.2 自由窗口盈亏不计入评级（窗口内费用 / 成交金额不变、excludedPnl ≠ 0）
  §3.2 回到主线的承接语（mentor.line 非空、speaker 非 null）

契约：断言失败 → exit 1（运行时保持存活）。
"""
import json
import sys
from pathlib import Path

EVIDENCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "evidence"
R = json.loads((EVIDENCE / "drive_result.json").read_text(encoding="utf-8"))["result"]

fails = []
checks = 0


def ok(name, cond, detail=""):
    global checks
    checks += 1
    if not cond:
        fails.append(f"{name}: {detail}")
    print(("  PASS " if cond else "  FAIL ") + name + ("" if cond else "  <- " + str(detail)))


# ── §3.2 三模式切换 ─────────────────────────────────────────────────────────
print("[§3.2 三模式 setMode 三向切换]")
order = {s["tag"]: s for s in R["triSwitch"]["order"]}
ok("chapter 模式：模式/节拍正确", order["chapter"]["mode"] == "chapter", order["chapter"]["mode"])
ok("chapter 模式：章目标卡可见", order["chapter"]["goalCardVisible"] is True, order["chapter"]["goalCardVisible"])
ok("chapter 模式：自由窗口卡不可见", order["chapter"]["freeWinVisible"] is False, order["chapter"]["freeWinVisible"])
ok("→ freeDay：模式切换成功", order["freeDay"]["mode"] == "freeDay", order["freeDay"]["mode"])
ok("→ freeDay：目标卡隐藏", order["freeDay"]["goalCardVisible"] is False, order["freeDay"]["goalCardVisible"])
ok("→ freeDay：自由窗口卡可见", order["freeDay"]["freeWinVisible"] is True, order["freeDay"]["freeWinVisible"])
ok("→ freeDay：卡上给出下一章名「第三章」",
   "第 3 章" in (order["freeDay"]["freeWinText"] or ""), order["freeDay"]["freeWinText"])
ok("→ freeDay：卡上给出预告句",
   "先别选公司。先选方法。" in (order["freeDay"]["freeWinText"] or ""), order["freeDay"]["freeWinText"])
ok("→ sandbox：模式切换成功", order["sandbox"]["mode"] == "sandbox", order["sandbox"]["mode"])
ok("→ sandbox：目标卡隐藏", order["sandbox"]["goalCardVisible"] is False, order["sandbox"]["goalCardVisible"])
ok("→ sandbox：自由窗口卡也隐藏", order["sandbox"]["freeWinVisible"] is False, order["sandbox"]["freeWinVisible"])
ok("→ 回 chapter：模式切换成功", order["backToChapter"]["mode"] == "chapter", order["backToChapter"]["mode"])
ok("→ 回 chapter：目标卡恢复可见", order["backToChapter"]["goalCardVisible"] is True,
   order["backToChapter"]["goalCardVisible"])
ok("三向切换全程 beatId 不变（切换不改章内进度）",
   len({s["beatId"] for s in R["triSwitch"]["order"]}) == 1,
   [s["beatId"] for s in R["triSwitch"]["order"]])

# ── §3.2 freeDay：不推进任何章、可连续推进多日 ──────────────────────────────
print("[§3.2 freeDay 不推进任何章、可连续推进多日]")
fd = R["freeDay"]
ok("起点在 2.1", fd["start"]["beatId"] == "2.1", fd["start"]["beatId"])
ok("连续推进 5 个交易日都成功", len(fd["days"]) == 5, len(fd["days"]))
ok("日期逐个前进（dayIndex 连续 +1）",
   [d["dayIndex"] for d in fd["days"]] == list(range(fd["start"]["dayIndex"] + 1, fd["start"]["dayIndex"] + 6)),
   [d["dayIndex"] for d in fd["days"]])
dates = [d["date"] for d in fd["days"]]
ok("日期字符串逐个前进", dates == sorted(dates) and len(set(dates)) == 5, dates)
ok("freeDay 期间 beatId 恒为 2.1（不推进任何章）",
   all(d["beatId"] == "2.1" for d in fd["days"]) and fd["after"]["beatId"] == "2.1",
   [d["beatId"] for d in fd["days"]])
ok("freeDay 期间 completedBeats 不变", fd["after"]["completedBeats"] == fd["start"]["completedBeats"],
   fd["after"]["completedBeats"])
ok("freeDay 期间目标卡保持隐藏、自由窗口卡保持可见",
   fd["dom"]["goalCardVisible"] is False and fd["dom"]["freeWinVisible"] is True, fd["dom"])

# ── §3.2 sandbox：无目标卡 / 无引导 ─────────────────────────────────────────
print("[§3.2 sandbox 无目标卡 / 无引导]")
sb = R["sandbox"]
ok("sandbox：模式正确", sb["mode"] == "sandbox", sb["mode"])
ok("sandbox：目标卡 DOM 不可见", sb["dom"]["goalCardVisible"] is False, sb["dom"]["goalCardVisible"])
ok("sandbox：自由窗口卡也不可见", sb["dom"]["freeWinVisible"] is False, sb["dom"]["freeWinVisible"])
# Stage 2 起章节层有两个**工具入口**（词典与公式 / 导师对话历史）—— 它们不是引导文案，
# 因此断言改为「只剩这两个工具入口」，仍然禁止任何引导 / 纠正措辞出现在章节层。
_sandbox_labels = [x.strip() for x in (sb["dom"]["chapterRootText"] or "").strip().split("\n") if x.strip()]
ok("sandbox：章节层只剩工具入口（词典 / 对话历史），无任何引导文案",
   set(_sandbox_labels) <= {"词典与公式", "导师对话历史"}, repr(sb["dom"]["chapterRootText"]))
ok("sandbox：无导师台词", sb["mentorLine"] is None, sb["mentorLine"])
ok("sandbox：无待答选择题", sb["hasChoice"] is False, sb["hasChoice"])
ok("sandbox：连续推进几日 beatId 不变", sb["beatIdUnchanged"] is True, sb["beats"])

# ── §3.2 自由窗口盈亏不计入评级窗口 ────────────────────────────────────────
print("[§3.2 自由窗口盈亏不计入评级（窗口内费用/成交金额不变、excludedPnl ≠ 0）]")
ex = R["excludedPnl"]
ok("自由窗口里发生了真实成交（买入成交）", ex["orders"][0]["status"] == "filled", ex["orders"])
ok("自由窗口中 NAV 确实变了（说明账在动）", abs(ex["navDelta"]) > 0.005, ex["navDelta"])
ok("自由窗口的成交不计入评级窗口的费用", ex["backInChapter"]["fees"] == 0, ex["backInChapter"])
ok("自由窗口的成交不计入评级窗口的成交金额", ex["backInChapter"]["notional"] == 0, ex["backInChapter"])
ok("回到 chapter 后 excludedPnl ≠ 0", abs(ex["backInChapter"]["excludedPnl"]) > 0.005, ex["backInChapter"])
ok("excludedPnl == 自由窗口内的 NAV 变化量",
   abs(ex["backInChapter"]["excludedPnl"] - ex["navDelta"]) < 0.02,
   (ex["backInChapter"]["excludedPnl"], ex["navDelta"]))
ok("评级结果不被自由窗口盈亏污染（rar == 0 而非负）",
   ex["gradedAfter"]["rar"] == 0, ex["gradedAfter"])
ok("结算的三项输入里也只带 excludedPnl、费用/金额仍为 0",
   ex["ratingInputs"]["feesInWindow"] == 0 and ex["ratingInputs"]["notionalInWindow"] == 0 and
   abs(ex["ratingInputs"]["excludedPnl"]) > 0.005, ex["ratingInputs"])

# ── §3.2 回到主线的承接语 ───────────────────────────────────────────────────
print("[§3.2 回到主线的承接语]")
rl = R["resumeLine"]
ok("freeDay 中导师不主动说话（line 为 null）", rl["inFree"]["line"] is None, rl["inFree"])
ok("setMode('chapter') 后 mentor.line 非空", bool(rl["back"]["line"]), rl["back"])
ok("承接语 speaker 非 null", rl["back"]["speaker"] is not None, rl["back"])
ok("承接语落到对话层 DOM（.ch-dialogue 文本含该句）",
   rl["back"]["line"] in (rl["domText"] or ""), rl["domText"])
ok("sandbox → chapter 同样给承接语", bool(rl["fromSandbox"]["line"]), rl["fromSandbox"])

# ── §4 第二章确认后进 freeDay + 第三章预告 ─────────────────────────────────
print("[§4 第二章确认后进入 freeDay + 第三章预告卡]")
ce = R["chapterEndFree"]
ok("章末确认成功", ce["confirm"].get("ok") is True, ce["confirm"])
ok("确认后 mode == 'freeDay'", ce["mode"] == "freeDay", ce["mode"])
ok("确认后 chapterId 仍为 2（第三章未实现，不进入）", ce["chapterId"] == 2, ce["chapterId"])
ok("nextChapter 给出第三章名与预告",
   ce["nextChapter"]["id"] == 3 and ce["nextChapter"]["name"] == "一篮子里的一颗蛋" and
   bool(ce["nextChapter"]["preview"]), ce["nextChapter"])
ok("自由窗口常驻卡可见并显示第三章",
   ce["dom"]["freeWinVisible"] is True and "第 3 章" in (ce["dom"]["freeWinText"] or ""), ce["dom"])

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
