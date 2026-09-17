#!/usr/bin/env python3
"""断言：每日结算（PRD §3.5）+ 挂单冻结/锁定 Edge Case。

§3.5 六步在 Stage 0 的顺序：行情推进 → 持仓重估 → 解除 T+1 → 挂单撤销 → 净值记录 → 进入次日。

用法： assert_settlement.py <drive.json>
退出码：0 = 全部通过；1 = 至少一条断言失败。
"""
import json
import sys

COMMISSION_RATE = 0.00025
COMMISSION_MIN = 5.0
TRANSFER_RATE = 0.00001

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


def pos(state, iid):
    for p in state["positions"]:
        if p["instrumentId"] == iid:
            return p
    return None


def load(path):
    raw = json.load(open(path, encoding="utf-8"))
    return raw["result"] if "result" in raw else raw


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    print("§3.5 第3步 解除 T+1 锁定")
    after_buy = d["a_afterBuy"]
    after_adv = d["a_afterAdvance"]
    pb, pa = pos(after_buy, "601398"), pos(after_adv, "601398")
    check("买入当日已成交", d["a_buyOrder"]["status"] == "filled", repr(d["a_buyOrder"]))
    check(
        "买入当日 lockedQty == 100（T+1 锁定）",
        pb is not None and pb["lockedQty"] == 100,
        "positions=%r" % after_buy["positions"],
    )
    check(
        "advanceDay 后 lockedQty == 0（结算第 3 步解禁）",
        pa is not None and pa["lockedQty"] == 0,
        "positions=%r" % after_adv["positions"],
    )
    check(
        "次日可卖：advanceDay 后挂限价卖成交",
        d["a_sellOrder"]["accepted"] is True and d["a_sellOrder"]["status"] == "filled",
        repr(d["a_sellOrder"]),
    )

    print("Edge Case 卖出后持仓归零")
    check(
        "卖出全部 qty 后 positions 不再含该 instrumentId（无 qty=0 空条目）",
        d["a_afterSell"]["positions"] == [],
        "positions=%r" % d["a_afterSell"]["positions"],
    )

    print("Edge Case 限价买挂起：冻结资金")
    pend_order = d["b_pendingOrder"]
    ctx = d["b_context"]
    check(
        "买单不触发 → status == 'pending'、accepted == true",
        pend_order["status"] == "pending" and pend_order["accepted"] is True,
        repr(pend_order),
    )
    expected_frozen = round_money(round_money(pend_order["fillPrice"] * 100) + buy_fee(round_money(pend_order["fillPrice"] * 100)))
    check(
        "pendingOrders[0].frozenCash == fillPrice×Q + fee = %.2f" % expected_frozen,
        abs(float(d["b_afterPending"]["pendingOrders"][0]["frozenCash"]) - expected_frozen) < 1e-9,
        "frozenCash=%r" % d["b_afterPending"]["pendingOrders"][0]["frozenCash"],
    )
    check(
        "frozenCash 与挂单冻结额一致",
        abs(float(d["b_afterPending"]["frozenCash"]) - expected_frozen) < 1e-9,
        "frozenCash=%r" % d["b_afterPending"]["frozenCash"],
    )
    check(
        "cash 同步减少该额（%.2f → %.2f）" % (ctx["cashBeforePending"], d["b_afterPending"]["cash"]),
        abs(float(d["b_afterPending"]["cash"]) - round_money(ctx["cashBeforePending"] - expected_frozen)) < 1e-9,
        "cash=%r" % d["b_afterPending"]["cash"],
    )
    check(
        "挂单不改变持仓",
        d["b_afterPending"]["positions"] == [],
        "positions=%r" % d["b_afterPending"]["positions"],
    )
    check(
        "挂单不改变 NAV（冻结只是会计科目间挪动）",
        abs(float(d["b_afterPending"]["NAV"]) - float(d["b_reset"]["NAV"])) < 1e-9,
        "nav=%r" % d["b_afterPending"]["NAV"],
    )

    print("§3.5 第4步 挂单处理（当日有效，跨日自动撤销）")
    after = d["b_afterAdvance"]
    check("advanceDay 后 pendingOrders == []", after["pendingOrders"] == [], "pending=%r" % after["pendingOrders"])
    check("advanceDay 后 frozenCash == 0（全额释放）", abs(float(after["frozenCash"])) < 1e-9, "frozenCash=%r" % after["frozenCash"])
    check(
        "advanceDay 后 cash 恢复到挂单前水平（%.2f）" % ctx["cashBeforePending"],
        abs(float(after["cash"]) - float(ctx["cashBeforePending"])) < 1e-9,
        "cash=%r 期望=%r" % (after["cash"], ctx["cashBeforePending"]),
    )

    print("Edge Case 限价卖挂起：持仓占用")
    c_after = d["c_afterPending"]
    pc = pos(c_after, "601398")
    check(
        "卖单不触发 → status == 'pending'",
        d["c_pendingOrder"]["status"] == "pending",
        repr(d["c_pendingOrder"]),
    )
    check(
        "该持仓 lockedQty == 100（挂单占用）",
        pc is not None and pc["lockedQty"] == 100,
        "positions=%r" % c_after["positions"],
    )
    check(
        "可卖 = qty − lockedQty == 100（占用后减少）",
        pc is not None and (pc["qty"] - pc["lockedQty"]) == 100,
        "qty=%r lockedQty=%r" % (pc["qty"], pc["lockedQty"]),
    )
    check(
        "pendingOrders[0].lockedQty == 100 且 frozenCash == 0（卖单不冻资金）",
        c_after["pendingOrders"][0]["lockedQty"] == 100 and float(c_after["pendingOrders"][0]["frozenCash"]) == 0,
        "pending=%r" % c_after["pendingOrders"],
    )
    check(
        "占用后再卖 200 股被拒（reasonCode == 'REJECT_8'）",
        d["c_secondSell"]["reasonCode"] == "REJECT_8",
        "reasonCode=%r" % d["c_secondSell"]["reasonCode"],
    )

    print("§3.5 第5步 净值记录（navHistory）")
    r = d["d_reset"]
    check("reset() 后 navHistory === [100000]", r["navHistory"] == [100000], "navHistory=%r" % r["navHistory"])
    check("开局 navHistory[0] === 100000", r["navHistory"][0] == 100000, "navHistory=%r" % r["navHistory"])
    b_state = d["d_afterBuy"]
    check(
        "买入后不追加记录（长度仍为 1）",
        len(b_state["navHistory"]) == 1,
        "navHistory=%r" % b_state["navHistory"],
    )
    prev_len = len(b_state["navHistory"])
    for i in range(1, 6):
        st = d["d_advance%d" % i]
        check(
            "第 %d 次 advanceDay 后 navHistory 长度 %d → %d" % (i, prev_len, len(st["navHistory"])),
            len(st["navHistory"]) == prev_len + 1,
            "navHistory=%r" % st["navHistory"],
        )
        check(
            "第 %d 次 advanceDay 后 navHistory 末项 === snapshot().NAV（%.2f）" % (i, st["NAV"]),
            abs(float(st["navHistory"][-1]) - float(st["NAV"])) < 1e-9,
            "last=%r NAV=%r" % (st["navHistory"][-1], st["NAV"]),
        )
        check(
            "第 %d 次记录的金额为 ¥0.01 整数倍" % i,
            abs(float(st["navHistory"][-1]) * 100 - round(float(st["navHistory"][-1]) * 100)) < 1e-6,
            "last=%r" % st["navHistory"][-1],
        )
        prev_len = len(st["navHistory"])
    sat = d["d_advance5"]
    check(
        "第 5 次推进落在休市日（%s，isMarketOpen=%r）—— 休市日同样记一笔" % (sat["inGameDate"], sat["isMarketOpen"]),
        sat["isMarketOpen"] is False and sat["dayIndex"] == 6,
        "dayIndex=%r date=%r" % (sat["dayIndex"], sat["inGameDate"]),
    )
    check(
        "休市日 NAV 未变但仍记一笔（末项 == 前一日末项）",
        abs(float(sat["navHistory"][-1]) - float(d["d_advance4"]["navHistory"][-1])) < 1e-9,
        "sat=%r prev=%r" % (sat["navHistory"][-1], d["d_advance4"]["navHistory"][-1]),
    )
    check(
        "净值序列非退化（至少两个互异值：开局 100000 与买入扣费后的 NAV）",
        len({round(float(v), 2) for v in sat["navHistory"]}) >= 2,
        "navHistory=%r" % sat["navHistory"],
    )
    check(
        "交易成本体现在净值序列里（买入次日的净值 < 100000）",
        float(d["d_advance1"]["navHistory"][-1]) < 100000.0,
        "last=%r" % d["d_advance1"]["navHistory"][-1],
    )
    check(
        "reset() 后 navHistory 复位为 [100000]",
        d["d_afterReset"]["navHistory"] == [100000],
        "navHistory=%r" % d["d_afterReset"]["navHistory"],
    )

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
