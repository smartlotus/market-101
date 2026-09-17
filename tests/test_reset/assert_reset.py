#!/usr/bin/env python3
"""断言：重置账户（PRD §4）—— 资金/持仓/已实现盈亏/日历/行情全部回到初始状态。

用法： assert_reset.py <drive.json>
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


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    dirty, clean, initial = d["dirty"], d["clean"], d["initial"]
    iid = "601398"

    print("前置：驱动后状态确实「脏」")
    check("已推进到 dayIndex == 2", dirty["dayIndex"] == 2, "dayIndex=%r" % dirty["dayIndex"])
    check("有持仓", len(dirty["positions"]) == 1, "positions=%r" % dirty["positions"])
    check("realizedPnL ≠ 0（发生过卖出）", abs(float(dirty["realizedPnL"])) > 1e-9, "realizedPnL=%r" % dirty["realizedPnL"])
    check("frozenCash > 0（有挂单冻结）", float(dirty["frozenCash"]) > 0, "frozenCash=%r" % dirty["frozenCash"])
    check("pendingOrders 非空", len(dirty["pendingOrders"]) == 1, "pending=%r" % dirty["pendingOrders"])
    check("navHistory 长度 > 1", len(dirty["navHistory"]) > 1, "navHistory=%r" % dirty["navHistory"])
    check(
        "脏状态 K 线多于开局长（klinesCount = %r > %r）"
        % (dirty["quotes"][iid]["klinesCount"], initial["quotes"][iid]["klinesCount"]),
        dirty["quotes"][iid]["klinesCount"] > initial["quotes"][iid]["klinesCount"],
    )

    print("§4 reset() 后回到初始状态")
    check("cash == 100000.00", float(clean["cash"]) == 100000.0, "cash=%r" % clean["cash"])
    check("frozenCash == 0", float(clean["frozenCash"]) == 0.0, "frozenCash=%r" % clean["frozenCash"])
    check("positions == []", clean["positions"] == [], "positions=%r" % clean["positions"])
    check("realizedPnL == 0", float(clean["realizedPnL"]) == 0.0, "realizedPnL=%r" % clean["realizedPnL"])
    check("NAV == 100000.00", float(clean["NAV"]) == 100000.0, "NAV=%r" % clean["NAV"])
    check("dayIndex == 1", clean["dayIndex"] == 1, "dayIndex=%r" % clean["dayIndex"])
    check("inGameDate == 2026-01-05", clean["inGameDate"] == "2026-01-05", clean["inGameDate"])
    check("isMarketOpen == true", clean["isMarketOpen"] is True)
    check("pendingOrders == []", clean["pendingOrders"] == [], "pending=%r" % clean["pendingOrders"])
    check("lastOrder == null", clean["lastOrder"] is None, "lastOrder=%r" % clean["lastOrder"])
    check("navHistory == [100000]", clean["navHistory"] == [100000], "navHistory=%r" % clean["navHistory"])
    check(
        "selectedInstrumentId 回到默认首只 601398",
        clean["selectedInstrumentId"] == "601398",
        "selected=%r" % clean["selectedInstrumentId"],
    )

    print("§4 行情重生成")
    check(
        "K 线回到开局长（%r → %r）"
        % (dirty["quotes"][iid]["klinesCount"], clean["quotes"][iid]["klinesCount"]),
        clean["quotes"][iid]["klinesCount"] == initial["quotes"][iid]["klinesCount"],
        "klinesCount=%r 期望=%r" % (clean["quotes"][iid]["klinesCount"], initial["quotes"][iid]["klinesCount"]),
    )
    check(
        "历史被重新生成（与脏状态的报价结构不同，说明确实重建而非沿用）",
        clean["quotes"][iid] != dirty["quotes"][iid],
        "quotes 完全相同，疑似未重生成",
    )
    check(
        "重生成后涨跌停价按起始价重算（初始价 %r → 涨停 ≈ 6.82 / 跌停 ≈ 5.58）"
        % initial["quotes"][iid]["prevClose"],
        abs(float(clean["quotes"][iid]["limitUp"]) - 6.82) < 0.02
        and abs(float(clean["quotes"][iid]["limitDown"]) - 5.58) < 0.02,
        "up=%r down=%r" % (clean["quotes"][iid]["limitUp"], clean["quotes"][iid]["limitDown"]),
    )
    check(
        "每只标的的 K 线都回到开局长（7 只标的）",
        all(
            clean["quotes"][k]["klinesCount"] == initial["quotes"][k]["klinesCount"]
            for k in initial["quotes"]
        ),
        "clean=%r initial=%r"
        % ({k: clean["quotes"][k]["klinesCount"] for k in clean["quotes"]},
           {k: initial["quotes"][k]["klinesCount"] for k in initial["quotes"]}),
    )

    print("§4 重置后立刻可继续玩")
    check("canSubmitOrder == true", clean["canSubmitOrder"] is True)
    check(
        "第 1 日仍抽到当日事件（新闻卡可显示）",
        clean["currentEvent"] is not None and bool(clean["currentEvent"].get("id")),
        "currentEvent=%r" % clean["currentEvent"],
    )

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
