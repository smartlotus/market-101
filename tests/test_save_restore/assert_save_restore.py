#!/usr/bin/env python3
"""test_save_restore 断言（读 evidence/*.json）。

覆盖 plan.md Verification Plan 里 test_save_restore 的 3 行 + §4 Reset，并含 B2 回归
（`chapterRejectSeen` 跨刷新存活 —— 该拍没有 giveUp 出口，标志丢失 = 第二章不可结章）。

契约：断言失败 → exit 1（运行时保持存活，便于事后 reattach）。
"""
import json
import sys
from pathlib import Path

EVIDENCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "evidence"

fails = []
checks = 0


def ok(name, cond, detail=""):
    global checks
    checks += 1
    if not cond:
        fails.append(f"{name}: {detail}")
    print(("  PASS " if cond else "  FAIL ") + name + ("" if cond else "  <- " + str(detail)))


def load(name):
    raw = json.loads((EVIDENCE / f"{name}.json").read_text(encoding="utf-8"))
    return raw["result"]


# ── 场景 1：savePoint 拍完成后刷新 ───────────────────────────────────────────
print("[§3.1 存档恢复到「最后完成节拍之后」]")
b1, a1 = load("01_before"), load("02_after")
ok("存档点 2.2 完成后落在 2.3 起点（beatIndex 2）",
   b1["beatId"] == "2.3" and b1["beatIndex"] == 2, (b1["beatId"], b1["beatIndex"]))
ok("存档元信息指向恢复拍", b1["save"] == {"exists": True, "version": 1, "beatId": "2.3"}, b1["save"])
ok("刷新后仍在新拍起点且 require 全未满足",
   a1["beatId"] == b1["beatId"] and a1["beatIndex"] == b1["beatIndex"] and
   a1["requirements"] == b1["requirements"], (a1["beatId"], a1["requirements"]))
ok("刷新后存档仍在 localStorage", a1["rawSaveExists"] is True, a1["rawSaveExists"])

fa, fb = b1["fingerprint"], a1["fingerprint"]
for k in ("chapterId", "beatId", "beatIndex", "mode", "cash", "NAV", "frozenCash", "realizedPnL",
          "dayIndex", "inGameDate", "isMarketOpen", "eventDeck", "currentEvent", "positions",
          "pendingOrders", "navHistory", "tradedNotional", "feesPaid", "conceptsIntroduced",
          "ruleCardsSeen", "completedBeats", "selectedInstrumentId"):
    ok(f"刷新前後 {k} 逐字节一致", fa[k] == fb[k], (str(fa[k])[:100], str(fb[k])[:100]))

# quotes：价格/涨跌停/K 线根数逐项比
qa, qb = json.loads(fa["quotes"]), json.loads(fb["quotes"])
price_fields = ("lastPrice", "prevClose", "open", "high", "low", "close", "limitUp", "limitDown")
bad = [(c, f, qa[c][f], qb[c][f]) for c in qa for f in price_fields if qa[c].get(f) != qb[c].get(f)]
ok("7 只标的的价格 / 涨跌停逐项一致", bad == [], bad)
klines_lost = {c: (qa[c]["klinesCount"], qb[c]["klinesCount"]) for c in qa
               if qa[c]["klinesCount"] != qb[c]["klinesCount"]}
ok("K 线历史跨刷新保留（quotes 契约含 K 线）",
   klines_lost == {}, f"K 线被清空：{klines_lost}")

# ── 场景 2：节拍中途存档 → 恢复到该节拍起点 ─────────────────────────────────
print("[Edge Case 存档落在节拍中途 → 恢复到该节拍起点]")
b2, a2 = load("03_midbeat_before"), load("04_midbeat_after")
ok("存档时处于 2.6 半完成态（4 项 require 只满足 1 项）",
   b2["beatId"] == "2.6" and sum("=true" in x for x in b2["requirements"]) == 1, b2["requirements"])
ok("刷新后仍在 2.6", a2["beatId"] == "2.6", a2["beatId"])
ok("刷新后 require 全部未满足（半完成进度被丢弃）",
   a2["allUnsatisfied"] is True and
   all("=false" in x for x in a2["requirements"]), a2["requirements"])

# ── 场景 3：面板打开时刷新 ──────────────────────────────────────────────────
print("[Edge Case 面板打开时刷新 → 重新打开同一面板且状态保留]")
b3, a3 = load("05_panel_before"), load("06_panel_after")
ok("刷新前面板已开、已作答（answeredKey 记录）",
   b3["panelId"] == "panel.confirm" and b3["pendingChoiceId"] == "1.9.confirm" and
   b3["answeredKey"] == "limit", b3)
ok("刷新后仍停在 1.9", a3["beatId"] == "1.9" and a3["chapterId"] == 1, (a3["chapterId"], a3["beatId"]))
ok("刷新后重新打开同一面板 panel.confirm",
   a3["panelId"] == "panel.confirm" and
   any("confirm" in x for x in a3["openPanels"]), (a3["panelId"], a3["openPanels"]))
ok("刷新后 pendingChoice.answeredKey 保留",
   a3["pendingChoiceId"] == "1.9.confirm" and a3["answeredKey"] == "limit",
   (a3["pendingChoiceId"], a3["answeredKey"]))
ok("刷新后该拍仍未满足（错答不推进）", a3["requirements"] == b3["requirements"], a3["requirements"])
fb3 = a3["fingerprint"]
ok("除面板外世界状态一致（cash / 日期 / 净值史 / 事件池）",
   all(b3["fingerprint"][k] == fb3[k] for k in
       ("cash", "NAV", "dayIndex", "inGameDate", "navHistory", "eventDeck", "positions")),
   {k: (b3["fingerprint"][k], fb3[k]) for k in ("cash", "navHistory", "eventDeck")
    if b3["fingerprint"][k] != fb3[k]})

# ── 场景 4（B2 回归）：chapterRejectSeen 跨刷新存活 ─────────────────────────
print("[B2 回归] 刷新后 2.6 仍可完成（`chapterRejectSeen` 必须持久化；该拍无 giveUp 出口）")
b4, a4 = load("07_rejectseen_before"), load("08_rejectseen_after")
ok("刷新前已停在 2.6 起点（已撞过 2.1–2.4 的拒单）", b4["beatId"] == "2.6", b4["beatId"])
ok("存档白名单里有 chapterRejectSeen 键",
   b4["rawSave"] is not None and "chapterRejectSeen" in b4["rawSave"], b4["rawSave"])
ok("刷新后仍在 2.6、四项 require 全未满足",
   a4["before"]["beatId"] == "2.6" and
   all("=false" in x for x in a4["before"]["requirements"]), a4["before"])
ok("刷新后四类合法委托全部成交（无拒单干扰）",
   len(a4["steps"]) == 4 and all(s["reasonCode"] == "OK" and s["status"] == "filled" for s in a4["steps"]),
   a4["steps"])
ok("刷新后 2.6 被满足并推进到 2.7（第二章仍可结章）",
   a4["after"]["beatId"] == "2.7" and a4["reached27"] is True, a4["after"])

# ── 场景 5（反证）：没有拒单史时 2.6 不可完成 ───────────────────────────────
print("[B2 反证] 全新会话直接到 2.6、全程无拒单 → correctedLimit 不可满足（证明场景 4 有判别力）")
c = load("10_control")
ok("四类委托都成交但 correctedLimit 仍不满足",
   len(c["steps"]) == 4 and all(s["reasonCode"] == "OK" for s in c["steps"]) and
   c["correctedLimitSatisfied"] is False, c)
ok("节拍停在 2.6（未推进）", c["beatId"] == "2.6", c["beatId"])

# ── 场景 6：章节进度重置 ────────────────────────────────────────────────────
print("[§4 章节进度重置]")
r5 = load("09_reset")
before, after = r5["before"], r5["after"]
ok("重置前章内状态非空（概念 / 规则卡 / 评级 / 存档）",
   len(before["conceptsIntroduced"]) > 0 and len(before["ruleCardsSeen"]) == 4 and
   before["rating"] is not None and before["save"]["exists"] is True, before["save"])
ok("重置后 chapterId == 1 / beatId == '1.0' / beatIndex == 0",
   after["chapterId"] == 1 and after["beatId"] == "1.0" and after["beatIndex"] == 0, after)
ok("重置后 conceptsIntroduced == []", after["conceptsIntroduced"] == [], after["conceptsIntroduced"])
ok("重置后 rating == null 且 ratingInputs 未打分",
   after["rating"] is None, after["rating"])
ok("重置后 completedBeats == [] / extraSegment == null / 补救配额复位",
   after["completedBeats"] == [] and after["extraSegment"] is None and
   after["remedialUsedThisChapter"] is False, after)
ok("重置后存档被清空（exists=false 且 localStorage 无键）",
   after["save"]["exists"] is False and r5["rawSaveAfterReset"] is None,
   (after["save"], r5["rawSaveAfterReset"]))
ok("规则卡（词典侧已读标记）保留 —— PRD §4 只要求清「章内状态」",
   after["ruleCardsSeen"] == before["ruleCardsSeen"], (before["ruleCardsSeen"], after["ruleCardsSeen"]))

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
