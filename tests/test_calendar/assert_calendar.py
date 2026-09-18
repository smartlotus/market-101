#!/usr/bin/env python3
"""断言：交易日历（PRD §2.3）、连续休市、休市日持仓不重估、休市日当日涨跌幅为 0。

用法： assert_calendar.py <drive.json>
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
    return raw["result"] if "result" in raw else raw


def positions_of(state, iid):
    for p in state["positions"]:
        if p["instrumentId"] == iid:
            return p
    return None


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    iid = d["instrumentId"]
    day1, day2 = d["day1"], d["day2"]
    fri, sat, sun, mon = d["day5Friday"], d["day6Saturday"], d["day7Sunday"], d["day8Monday"]

    print("§2.3 普通交易日推进（进入下一交易日）")
    check("第 1 日 dayIndex == 1", day1["dayIndex"] == 1, "dayIndex=%r" % day1["dayIndex"])
    check("第 1 日 inGameDate == 2026-01-05", day1["inGameDate"] == "2026-01-05", day1["inGameDate"])
    check("第 1 日开市", day1["isMarketOpen"] is True)
    check("推进后 dayIndex == 2（+1）", day2["dayIndex"] == 2, "dayIndex=%r" % day2["dayIndex"])
    check(
        "推进后 inGameDate == 2026-01-06（+1 自然日）",
        day2["inGameDate"] == "2026-01-06",
        day2["inGameDate"],
    )
    check("推进后仍开市", day2["isMarketOpen"] is True)
    check("推进后 calendarClosedReason == null", day2["calendarClosedReason"] is None)

    print("§2.3 周五（连续休市起点）")
    check("周五 dayIndex == 5", fri["dayIndex"] == 5, "dayIndex=%r" % fri["dayIndex"])
    check("周五 inGameDate == 2026-01-09", fri["inGameDate"] == "2026-01-09", fri["inGameDate"])
    check("周五开市", fri["isMarketOpen"] is True)

    print("§2.3 周六：周末 isMarketOpen=false、行情/NAV 不变")
    check("周六 dayIndex == 6", sat["dayIndex"] == 6, "dayIndex=%r" % sat["dayIndex"])
    check("周六 inGameDate == 2026-01-10", sat["inGameDate"] == "2026-01-10", sat["inGameDate"])
    check("周六 isMarketOpen == false", sat["isMarketOpen"] is False)
    check(
        "周六 calendarClosedReason == 'weekend'",
        sat["calendarClosedReason"] == "weekend",
        "reason=%r" % sat["calendarClosedReason"],
    )
    # 加密 7×24：周末行情会动，逐字比较只对非加密标的成立（同下方周六→周日）
    _C = ("BTC", "ETH")
    _nc = lambda q: {k: v for k, v in (q or {}).items() if k not in _C}
    check(
        "周五 → 周六：非加密标的最新价（行情）不变",
        _nc(sat["quotes"]) == _nc(fri["quotes"]),
        "quotes mismatch",
    )
    check(
        "周五 → 周六：NAV 不变",
        close(sat["NAV"], fri["NAV"]),
        "fri=%r sat=%r" % (fri["NAV"], sat["NAV"]),
    )

    print("Edge Case 休市日持仓不重估")
    pf, ps = positions_of(fri, iid), positions_of(sat, iid)
    check("周五有持仓（前置条件）", pf is not None, "positions=%r" % fri["positions"])
    if pf and ps:
        check(
            "marketValue 不变（%r → %r）" % (pf["marketValue"], ps["marketValue"]),
            close(pf["marketValue"], ps["marketValue"]),
        )
        check(
            "unrealizedPnL 不变（%r → %r）" % (pf["unrealizedPnL"], ps["unrealizedPnL"]),
            close(pf["unrealizedPnL"], ps["unrealizedPnL"]),
        )
    else:
        check("周六持仓条目仍存在", False, "sat positions=%r" % sat["positions"])

    print("§3.1 顶栏当日涨跌幅休市日保持 0")
    check(
        "周六 dayReturnPct == 0",
        close(sat["dayReturnPct"], 0),
        "dayReturnPct=%r" % sat["dayReturnPct"],
    )
    check("周六 dayReturn == 0", close(sat["dayReturn"], 0), "dayReturn=%r" % sat["dayReturn"])

    print("Edge Case 连续休市（周六 + 周日，需点两次）")
    check("周日 dayIndex == 7（连 +2）", sun["dayIndex"] == 7, "dayIndex=%r" % sun["dayIndex"])
    check("周日 inGameDate == 2026-01-11", sun["inGameDate"] == "2026-01-11", sun["inGameDate"])
    check("周日 isMarketOpen == false", sun["isMarketOpen"] is False)
    check("周日 calendarClosedReason == 'weekend'", sun["calendarClosedReason"] == "weekend")
    # 加密是 7×24：周末行情**会**动。逐字比较只对非加密标的成立。
    _CRYPTO = ("BTC", "ETH")
    _non_crypto = lambda q: {k: v for k, v in (q or {}).items() if k not in _CRYPTO}
    check(
        "周六 → 周日：非加密标的行情仍未变（不自动跳过周末）",
        _non_crypto(sun["quotes"]) == _non_crypto(sat["quotes"]),
        "quotes mismatch",
    )
    check(
        "周六 → 周日：加密标的行情**照常波动**（7×24）",
        any(
            (sun["quotes"].get(k) or {}).get("lastPrice") != (sat["quotes"].get(k) or {}).get("lastPrice")
            for k in _CRYPTO
            if k in (sat["quotes"] or {})
        ),
        "crypto frozen",
    )
    check("周日 NAV 不变", close(sun["NAV"], sat["NAV"]), "%r vs %r" % (sun["NAV"], sat["NAV"]))
    check(
        "周日 dayReturnPct == 0",
        close(sun["dayReturnPct"], 0),
        "dayReturnPct=%r" % sun["dayReturnPct"],
    )
    check(
        "第三次推进才到周一 dayIndex == 8",
        mon["dayIndex"] == 8,
        "dayIndex=%r" % mon["dayIndex"],
    )
    check("周一 inGameDate == 2026-01-12", mon["inGameDate"] == "2026-01-12", mon["inGameDate"])
    check("周一 isMarketOpen == true", mon["isMarketOpen"] is True)

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
