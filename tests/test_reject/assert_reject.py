#!/usr/bin/env python3
"""断言：拒单条件（PRD §3.4 拒单表 + Edge Case 数量 ≤ 0）。

每条拒单必须给出：独立 reasonCode + 玩家可读中文文案（PRD 逐字）。
绝不断言「拒单即失败」以外的行为 —— 拒单是安全失败，不改变账户。

用法： assert_reject.py <drive.json>
退出码：0 = 全部通过；1 = 至少一条断言失败。
"""
import json
import sys

FAILS = []
CHECKS = 0


def check(label, cond, detail=""):
    global CHECKS
    CHECKS += 1
    if cond:
        print("  PASS  %s" % label)
    else:
        print("  FAIL  %s%s" % (label, ("  <- " + detail) if detail else ""))
        FAILS.append(label)


def load(path):
    raw = json.load(open(path, encoding="utf-8"))
    return raw["result"] if "result" in raw else raw


def rejected(scenario, code, text_must=None, text_exact=None):
    """通用拒单断言：reasonCode、accepted=false、status=rejected、文案。"""
    o = scenario["order"]
    tag = scenario.get("label", "")
    check(
        "%s reasonCode == %s" % (tag, code),
        o["reasonCode"] == code,
        "reasonCode=%r" % o["reasonCode"],
    )
    check("%s accepted == false" % tag, o["accepted"] is False, "accepted=%r" % o["accepted"])
    check("%s status == 'rejected'" % tag, o["status"] == "rejected", "status=%r" % o["status"])
    check("%s fillPrice == null" % tag, o["fillPrice"] is None, "fillPrice=%r" % o["fillPrice"])
    if text_exact is not None:
        check(
            "%s rejectText 逐字 == %r" % (tag, text_exact),
            o["rejectText"] == text_exact,
            "rejectText=%r" % o["rejectText"],
        )
    for frag in text_must or []:
        check(
            "%s rejectText 含 %r" % (tag, frag),
            frag in o["rejectText"],
            "rejectText=%r" % o["rejectText"],
        )
    return o


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    print("#1 可用资金不足（买 1 手茅台）")
    s = dict(d["s01_funds"], label="#1")
    o = rejected(s, "REJECT_1", text_must=["可用资金不足", "含手续费", "还差 ¥"])
    ctx = s["context"]
    need = round(ctx["lastPrice"] * 100, 2)
    check(
        "#1 文案含真实差额（1 手 ≈ ¥%.2f > 可用 ¥%.2f）" % (need, ctx["cash"]),
        need > ctx["cash"],
        "need=%r cash=%r" % (need, ctx["cash"]),
    )
    check("#1 拒单后可用资金未变", s["state"]["cash"] == ctx["cash"], "cash=%r" % s["state"]["cash"])
    check("#1 拒单后无持仓", s["state"]["positions"] == [], "positions=%r" % s["state"]["positions"])

    print("#2 委托价超涨跌停")
    s = dict(d["s02_limit_over_up"], label="#2a 买入限价 > 涨停")
    o = rejected(s, "REJECT_2", text_must=["委托价超出今日涨跌停区间", "–"])
    ctx = s["context"]
    check(
        "#2a 文案含跌停价 ¥%.2f 与涨停价 ¥%.2f（先跌停后涨停）" % (ctx["limitDown"], ctx["limitUp"]),
        ("¥%.2f" % ctx["limitDown"]) in o["rejectText"]
        and ("¥%.2f" % ctx["limitUp"]) in o["rejectText"]
        and o["rejectText"].index("¥%.2f" % ctx["limitDown"]) < o["rejectText"].index("¥%.2f" % ctx["limitUp"]),
        "rejectText=%r" % o["rejectText"],
    )
    s = dict(d["s02_limit_under_down"], label="#2b 卖出限价 < 跌停")
    rejected(s, "REJECT_2", text_must=["委托价超出今日涨跌停区间", "–"])

    print("#4 T+1 未解禁（当日买入后当日卖出）")
    s = dict(d["s04_t1"], label="#4")
    rejected(
        s,
        "REJECT_4",
        text_must=["A 股实行 T+1", "今日买入需下个交易日才能卖出"],
    )
    check(
        "#4 拒单前持仓 lockedQty > 0（当日买入锁定）",
        s["context"]["lockedQty"] is not None and s["context"]["lockedQty"] > 0,
        "lockedQty=%r" % s["context"]["lockedQty"],
    )
    check(
        "#4 拒单后持仓与锁定未变",
        s["state"]["positions"] == s["context"]["positions"],
        "positions=%r" % s["state"]["positions"],
    )

    print("#6 数量非整手")
    rejected(
        dict(d["s06_lot"], label="#6"),
        "REJECT_6",
        text_exact="A 股最小交易单位为 100 股（1 手）",
    )

    print("#7 价格精度不符")
    rejected(
        dict(d["s07_tick"], label="#7"),
        "REJECT_7",
        text_exact="价格需为 ¥0.01 的整数倍",
    )

    print("#8 可卖持仓不足")
    s = dict(d["s08_shares"], label="#8")
    rejected(s, "REJECT_8", text_exact="可用持仓不足，无法卖出")
    check(
        "#8 前置：持仓 100 股、无 T+1 锁定，卖出 200 股 → 可用不足",
        s["context"]["heldQty"] == 100 and s["context"]["lockedQty"] == 0,
        "held=%r locked=%r" % (s["context"]["heldQty"], s["context"]["lockedQty"]),
    )

    print("#3 休市")
    s = dict(d["s03_closed"], label="#3")
    rejected(s, "REJECT_3", text_exact="今天该市场休市，无法下单")
    check(
        "#3 前置：推进到周六（%s，dayIndex=%r）" % (s["context"]["inGameDate"], s["context"]["dayIndex"]),
        s["context"]["isMarketOpen"] is False and s["context"]["dayIndex"] == 6,
        "context=%r" % s["context"],
    )
    check(
        "#3 canSubmitOrder == false（下单面板不可提交）",
        s["context"]["canSubmitOrder"] is False,
        "canSubmitOrder=%r" % s["context"]["canSubmitOrder"],
    )

    print("Edge Case 数量 ≤ 0（独立原因码 REJECT_10）")
    z = dict(d["s10_qty_zero"], label="数量 0")
    op = rejected(z, "REJECT_10", text_exact="委托数量必须大于 0")
    check("数量 0 的 reasonCode ≠ REJECT_6（区别于非整手）", op["reasonCode"] != "REJECT_6")
    n = dict(d["s10_qty_negative"], label="数量 −100")
    op2 = rejected(n, "REJECT_10", text_exact="委托数量必须大于 0")
    check("数量 −100 的 reasonCode ≠ REJECT_6（区别于非整手）", op2["reasonCode"] != "REJECT_6")

    print("收尾：驱动脚本最后已 reset 回初始可玩状态")
    fs = d["finalState"]
    check("finalState.dayIndex == 1", fs["dayIndex"] == 1, "dayIndex=%r" % fs["dayIndex"])
    check("finalState.cash == 100000", fs["cash"] == 100000, "cash=%r" % fs["cash"])
    check("finalState.positions == []", fs["positions"] == [], "positions=%r" % fs["positions"])

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
