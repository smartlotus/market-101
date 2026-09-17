#!/usr/bin/env python3
"""test_chapter2_rejects 断言（读 evidence/drive_result.json + config/chapters.json）。"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVIDENCE = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "evidence"
R = json.loads((EVIDENCE / "drive_result.json").read_text(encoding="utf-8"))["result"]
CFG = json.loads((HERE / ".." / ".." / "config" / "chapters.json").read_text(encoding="utf-8"))
CH2 = next(c for c in CFG["chapters"] if c["id"] == 2)
CH1 = next(c for c in CFG["chapters"] if c["id"] == 1)

fails = []
checks = 0


def ok(name, cond, detail=""):
    global checks
    checks += 1
    if not cond:
        fails.append(f"{name}: {detail}")
    print(("  PASS " if cond else "  FAIL ") + name + ("" if cond else "  <- " + str(detail)))


# ── §3.8 定向事件（第一章 day1/day2）────────────────────────────────────────
print("[§3.8 定向事件：第一章 day1=I04 / day2=C03]")
ok("1.3 入金后开启的第一个交易日事件 == I04",
   R["ch1Day1"]["currentEvent"] == "I04", R["ch1Day1"])
ok("1.6 推进后第二个交易日事件 == C03",
   R["ch1Day2"]["currentEvent"] == "C03", R["ch1Day2"])
ok("第一章 directedEvents 实到/未到如实暴露",
   R["ch1Day1"]["directed"]["required"] == ["I04", "C03"] and R["ch1Day2"]["directed"]["owed"] == [],
   R["ch1Day2"]["directed"])

# ── §3.5 四次拒单必须由玩家主动提交触发 ────────────────────────────────────
print("[§3.5 四次拒单：未提交时无任何自动完成路径（负例）]")
ns = R["noSubmitNegatives"]
ok("2.1 未提交时停在 2.1", ns["start"] == "2.1", ns["start"])
for a in ns["attempts"]:
    ok(f"钩子 {a['name']} 不能替代玩家提交", a["beatId"] == "2.1" and a["reasonCode"] is None,
       f"beatId={a['beatId']} reasonCode={a['reasonCode']} err={a['err']}")

print("[§3.5 四次拒单：玩家主动提交后逐拍完成]")
expected = [("2.1", "REJECT_1"), ("2.2", "REJECT_2"), ("2.3", "REJECT_4"), ("2.4", "REJECT_3")]
for i, (beat, code) in enumerate(expected):
    r = R["rejects"][i]
    ok(f"{beat} 提交得 {code}", r["reasonCode"] == code, r["reasonCode"])
    nxt = expected[i + 1][0] if i + 1 < len(expected) else "2.5"
    ok(f"{beat} 完成后推进到 {nxt}", r["beatId"] == nxt, r["beatId"])
ok("2.3 是「当天买入后当天卖出」（当日锁定 100 股）",
   any(p.endswith("/100") for p in R["rejects"][2]["positions"]), R["rejects"][2]["positions"])
ok("被拒单不产生持仓（2.1/2.2 安全失败）",
   R["rejects"][0]["positions"] == [] and R["rejects"][1]["positions"] == [],
   [R["rejects"][0]["positions"], R["rejects"][1]["positions"]])

# ── Edge Case 拒单出口（giveUp）────────────────────────────────────────────
print("[Edge Case 第二章拒单出口：giveUp 代演示一次且该拍完成（不卡死）]")
gu = R["giveUp"]
ok("2.2 的 giveUp 存在并成功", gu["beat22"]["giveUpResult"] and gu["beat22"]["giveUpResult"]["ok"] is True, gu["beat22"]["giveUpResult"])
ok("2.2 代演示产生该拍要求的 REJECT_2",
   gu["beat22"]["after"]["reasonCode"] == "REJECT_2", gu["beat22"]["after"])
ok("2.2 giveUp 后该拍完成（推进到 2.3）", gu["beat22"]["after"]["beatId"] == "2.3", gu["beat22"]["after"]["beatId"])
ok("2.4 的 giveUp 存在并成功", gu["beat24"]["giveUpResult"] and gu["beat24"]["giveUpResult"]["ok"] is True, gu["beat24"]["giveUpResult"])
ok("2.4 代演示产生该拍要求的 REJECT_3",
   gu["beat24"]["after"]["reasonCode"] == "REJECT_3", gu["beat24"]["after"])
ok("2.4 giveUp 后该拍完成（推进到 2.5）", gu["beat24"]["after"]["beatId"] == "2.5", gu["beat24"]["after"]["beatId"])

# ── Edge Case 2.3 无持仓 ───────────────────────────────────────────────────
print("[Edge Case 2.3 无持仓：先买 1 手再卖 → REJECT_4]")
np = R["noPosition23"]
ok("场景起点无持仓", np["before"]["orderCount"] == 0, np["before"])
ok("场景起点是开市日", np["before"]["isMarketOpen"] is True, np["before"])
ok("无持仓直接卖出不产生 REJECT_4（得 REJECT_8），节拍不推进",
   np["sellWithoutPosition"]["reasonCode"] == "REJECT_8" and np["sellWithoutPosition"]["beatAfter"] == "2.3",
   np["sellWithoutPosition"])
ok("先买入 1 手成功",
   np["buyThenSell"]["buyReason"] == "OK" and np["buyThenSell"]["buyStatus"] == "filled", np["buyThenSell"])
ok("随后当日卖出得 REJECT_4",
   np["buyThenSell"]["sellReason"] == "REJECT_4", np["buyThenSell"])
ok("该拍完成（推进到 2.4）", np["buyThenSell"]["after"]["beatId"] == "2.4", np["buyThenSell"]["after"]["beatId"])

# ── §3.5 2.5 选择题 ───────────────────────────────────────────────────────
print("[§3.5 2.5 选择题：两个选项都有回馈、不判对错]")
ui = R["beat25Ui"]
choice_cfg = CH2["choices"]["2.5.fourRules"]
fb = [o.get("feedback", "") for o in choice_cfg["options"]]
ok("配置里两个选项都有非空回馈且文案不同",
   len(fb) == 2 and all(fb) and fb[0] != fb[1], fb)
ok("配置里 2.5 选择题不判对错（correctKey 为空）", choice_cfg.get("correctKey") in (None, ""), choice_cfg.get("correctKey"))
ok("两个选项通过作答钩子都推进（restrict）",
   ui["answerRestrict"]["advanced"] is True and ui["answerRestrict"]["correct"] is None, ui["answerRestrict"])
ok("两个选项通过作答钩子都推进（protect）",
   R["beat25SecondOption"]["answerResult"]["advanced"] is True and
   R["beat25SecondOption"]["answerResult"]["correct"] is None, R["beat25SecondOption"])

# —— 缺陷：选择题在 UI 上不可达（见 log.md「Player」的失败项）——
ok("[缺陷] 2.5 选择题在 UI 上可达（pendingChoice 非 null）",
   ui["pendingChoiceWhilePanelOpen"] is not None,
   f"pendingChoice={ui['pendingChoiceWhilePanelOpen']}；panel.ruleCards 的 blocks 只有 4 个 ruleCard，"
   f"没有 choiceGroup → openPanel 把 pendingChoiceId 置 null")
ok("[缺陷] 关掉规则卡面板后该拍应能继续（2.5.choice 可满足）",
   ui["afterClose"]["beatId"] != "2.5",
   f"afterClose={ui['afterClose']}")
ok("[缺陷] 面板/对话层存在可点选项",
   bool(ui["panelChoiceButtons"]) or bool(ui["dialogueChoiceButtons"]),
   f"panelChoiceButtons={ui['panelChoiceButtons']} dialogueChoiceButtons={ui['dialogueChoiceButtons']} "
   f"panelButtons={ui['panelButtonLabels']}")
ok("[缺陷] 面板正文含题干「你觉得这几条规则」", ui["panelTextHasQuestion"], ui["panelTextHasQuestion"])

# ── §3.5 出场条件 ────────────────────────────────────────────────────────
print("[§3.5 出场条件：四类合法委托 + 四张规则卡可查]")
ok("2.6 起始四项要求全未满足", R["at26Start"]["requirements"] ==
   ["2.6.limitBuy=false", "2.6.limitSell=false", "2.6.marketBuy=false", "2.6.correctedLimit=false"],
   R["at26Start"]["requirements"])
ok("限价买满足 2.6.limitBuy",
   R["at26AfterLimitBuy"]["requirements"][0] == "2.6.limitBuy=true", R["at26AfterLimitBuy"]["requirements"])
ok("限价卖满足 2.6.limitSell",
   R["at26AfterLimitSell"]["requirements"][1] == "2.6.limitSell=true", R["at26AfterLimitSell"]["requirements"])
ok("市价买满足 2.6.marketBuy",
   R["at26AfterMarketBuy"]["requirements"][2] == "2.6.marketBuy=true", R["at26AfterMarketBuy"]["requirements"])
ok("修正后的限价单满足 2.6.correctedLimit（四类齐全 → 推进 2.7）",
   R["at26AfterCorrected"]["beatId"] == "2.7", R["at26AfterCorrected"]["beatId"])
ok("四张规则卡均可查（ruleCardsSeen 含 4 个 id）",
   sorted(R["chapterEnd"]["ruleCardsSeen"]) == ["RULE_1", "RULE_2", "RULE_3", "RULE_4"],
   R["chapterEnd"]["ruleCardsSeen"])
ok("词典面板打开且含四张规则卡概念",
   R["dictionary"]["open"] is True and
   all(k in R["dictionary"]["entryKeys"] for k in ["可用资金不足", "涨跌停", "休市", "T+1"]),
   {k: (k in R["dictionary"]["entryKeys"]) for k in ["可用资金不足", "涨跌停", "休市", "T+1"]})
ok("未答对理解确认题时章末确认被拒（requiresRuleCards + choice）",
   R["chapterConfirmBeforeChoice"].get("ok") is False, R["chapterConfirmBeforeChoice"])
ok("答对后章末确认成功", R["chapterConfirmAfterChoice"].get("ok") is True, R["chapterConfirmAfterChoice"])
ok("第二章确认后进入 freeDay（PRD §4）", R["finalMode"] == "freeDay", R["finalMode"])
ok("自由窗口常驻卡给出第三章名与预告",
   R["nextChapter"]["id"] == 3 and bool(R["nextChapter"]["preview"]), R["nextChapter"])

# ── §3.8 定向事件（第二章 2.7 钉 I01）─────────────────────────────────────
print("[§3.8 第二章定向事件：2.7 钉 I01 / drawn 按声明顺序前缀]")
ok("2.7 推进后当日事件 == I01", R["at27AfterAdvance"]["currentEvent"] == "I01", R["at27AfterAdvance"])
req = CH2["directedEvents"]
drawn = R["at27AfterAdvance"]["directed"]["drawn"]
ok("drawn 是声明顺序的前缀",
   drawn == [e for e in req if e in drawn] and set(drawn).issubset(set(req)), f"drawn={drawn} required={req}")
ok("owed = 声明中未抽到的部分",
   R["at27AfterAdvance"]["directed"]["owed"] == [e for e in req if e not in drawn],
   R["at27AfterAdvance"]["directed"])

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
