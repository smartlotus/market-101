#!/usr/bin/env python3
"""test_remedial_and_ladder 断言（读 evidence/drive_result.json）。

覆盖 plan.md Verification Plan 里 test_remedial_and_ladder 的 6 行：
  §3.3/§3.6 D 级是帮助（必过 + 一键补足本金入口 + 完成后可照常确认）
  §3.6     补救一次配额（真线先触发 → 章末 D 不起段；跨章重置为 false）
  §3.6     红线（NAV < ¥10,000）→ 补救段 → 回到被打断的节拍并恢复推进
  §3.6     一键补足本金：cash += ¥100,000 − NAV，其余状态全保留
  §3.6     黄档提示（章目标卡常驻行 + 老周每章最多一次）
  §3.3     外来入金剔除（补足本金 / 重置账户）

红线一节全程走 UI 路径（真实面板按钮点击 + `chapter.noteNav()`），不用 `dev*` 钩子。

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


# ── §3.6 红线补救段（UI 路径）────────────────────────────────────────────────
print("[§3.6 红线：NAV < ¥10,000 → 强制补救段 → 回到被打断的节拍并恢复推进]")
rl = R["redLine"]
ok("中断发生在 2.2（非首拍，断言才有意义）", rl["before"]["beatId"] == "2.2", rl["before"])
hit = rl["hit"]
ok("moneyTier == 'red'", hit["moneyTier"] == "red", hit["moneyTier"])
ok("redLineActive == true", hit["redLineActive"] is True, hit["redLineActive"])
ok("打断时记下 interruptedBeatId == '2.2'", hit["interruptedBeatId"] == "2.2", hit["interruptedBeatId"])
ok("补救段已建立：kind='remedial' / origin='redLine'",
   hit["extraSegment"]["kind"] == "remedial" and hit["extraSegment"]["origin"] == "redLine", hit["extraSegment"])
ok("段内 4 步（四层拆账）且从头开始", hit["extraSegment"]["steps"] == 4 and hit["extraSegment"]["stepIndex"] == 0,
   hit["extraSegment"])
ok("段内文案标「再摆一次」", hit["extraSegment"]["label"] == "再摆一次", hit["extraSegment"]["label"])
ok("段末尾有「一键补足本金」入口", hit["extraSegment"]["toTopUpLabel"] == "一键补足本金", hit["extraSegment"])
ok("补救配额已被消耗", hit["remedialUsedThisChapter"] is True, hit["remedialUsedThisChapter"])
dom = rl["dom"]
ok("段面板在 DOM 上真的可见", dom["visible"] is True, dom["visible"])
ok("段面板有可点的「继续」按钮", dom["hasFinish"] is True, dom["hasFinish"])
ok("段面板有「一键补足本金」按钮", dom["hasTopUp"] is True, dom["hasTopUp"])
ok("「继续」按钮未被禁用", dom["finishDisabled"] is False, dom["finishDisabled"])
ok("面板正文含四层拆账四步", all(t in (dom["panelText"] or "") for t in ["先看标的", "再看事件", "再看操作", "最后看费用"]),
   (dom["panelText"] or "")[:200])
ok("面板正文含「一键补足本金」", "一键补足本金" in (dom["panelText"] or ""), (dom["panelText"] or "")[-80:])
ok("开面板期间真暂停（sceneTree.running == false）", dom["sceneTreeRunning"] is False, dom["sceneTreeRunning"])
clicks = rl["clicks"]
ok("4 次真实按钮点击走完 4 步", len(clicks) == 4 and [c["stepBefore"] for c in clicks] == [0, 1, 2, 3],
   [c["stepBefore"] for c in clicks])
ok("第 4 次点击后段被清除", clicks[-1]["segmentLeft"] is None and clicks[-1]["stepAfter"] is None, clicks[-1])
after = rl["after"]
ok("段后 extraSegment / redLineActive / interruptedBeatId 全清空",
   after["extraSegment"] is None and after["redLineActive"] is False and after["interruptedBeatId"] is None, after)
ok("回到被打断的节拍 2.2（beatIndex 未变）",
   after["beatId"] == "2.2" and after["beatIndex"] == rl["before"]["beatIndex"], after)
ok("回到该拍起点（require 全部未满足）", after["allRequiresUnsatisfied"] is True, after)
ok("段面板已关闭", after["panelStillVisible"] is False, after["panelStillVisible"])
ok("暂停解除（sceneTree.running == true）", after["sceneTreeRunning"] is True, after["sceneTreeRunning"])
ok("推进恢复：2.2 提交 → REJECT_2 且节拍推进到 2.3",
   rl["resumed"]["reasonCode"] == "REJECT_2" and rl["resumed"]["beatId"] == "2.3", rl["resumed"])
ok("同章第二次触线不再起段（配额）", rl["quota"]["extraSegment"] is None and rl["quota"]["redLineActive"] is False,
   rl["quota"])

# ── §3.3/§3.6 D 级是帮助 ───────────────────────────────────────────────────
print("[§3.3/§3.6 D 级是帮助：remedial 段必过 + 一键补足本金入口 + 完成后可照常确认]")
g = R["gradeD"]
ok("章末评级为 D", (g["atEnd"]["rating"] or {}).get("grade") == "D", g["atEnd"]["rating"])
ok("D 级 → extraSegment.kind == 'remedial' / origin == 'grade'",
   (g["atEnd"]["extraSegment"] or {}).get("kind") == "remedial" and
   (g["atEnd"]["extraSegment"] or {}).get("origin") == "grade", g["atEnd"]["extraSegment"])
ok("先打开的是章末结算面板", any("settlement" in x for x in g["atEnd"]["openPanels"]), g["atEnd"]["openPanels"])
ie = g["inExtra"]
ok("进入补救段后面板可见且有「继续」/「一键补足本金」",
   ie["panelId"] == "panel.extraSegment" and ie["visible"] and ie["hasFinish"] and ie["hasTopUp"], ie)
ok("段内标「再摆一次」", (ie["extraSegment"] or {}).get("label") == "再摆一次", ie["extraSegment"])
ok("段内 4 步", (ie["extraSegment"] or {}).get("steps") == 4, ie["extraSegment"])
ok("4 次真实点击即可走完（必过）", len(g["clicks"]) == 4 and g["clicks"][-1]["stepAfter"] is None, g["clicks"])
ok("段结束后 extraSegment 清空", g["afterComplete"]["extraSegment"] is None, g["afterComplete"])
ok("段结束后落到理解确认面板", any("confirm" in x for x in g["afterComplete"]["openPanels"]), g["afterComplete"])
ok("未答理解确认题时章末确认被拒（负例）", g["confirmBeforeAnswer"].get("ok") is False, g["confirmBeforeAnswer"])
ok("答对后章末确认成功（完成后可照常确认）", g["confirmAfterRemedial"].get("ok") is True, g["confirmAfterRemedial"])
ok("第二章确认后进入 freeDay（PRD §4）", g["modeAfter"] == "freeDay", g["modeAfter"])

# ── §3.6 补救一次配额 ───────────────────────────────────────────────────────
print("[§3.6 补救一次配额：真线先触发 → 章末 D 只显示评级，不重复起段；跨章重置]")
q = R["quota"]
ok("真线触发后配额为 true", q["usedAfterRedLine"] is True, q["usedAfterRedLine"])
ok("补救段走完后回到被打断的 2.2",
   q["afterRedLine"]["extraSegment"] is None and q["afterRedLine"]["beatId"] == "2.2", q["afterRedLine"])
ok("章末仍评 D", q["atEnd"]["rating"] == "D", q["atEnd"]["rating"])
ok("章末 D：extraSegment == null（不重复触发补救）", q["atEnd"]["extraSegment"] is None, q["atEnd"])
ok("章末照常显示结算面板", q["atEnd"]["panelId"] == "panel.settlement", q["atEnd"])
ok("结算文案仍给出 D 档点评", "再摆一次" in (q["settlementText"] or ""), (q["settlementText"] or "")[-80:])
ok("章末推进后直接到理解确认（无补救段）",
   q["afterEndPhase"]["extraSegment"] is None and q["afterEndPhase"]["panelId"] == "panel.confirm", q["afterEndPhase"])
ok("跨章边界重置为 false（重进第一章）",
   q["afterChapterReset"]["remedialUsedThisChapter"] is False and q["afterChapterReset"]["chapterId"] == 1 and
   q["afterChapterReset"]["beatId"] == "1.0", q["afterChapterReset"])

# ── §3.6 一键补足本金 ───────────────────────────────────────────────────────
print("[§3.6 一键补足本金：NAV 补到 ¥100,000，持仓/净值史/章节进度/导师关系全保留，不限次数]")
t = R["topUp"]
ok("补足前 NAV < ¥100,000", t["before"]["NAV"] < 100000, t["before"]["NAV"])
ok("点一次后 NAV == ¥100,000", abs(t["after1"]["NAV"] - 100000) < 0.005, t["after1"]["NAV"])
injection = t["after1"]["injection"]
ok("注入额 == ¥100,000 − 补足前 NAV", abs(injection - (100000 - t["before"]["NAV"])) < 0.02,
   (injection, t["before"]["NAV"]))
ok("cash 按注入额增加", abs((t["after1"]["cash"] - t["before"]["cash"]) - injection) < 0.02,
   (t["before"]["cash"], t["after1"]["cash"], injection))
ok("持仓保留", t["after1"]["qty"] == t["before"]["qty"] == 100, (t["before"]["qty"], t["after1"]["qty"]))
ok("navHistory 保留", t["after1"]["navHistoryLen"] == t["before"]["navHistoryLen"],
   (t["before"]["navHistoryLen"], t["after1"]["navHistoryLen"]))
ok("章节进度保留（beatId 不变）", t["after1"]["beatId"] == t["before"]["beatId"], (t["before"]["beatId"], t["after1"]["beatId"]))
ok("已介绍概念保留", t["after1"]["concepts"] == t["before"]["concepts"], (t["before"]["concepts"], t["after1"]["concepts"]))
ok("导师关系保留（explainCounts 不变）", t["after1"]["explainCounts"] == t["before"]["explainCounts"],
   (t["before"]["explainCounts"], t["after1"]["explainCounts"]))
ok("不限次数：第二次点击 NAV 已满 → 不倒扣、不报错",
   abs(t["after2"]["NAV"] - 100000) < 0.005 and abs(t["after2"]["cash"] - t["after1"]["cash"]) < 0.005,
   (t["after1"], t["after2"]))

# ── §3.6 黄档 ───────────────────────────────────────────────────────────────
print("[§3.6 黄档：章目标卡常驻行 + 补足按钮；老周每章最多非侵入提示一次]")
y = R["yellow"]
ok("NAV ∈ [¥10,000, ¥50,000) → moneyTier == 'yellow'", y["first"]["moneyTier"] == "yellow", y["first"]["moneyTier"])
ok("章目标卡出现「你的本金只剩 ¥X。随时可以补足。」",
   "你的本金只剩" in (y["first"]["line"] or "") and "随时可以补足" in (y["first"]["line"] or ""), y["first"]["line"])
ok("goalCard 上同款黄档行与「补足本金」标签",
   "你的本金只剩" in (y["first"]["goalCard"]["yellowLine"] or "") and y["first"]["goalCard"]["topUpLabel"] == "补足本金",
   y["first"]["goalCard"])
ok("老周有一次非侵入提示（mentor.line 非空、speaker='face'）",
   bool(y["first"]["mentorLine"]) and y["first"]["mentorSpeaker"] == "face", y["first"])
ok("同一章内再次触线不再追加提示（行文案不变）",
   y["second"]["mentorLine"] == y["lineAfterFirst"] and y["second"]["moneyTier"] == "yellow", y["second"])
ok("回到绿档 → 黄档行隐藏", y["green"]["moneyTier"] == "green" and y["green"]["tierHidden"] is True, y["green"])

# ── §3.3 外来入金剔除 ───────────────────────────────────────────────────────
print("[§3.3 外来入金剔除：补足本金后 rar 不改善；重置账户记 max(0, ¥100,000 − NAV)]")
inj = R["injection"]
ok("有外来入金与无外来入金的 rar 完全相同（不改善）",
   inj["noInjection"]["rar"] == inj["withInjection"]["rar"], (inj["noInjection"]["rar"], inj["withInjection"]["rar"]))
ok("S 也不因外来入金改善", inj["noInjection"]["S"] == inj["withInjection"]["S"],
   (inj["noInjection"]["S"], inj["withInjection"]["S"]))
ok("maxDD 不受外来入金影响", inj["noInjection"]["maxDD"] == inj["withInjection"]["maxDD"],
   (inj["noInjection"]["maxDD"], inj["withInjection"]["maxDD"]))
real = inj["real"]
ok("真实补足本金：窗口外来入金 == 净增额",
   abs(real["externalInjectionInWindow"] - (100000 - real["navBefore"])) < 0.02,
   (real["externalInjectionInWindow"], real["navBefore"]))
ok("补足后 NAV == ¥100,000", abs(real["navAfter"] - 100000) < 0.005, real["navAfter"])
ok("重置账户记入 max(0, ¥100,000 − 重置前 NAV)",
   abs(inj["resetResult"]["injection"] - max(0, 100000 - inj["navBeforeReset"])) < 0.02,
   (inj["resetResult"], inj["navBeforeReset"]))
ok("重置账户的净增额同样进评级窗口的外来入金",
   inj["resetExternal"] is not None and
   abs(inj["resetExternal"] - max(0, 100000 - inj["navBeforeReset"])) < 0.02,
   (inj["resetExternal"], inj["navBeforeReset"]))
ok("调整净值把外来入金剔除（最后一个采样 = NAV − 累计外来入金）",
   bool(real["adjustedNavSeries"]) and
   abs(real["adjustedNavSeries"][-1] - (real["navAfter"] - real["externalInjectionInWindow"])) < 0.02,
   (real["adjustedNavSeries"], real["navAfter"], real["externalInjectionInWindow"]))

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
