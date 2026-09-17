#!/usr/bin/env python3
"""test_chapter1_beats 断言（读 evidence/drive_result.json）。"""
import json
import re
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


# ── §3.4 1.0→1.9 全通 ────────────────────────────────────────────────────────
print("[§3.4 第一章 1.0→1.9 全通]")
seq = [("at11", "1.1"), ("at12", "1.2"), ("at13", "1.3"), ("at14", "1.4"),
       ("at15", "1.5"), ("afterBuy1", "1.5.5"), ("at16", "1.6"), ("at17", "1.7"), ("at18", "1.8"), ("at19", "1.9")]
for key, beat in seq:
    ok(f"{key} → beatId == '{beat}'", R[key]["beatId"] == beat, R[key]["beatId"])
ok("1.3 入金后 cash == 100000", abs(R["at14"]["cash"] - 100000) < 0.01, R["at14"]["cash"])
ok("1.9 结束 → chapterId == 2", R["finalChapterId"] == 2, R["finalChapterId"])
ok("1.9 结束 → beatId == '2.1'", R["finalBeatId"] == "2.1", R["finalBeatId"])
ok("章末确认成功", R["chapter2"].get("ok") is True, R["chapter2"])

# ── 负例：互动不可退化为段落 ────────────────────────────────────────────────
print("[§3.1/§2.3 互动不可退化为段落（负例）]")
ok("跳过存单互动 → 节拍不推进",
   R["negativeSkipDeposit"]["beatId"] == "1.1" and
   "1.1.openDeposit=false" in R["negativeSkipDeposit"]["requirements"], R["negativeSkipDeposit"])
ok("概念卡只读 1 张 → 节拍不推进",
   R["negativePartialCards"]["beatId"] == "1.5.5", R["negativePartialCards"])
ok("复盘面板未关 → 节拍不推进", R["negativeReviewOpen"]["beatId"] == "1.8", R["negativeReviewOpen"])

# ── §3.4 修复 1/2/3 ─────────────────────────────────────────────────────────
print("[§3.4 修复 1/2/3：默认选中 + 「1 手约」列 + 茅台超资金标记]")
wl = R["watchlist"]
ok("自选列表 7 行", wl["count"] == 7, wl["count"])
ok("修复1：默认选中 = 买得起的最低价款 601398",
   wl["selectedInstrumentId"] == "601398" and wl["expectedCheapestAffordable"] == "601398",
   f"sel={wl['selectedInstrumentId']} expected={wl['expectedCheapestAffordable']}")
ok("修复1：高亮行（.sel）正是 601398",
   [(r["code"] or "").split("\n")[0] for r in wl["rows"] if r["sel"]] == ["601398"],
   [r["code"] for r in wl["rows"] if r["sel"]])
for r in wl["rows"]:
    code = (r["code"] or "").replace("\n", " ").split(" ")[0]
    lp = wl["quotes"][code]["lastPrice"]
    ok(f"修复2：{code} 行有「1 手约 ¥X」列且 X = 最新价×100",
       r["lot"] == f"1 手约 ¥{round(lp * 100, 2):,.2f}" and abs(float(r["perLot"]) - round(lp * 100, 2)) < 0.01,
       f"lot={r['lot']} perLot={r['perLot']} last={lp}")
rows_by_code = {(r["code"] or "").replace("\n", " ").split(" ")[0]: r for r in wl["rows"]}
ok("修复3：600519 行标超资金（.over + data-affordable=0 + 文案）",
   rows_by_code["600519"]["lotOver"] and rows_by_code["600519"]["rowOver"] and
   rows_by_code["600519"]["affordable"] == "0" and rows_by_code["600519"]["flag"] == "超出可用资金",
   rows_by_code["600519"])
others = [c for c in rows_by_code if c != "600519"]
ok("修复3：其余 6 行均标记为买得起",
   all(rows_by_code[c]["affordable"] == "1" and not rows_by_code[c]["lotOver"] for c in others),
   {c: rows_by_code[c]["affordable"] for c in others})

# ── §3.4 1.5 预填 + 必成交 ──────────────────────────────────────────────────
print("[§3.4 1.5 预填（限价/最新价/1 手/明细逐项）+ 必成交]")
pf = R["prefill"]
ok("预填类型 = 限价", pf["limitSelected"] is True, pf["limitSelected"])
ok("预填价格 == 最新价", pf["priceValue"] == f"{pf['lastPrice']:.2f}", f"{pf['priceValue']} vs {pf['lastPrice']}")
ok("预填数量 == 100（1 手）", pf["qtyValue"] == "100", pf["qtyValue"])
for token in ["成交金额", "手续费", "过户费", "预计支出"]:
    ok(f"明细含「{token}」", token in (pf["ticketText"] or ""), token)
ok("成交金额 == 最新价×100", f"¥{pf['lastPrice'] * 100:,.2f}" in (pf["ticketText"] or ""), pf["ticketText"][:200])
b1 = R["afterBuy1"]
ok("首次提交即成交（按钮转「已买入」）", "已买入" in (b1["submitLabel"] or ""), b1["submitLabel"])
ok("成交态标记 data-idempotent=1", b1["idempotent"] == "1", b1["idempotent"])
ok("成交后进入 1.5.5", b1["beatId"] == "1.5.5", b1["beatId"])

# ── Edge Case 1.5 幂等 ─────────────────────────────────────────────────────
print("[Edge Case 1.5 幂等：连点三次只成交 1 笔]")
idem = R["idempotence"]
ok("tradeNotional 只加一次（== 成交金额）", abs(idem["tradedNotional"] - pf["lastPrice"] * 100) < 0.01, idem["tradedNotional"])
ok("持仓仍为 1 手", idem["qty"] == 100 and idem["positionCount"] == 1, idem)
ok("费用只收一次（== 手续费）", idem["feesPaid"] < 6, idem["feesPaid"])

# ── 1.6 高亮 + 1.7/1.8 复盘 ────────────────────────────────────────────────
print("[§3.4 1.6 顶栏按钮高亮 / 1.7-1.8 复盘 + realizedPnL 变号]")
ab = R["advanceButton"]
ok("1.6 顶栏「进入下一交易日」存在且被强调", ab["found"] and ab["highlighted"] and ab["dataHighlight"] == "advanceDayButton", ab)
rv = R["review"]
ok("复盘面板已打开", rv["open"], rv["open"])
for token in ["买价", "卖价", "费用", "结果", "原因"]:
    ok(f"复盘面板含「{token}」", token in (rv["text"] or ""), token)
ok("卖出高于成本 → realizedPnL 为正", rv["fillPrice"] > rv["costPrice"] and rv["realizedPnL"] > 0,
   f"cost={rv['costPrice']} fill={rv['fillPrice']} pnl={rv['realizedPnL']}")
expected_gain = (rv["fillPrice"] - rv["costPrice"]) * rv["sellQty"] - rv["sellFee"]
ok("realizedPnL == (卖价−成本)×量 − 费用（盈利侧）",
   abs(rv["realizedPnL"] - round(expected_gain, 2)) < 0.02, f"{rv['realizedPnL']} vs {expected_gain}")
sc = R["signCheck"]
ok("亏本卖出 → realizedPnL 由正转负", sc["realizedBefore"] > 0 and sc["realizedAfter"] < 0,
   f"{sc['realizedBefore']} -> {sc['realizedAfter']}")
ok("亏损侧 delta == (卖价−成本)×量 − 费用（公式一致）",
   abs(sc["delta"] - sc["expectedDelta"]) < 0.02, sc)

# ── Edge Case 1.4 偏选茅台 ────────────────────────────────────────────────
print("[Edge Case 1.4 偏选茅台：非阻断提示 + 不改数量 + 可自行提交得 REJECT_1]")
mt = R["maotai"]
ok("玩家点选后 selectedInstrumentId == 600519", mt["selectedInstrumentId"] == "600519", mt["selectedInstrumentId"])
ok("面板出现非阻断超资金提示", "超出可用资金" in (mt["overNoteText"] or ""), mt["overNoteText"])
ok("提示同时给出「回到买得起的那只」", "回到买得起的那只" in (mt["overNoteText"] or ""), mt["overNoteText"])
ok("数量未被自动改动（仍为 100）", mt["qtyAfterPick"] == "100", mt["qtyAfterPick"])
ok("玩家自行提交 → REJECT_1", mt["rejectResult"]["reasonCode"] == "REJECT_1" and mt["rejectResult"]["accepted"] is False, mt["rejectResult"])
ok("拒单后未产生持仓（安全失败）", mt["positionsAfter"] == [], mt["positionsAfter"])

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
