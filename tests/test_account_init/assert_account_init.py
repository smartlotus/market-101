#!/usr/bin/env python3
"""断言：账户初始状态（PRD §2.1）、默认选中标的（§2.5）、限价买入 ΔNAV = −fee（§2.1）。

用法： assert_account_init.py <drive.json>
drive.json 是 `vibegame play eval < drive.js` 的原始输出，形如 {"result": {...}}。
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


def close(a, b, tol=1e-9):
    return abs(float(a) - float(b)) <= tol


def load(path):
    raw = json.load(open(path, encoding="utf-8"))
    if "result" in raw:
        raw = raw["result"]
    return raw


def main():
    drive = load(sys.argv[1])
    if drive.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % drive["fatal"])
        FAILS.append("drive fatal")
        return 1

    init = drive["init"]

    print("§2.1 初始账户")
    check("cash == 100000.00", close(init["cash"], 100000), "cash=%r" % init["cash"])
    check("frozenCash == 0", close(init["frozenCash"], 0), "frozenCash=%r" % init["frozenCash"])
    check("positions == []", init["positions"] == [], "positions=%r" % init["positions"])
    check("realizedPnL == 0", close(init["realizedPnL"], 0), "realizedPnL=%r" % init["realizedPnL"])
    check("NAV == 100000.00", close(init["NAV"], 100000), "NAV=%r" % init["NAV"])
    check("navHistory == [100000]", init["navHistory"] == [100000], "navHistory=%r" % init["navHistory"])
    check("dayIndex == 1", init["dayIndex"] == 1, "dayIndex=%r" % init["dayIndex"])

    print("§2.5 默认选中标的 = 601398")
    # Stage 1 值级变更（PRD §3.4「修复已知缺陷的三条」1）：默认选中由「标的表首行 600519」
    # 改为「买得起的最低价款 601398」（`scenes/main.scene.json` 的 `defaultInstrumentId`）。
    # 字段名/类型/语义未变，只是默认值变了 —— Lead R2 已确认这是 PRD 要求。
    check(
        "selectedInstrumentId == '601398'（买得起的最低价款）",
        drive["defaultSelected"] == "601398",
        "selected=%r" % drive["defaultSelected"],
    )

    print("§2.1 限价买入 ΔNAV = −fee")
    lb = drive["limitBuy"]
    order = lb["order"]
    check("委托被接受", order["accepted"] is True, "accepted=%r" % order["accepted"])
    check("委托状态为 filled", order["status"] == "filled", "status=%r" % order["status"])
    check(
        "fillPrice == 最新价（限价 ≥ 最新价 → 价格改善后成交于最新价）",
        close(order["fillPrice"], lb["lastPrice"]),
        "fillPrice=%r lastPrice=%r" % (order["fillPrice"], lb["lastPrice"]),
    )
    check("qty == 100", order["qty"] == 100, "qty=%r" % order["qty"])
    check(
        "notional == fillPrice × 100",
        close(order["notional"], round(order["fillPrice"] * 100, 2)),
        "notional=%r" % order["notional"],
    )
    check(
        "cash 减 notional + fee",
        close(lb["cashAfter"], round(lb["cashBefore"] - order["notional"] - order["fee"], 2), 1e-9),
        "cashBefore=%r cashAfter=%r notional=%r fee=%r"
        % (lb["cashBefore"], lb["cashAfter"], order["notional"], order["fee"]),
    )
    check(
        "ΔNAV == −fee（精确）",
        close(round(lb["navAfter"] - lb["navBefore"], 2), -order["fee"], 1e-9),
        "ΔNAV=%r 期望 -fee=%r" % (round(lb["navAfter"] - lb["navBefore"], 2), -order["fee"]),
    )
    check(
        "买入后持仓 1 条 qty=100",
        len(lb["positions"]) == 1 and lb["positions"][0]["qty"] == 100,
        "positions=%r" % lb["positions"],
    )

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
