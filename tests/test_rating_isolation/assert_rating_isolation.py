#!/usr/bin/env python3
"""test_rating_isolation 断言（读 evidence/drive_result.json）。

PRD §3.3 五把锁中的两把：
  L2 评级不侵入市场层 —— 注入极端评级输入（A / D / C）后 `sim.snapshot()` 与对照逐字节相同；
  L3 A 级不发资源     —— A 级后 cash/NAV/frozenCash/tradedNotional/feesPaid/持仓/navHistory
                        与对照一致，只有 extraSegment.kind='advanced' 与进阶词典条目变化。

契约：断言失败 → exit 1（运行时保持存活，便于事后 reattach）。
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


# ── L2：注入极端评级 → sim.snapshot() 逐字节相同 ─────────────────────────────
print("[§3.3 L2 评级不侵入市场层：注入 A/D/C 后 sim.snapshot() 与对照逐字节相同]")
l2 = R["l2"]
ok("已进入第二章（评级窗口所在章）", l2["entered"]["chapterId"] == 2, l2["entered"])
grades = {g["name"]: g["grade"] for g in l2["grades"]}
ok("注入 A 得 A 档", grades.get("A") == "A", grades)
ok("注入 D 得 D 档", grades.get("D") == "D", grades)
ok("注入 C 得 C 档", grades.get("C") == "C", grades)
ok("sim.snapshot() 逐字节相同", l2["byteIdentical"] is True,
   f"fieldDiff={l2['fieldDiff']}")
ok("逐字段 diff 为空（含 quotes/currentEvent/eventDeck/limitUp·limitDown）",
   l2["fieldDiff"] == [], l2["fieldDiff"])
ok("涨跌停限价表（limitsFor）往返相同", l2["limitsIdentical"] is True, "limits differ")
ok("canSubmitOrder 不变", l2["before"]["canSubmit"] == l2["after"]["canSubmit"],
   (l2["before"]["canSubmit"], l2["after"]["canSubmit"]))
ok("selectedInstrumentId 不变",
   l2["before"]["selected"] == l2["after"]["selected"],
   (l2["before"]["selected"], l2["after"]["selected"]))
ok("isMarketOpen 不变", l2["before"]["open"] == l2["after"]["open"],
   (l2["before"]["open"], l2["after"]["open"]))

# ── L2b：注入极端评级后市场层照常可用（费用常量 / 撮合往返）─────────────────
print("[L2b 注入极端评级后同一笔委托结果逐字段一致（费率与撮合未被污染）]")
o = R["l2Order"]
ok("对照单（未注入）已成交", o["o0"]["order"]["status"] == "filled", o["o0"]["order"])
ok("注入 A 后同一笔委托逐字段一致", o["o1"]["order"] == o["o0"]["order"], (o["o0"]["order"], o["o1"]["order"]))
ok("注入 D 后同一笔委托逐字段一致", o["o2"]["order"] == o["o0"]["order"], (o["o0"]["order"], o["o2"]["order"]))
ok("手续费常量往返一致", o["feeRoundTrip"] is True, (o["o0"]["order"]["fee"], o["o1"]["order"]["fee"], o["o2"]["order"]["fee"]))
ok("成交价往返一致", o["fillRoundTrip"] is True, (o["o0"]["order"]["fillPrice"], o["o2"]["order"]["fillPrice"]))

# ── L3：A 级不发资源 ────────────────────────────────────────────────────────
print("[§3.3 L3 A 级不发资源：只改 extraSegment 与进阶条目，钱与持仓一动不动]")
l3 = R["l3"]
ok("注入后确实落在 A 档", l3["gradeA"] == "A", l3["gradeA"])
ok("A 级 → extraSegment.kind == 'advanced'",
   (l3["cA"]["extra"] or {}).get("kind") == "advanced", l3["cA"]["extra"])
ok("A 级 → 解锁进阶条目（unlockConcepts 非空）",
   bool((l3["cA"]["extra"] or {}).get("unlockConcepts")), l3["cA"]["extra"])
ok("A 级后 sim.snapshot() 逐字节相同", l3["simIdentical"] is True, "sim changed")
ok("A 级后 cash/NAV/frozenCash/tradedNotional/feesPaid/持仓/navHistory 全同",
   l3["resourcesIdentical"] is True, l3["resourcesIdentical"])
ok("对照（B 档）不产生加演段", l3["gradeB"] == "B" and l3["cB"]["extra"] is None,
   (l3["gradeB"], l3["cB"]["extra"]))
# 第二章数据里声明的那两条进阶条目（`settlement.extraSegments.advanced.unlockConcepts`）。
# 词典现在覆盖全部 8 章共 7 条进阶条目，**其他章**声明的进阶条目不受本章 A 级影响，
# 因此断言只针对「本章声明的这两条」。
ADVANCED_2 = {"限价单", "市价单"}
ok("注入前本章声明的进阶条目是折叠态",
   ADVANCED_2 <= set(l3["lockedBefore"]), l3["lockedBefore"])
ok("A 级后本章声明的进阶条目全部展开（不再折叠）",
   not (ADVANCED_2 & set(l3["lockedAfterA"])), l3["lockedAfterA"])
ok("B 档对照下进阶条目折叠态一字不变（非 A 级不解锁）",
   set(l3["lockedAfterB"]) == set(l3["lockedBeforeB"]) and ADVANCED_2 <= set(l3["lockedAfterB"]),
   (l3["lockedBeforeB"], l3["lockedAfterB"]))

# ── L3b：章末真实路径（devForceGrade('A') → 结算）同样不发资源 ───────────────
print("[L3b 章末 A 级路径同样不发资源]")
e = R["l3End"]
ok("章末评级为 A", (e["atEnd"]["rating"] or {}).get("grade") == "A", e["atEnd"]["rating"])
ok("章末 A 级 → extraSegment.kind == 'advanced' + 解锁 2 条进阶条目",
   (e["atEnd"]["extra"] or {}).get("kind") == "advanced" and
   (e["atEnd"]["extra"] or {}).get("unlockConcepts") == ["限价单", "市价单"], e["atEnd"]["extra"])
for f in ("cash", "NAV", "frozenCash", "tradedNotional", "feesPaid"):
    ok(f"章末 A 级前后 {f} 不变", e["before"][f] == e["after"][f], (e["before"][f], e["after"][f]))

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
