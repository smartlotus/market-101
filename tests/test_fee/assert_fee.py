#!/usr/bin/env python3
"""断言：A 股费用（PRD §3.4）—— 买入费公式 + cash 扣减，卖出费公式 + cash 入账。

买入：fee = max(notional × 0.00025, 5) + notional × 0.00001
卖出：fee = max(notional × 0.00025, 5) + notional × 0.0005 + notional × 0.00001
（notional = 成交价 × 数量；印花税仅卖出收取；总费用四舍五入到 ¥0.01）

用法： assert_fee.py <drive.json>
退出码：0 = 全部通过；1 = 至少一条断言失败。
"""
import json
import sys

COMMISSION_RATE = 0.00025
COMMISSION_MIN = 5.0
TRANSFER_RATE = 0.00001
STAMP_RATE = 0.0005
SLIPPAGE = 0.001

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


def round_money(v):
    cents = float(v) * 100.0
    r = round(cents + (1e-6 if cents >= 0 else -1e-6)) / 100.0
    return 0.0 if r == 0 else r


def buy_fee(notional):
    return round_money(max(notional * COMMISSION_RATE, COMMISSION_MIN) + notional * TRANSFER_RATE)


def sell_fee(notional):
    return round_money(
        max(notional * COMMISSION_RATE, COMMISSION_MIN)
        + notional * STAMP_RATE
        + notional * TRANSFER_RATE
    )


def load(path):
    raw = json.load(open(path, encoding="utf-8"))
    return raw["result"] if "result" in raw else raw


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    print("§3.4 市价买入费用（1 手工行）")
    o = d["buyOrder"]
    c = d["buyContext"]
    check("委托被接受且成交", o["accepted"] is True and o["status"] == "filled", repr(o))
    expected_fill = round_money(c["lastPrice"] * (1 + SLIPPAGE))
    check(
        "市价买入 fillPrice == lastPrice×(1+0.1%%) = %.2f" % expected_fill,
        abs(float(o["fillPrice"]) - expected_fill) < 1e-9,
        "fillPrice=%r" % o["fillPrice"],
    )
    check("qty == 100", o["qty"] == 100, "qty=%r" % o["qty"])
    expected_notional = round_money(float(o["fillPrice"]) * 100)
    check(
        "notional == round(fillPrice × 100, 0.01) = %.2f" % expected_notional,
        abs(float(o["notional"]) - expected_notional) < 1e-9,
        "notional=%r" % o["notional"],
    )
    expected_fee = buy_fee(expected_notional)
    check(
        "fee == max(notional×0.00025, 5) + notional×0.00001 = %.2f" % expected_fee,
        abs(float(o["fee"]) - expected_fee) < 1e-9,
        "fee=%r 期望=%r" % (o["fee"], expected_fee),
    )
    after = d["afterBuy"]
    check(
        "cash 减 notional + fee（%.2f → %.2f）" % (c["cashBefore"], after["cash"]),
        abs(float(after["cash"]) - round_money(c["cashBefore"] - expected_notional - expected_fee)) < 1e-9,
        "cash=%r" % after["cash"],
    )
    # 市价单的 NAV 差 = −(滑点×数量 + fee)，与限价单的 ΔNAV = −fee 区分（PRD §3.4 滑点）
    slip_cost = round_money((expected_fill - c["lastPrice"]) * 100)
    check(
        "市价单 ΔNAV == −(滑点成本 + fee) = %.2f" % (-(slip_cost + expected_fee)),
        abs(round(float(after["NAV"]) - float(c["navBefore"]), 2) - (-(slip_cost + expected_fee))) < 1e-9,
        "ΔNAV=%r" % round(float(after["NAV"]) - float(c["navBefore"]), 2),
    )

    print("§3.4 市价卖出费用（印花税仅卖出收取）")
    so = d["sellOrder"]
    sc = d["sellContext"]
    check("卖出委托被接受且成交", so["accepted"] is True and so["status"] == "filled", repr(so))
    expected_sell_fill = round_money(sc["lastPrice"] * (1 - SLIPPAGE))
    check(
        "市价卖出 fillPrice == lastPrice×(1−0.1%%) = %.2f" % expected_sell_fill,
        abs(float(so["fillPrice"]) - expected_sell_fill) < 1e-9,
        "fillPrice=%r" % so["fillPrice"],
    )
    expected_sell_notional = round_money(float(so["fillPrice"]) * 100)
    expected_sell_fee = sell_fee(expected_sell_notional)
    check(
        "卖出 fee == max(n×0.00025,5) + n×0.0005 + n×0.00001 = %.2f" % expected_sell_fee,
        abs(float(so["fee"]) - expected_sell_fee) < 1e-9,
        "fee=%r 期望=%r" % (so["fee"], expected_sell_fee),
    )
    check(
        "卖出 fee > 同额买入 fee（印花税确实只在卖出侧收）",
        expected_sell_fee > buy_fee(expected_sell_notional),
        "sell=%r buy=%r" % (expected_sell_fee, buy_fee(expected_sell_notional)),
    )
    sell_after = d["afterSell"]
    check(
        "cash 加 (notional − fee)（%.2f → %.2f）" % (sc["cashBefore"], sell_after["cash"]),
        abs(float(sell_after["cash"]) - round_money(sc["cashBefore"] + expected_sell_notional - expected_sell_fee)) < 1e-9,
        "cash=%r" % sell_after["cash"],
    )
    expected_realized = round_money(
        sc["realizedBefore"] + (expected_sell_fill - sc["avgCost"]) * 100 - expected_sell_fee
    )
    check(
        "realizedPnL == 原值 + (fillPrice−avgCost)×Q − fee = %.2f" % expected_realized,
        abs(float(sell_after["realizedPnL"]) - expected_realized) < 1e-9,
        "realized=%r 期望=%r" % (sell_after["realizedPnL"], expected_realized),
    )

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
