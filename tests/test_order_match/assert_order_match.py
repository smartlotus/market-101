#!/usr/bin/env python3
"""断言：限价撮合的价格改善（PRD §3.4）—— 成交价不差于限价。

买限价 ≥ 最新价 → 成交价 = min(限价, 最新价) = 最新价
卖限价 ≤ 最新价 → 成交价 = min(限价, 最新价) = 限价

用法： assert_order_match.py <drive.json>
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

    print("§3.4 限价买入：限价 ≥ 最新价 → fillPrice = lastPrice")
    buy = d["buy"]
    bo = buy["order"]
    check(
        "前置：限价（涨停价 %.2f）≥ 最新价 %.2f" % (buy["limitPrice"], buy["lastPrice"]),
        float(buy["limitPrice"]) >= float(buy["lastPrice"]),
    )
    check("委托被接受且成交", bo["accepted"] is True and bo["status"] == "filled", repr(bo))
    check(
        "fillPrice == min(限价, 最新价) == 最新价 %.2f（价格改善，成交价不差于限价）" % buy["lastPrice"],
        abs(float(bo["fillPrice"]) - float(buy["lastPrice"])) < 1e-9,
        "fillPrice=%r lastPrice=%r" % (bo["fillPrice"], buy["lastPrice"]),
    )
    check(
        "fillPrice <= 限价（成交价不差于限价）",
        float(bo["fillPrice"]) <= float(buy["limitPrice"]) + 1e-9,
        "fillPrice=%r limit=%r" % (bo["fillPrice"], buy["limitPrice"]),
    )

    print("§3.4 限价卖出：限价 ≤ 最新价 → fillPrice = limit（= min）")
    sell = d["sell"]
    so = sell["order"]
    check("前置：次日可卖持仓已解禁（T+1）", d["sellState"]["positions"][0]["lockedQty"] == 0,
          "lockedQty=%r" % d["sellState"]["positions"][0]["lockedQty"])
    check(
        "前置：限价（跌停价 %.2f）≤ 最新价 %.2f" % (sell["limitPrice"], sell["lastPrice"]),
        float(sell["limitPrice"]) <= float(sell["lastPrice"]),
    )
    check("卖出委托被接受且成交", so["accepted"] is True and so["status"] == "filled", repr(so))
    check(
        "fillPrice == min(限价, 最新价) == 限价 %.2f（价格改善取对手价）" % sell["limitPrice"],
        abs(float(so["fillPrice"]) - float(sell["limitPrice"])) < 1e-9,
        "fillPrice=%r limit=%r lastPrice=%r" % (so["fillPrice"], sell["limitPrice"], sell["lastPrice"]),
    )
    check(
        "fillPrice >= 限价（成交价不差于限价）",
        float(so["fillPrice"]) >= float(sell["limitPrice"]) - 1e-9,
        "fillPrice=%r limit=%r" % (so["fillPrice"], sell["limitPrice"]),
    )
    check(
        "限价单成交价 == 最新价或限价（二者取优），非其他值",
        abs(float(so["fillPrice"]) - float(sell["lastPrice"])) < 1e-9
        or abs(float(so["fillPrice"]) - float(sell["limitPrice"])) < 1e-9,
    )
    check(
        "卖出后持仓归零（不留 qty=0 空条目）",
        d["afterSell"]["positions"] == [],
        "positions=%r" % d["afterSell"]["positions"],
    )

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
