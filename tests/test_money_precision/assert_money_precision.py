#!/usr/bin/env python3
"""断言：所有货币金额落点都是 ¥0.01 的整数倍（PRD Edge Case「数值精度」）。

检查面：cash / frozenCash / NAV / realizedPnL / dayReturn / unrealizedPnL /
marketValue / feesPaid / navHistory[] / positions[].{avgCost,marketValue,unrealizedPnL} /
quotes[].{lastPrice,prevClose,open,high,low,close,changeAbs,limitUp,limitDown} /
lastOrder.{fee,fillPrice,notional}。

判定标准：`abs(x × 100 − round(x × 100)) < 1e-9`，即不存在 0.30000000000000004 类浮点尾数。
同时统计检查过的数值个数，防止「一条都没查」造成的假通过。

用法： assert_money_precision.py <drive.json>
退出码：0 = 全部通过；1 = 至少一条断言失败。
"""
import json
import sys

FAILS = []
CHECKS = 0
SCANNED = [0]
MAX_REPORTED = 8


def check(label, cond, detail=""):
    global CHECKS
    CHECKS += 1
    if cond:
        print("  PASS  %s" % label)
    else:
        print("  FAIL  %s%s" % (label, ("  <- " + detail) if detail else ""))
        FAILS.append(label)


def aligned(value):
    """是否为 ¥0.01 的整数倍（与 scripts/sim/fees.js:isPriceTickAligned 同口径）。

    `None` = 该字段对本标的不适用：港股/美股/加密**没有涨跌停**，`limitUp/limitDown`
    合法为 null。这不是精度问题，跳过即可（否则 float(None) 会直接崩）。
    """
    if value is None:
        return True
    n = float(value)
    return abs(n * 100.0 - round(n * 100.0)) < 1e-9


def scan(label, value, bad):
    SCANNED[0] += 1
    if not aligned(value):
        bad.append("%s = %r" % (label, value))


def load(path):
    raw = json.load(open(path, encoding="utf-8"))
    return raw["result"] if "result" in raw else raw


STATE_SCALARS = (
    "cash",
    "frozenCash",
    "NAV",
    "realizedPnL",
    "dayReturn",
    "unrealizedPnL",
    "marketValue",
    "feesPaid",
)
QUOTE_FIELDS = (
    "lastPrice",
    "prevClose",
    "open",
    "high",
    "low",
    "close",
    "changeAbs",
    "limitUp",
    "limitDown",
)
ORDER_FIELDS = ("fee", "notional")


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    states = d["states"]
    orders = d["orders"]
    bad = []

    check("驱动产生的状态快照数量 >= 10（覆盖多轮买卖与结算）", len(states) >= 10, "len=%r" % len(states))
    check("驱动产生的委托数量 >= 6", len(orders) >= 6, "len=%r" % len(orders))

    for si, st in enumerate(states):
        for key in STATE_SCALARS:
            scan("states[%d].%s" % (si, key), st[key], bad)
        for hi, v in enumerate(st["navHistory"]):
            scan("states[%d].navHistory[%d]" % (si, hi), v, bad)
        for p in st["positions"]:
            for key in ("avgCost", "marketValue", "unrealizedPnL"):
                scan("states[%d].positions[%s].%s" % (si, p["instrumentId"], key), p[key], bad)
        for iid, q in st["quotes"].items():
            for key in QUOTE_FIELDS:
                # 只有 A 股 / ETF 用 ¥0.01 价位。基金按净值报价（4 位小数，如 1.5003）、
                # 港股/美股/加密各有各的最小变动价位 —— 它们套 A 股口径必然「非整数倍」。
                if (q.get("market") or "A_SHARE") in ("A_SHARE", "ETF"):
                    scan("states[%d].quotes[%s].%s" % (si, iid, key), q[key], bad)

    for oi, o in enumerate(orders):
        for key in ORDER_FIELDS:
            scan("orders[%d].%s" % (oi, key), o[key], bad)
        if o["fillPrice"] is not None:
            scan("orders[%d].fillPrice" % oi, o["fillPrice"], bad)

    print("§Edge Case 数值精度（扫描 %d 个金额落点）" % SCANNED[0])
    check(
        "全部 %d 个金额落点均为 ¥0.01 整数倍" % SCANNED[0],
        not bad,
        "非整数倍样例: " + " | ".join(bad[:MAX_REPORTED]) + (" …共 %d 项" % len(bad) if len(bad) > MAX_REPORTED else ""),
    )

    print("§Edge Case 非空论证（避免假通过）")
    check(
        "扫描量足够大（> 300 个数值）",
        SCANNED[0] > 300,
        "scanned=%r" % SCANNED[0],
    )
    check(
        "确认确实存在非零金额（realizedPnL 或 fee 非零）",
        any(abs(float(o["fee"])) > 0 for o in orders) or any(abs(float(s["realizedPnL"])) > 0 for s in states),
        "所有金额都是 0，断言无意义",
    )
    check(
        "确认存在角分位非零的金额（不是所有值都恰好是整数元，取整确实被触发）",
        any(round(float(s["NAV"]) * 100) % 100 != 0 for s in states),
        "所有金额的角分位都是 0，检验力下降",
    )
    check(
        "确认出现过冻结资金（frozenCash > 0）路径",
        any(float(s["frozenCash"]) > 0 for s in states),
        "未覆盖挂单冻结路径",
    )
    check(
        "确认出现过非零 realizedPnL（已实现盈亏路径）",
        any(abs(float(s["realizedPnL"])) > 0 for s in states),
        "未覆盖已实现盈亏路径",
    )

    print("\n%d 项断言，%d 项失败（扫描 %d 个金额落点）" % (CHECKS, len(FAILS), SCANNED[0]))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
