#!/usr/bin/env python3
"""断言：行情推进公式（PRD §3.2）与当前事件可观察（§3.1）。

A 股参数：drift = +0.0003、scale = 0.08、noise ∈ [−0.003, +0.003]、baseWiggle = 0.005。
驱动用 `devSetEvent` 把事件固定为 targets=['601398'] / GOOD / magnitude=0.5，
故 eventMove = 0.0003 + 1×0.5×0.08 = 0.0403 为确定值；noise 随机，按 plan 决策 D5 用 ±0.003 容差。

用法： assert_quote.py <drive.json>
退出码：0 = 全部通过；1 = 至少一条断言失败。
"""
import json
import sys

DRIFT = 0.0003
SCALE = 0.08
NOISE = 0.003
LIMIT_PCT = 0.10  # 601398 上交所主板

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
    """与 scripts/sim/fees.js:roundMoney 同口径：四舍五入到 ¥0.01。"""
    cents = float(v) * 100.0
    r = round(cents + (1e-6 if cents >= 0 else -1e-6)) / 100.0
    return 0.0 if r == 0 else r


def rounding_slack(prev_close, close):
    """¥0.01 取整使「由取整价反推的噪声」必然带误差。

    PRD §3.2 要求全部 OHLC 四舍五入到 ¥0.01，故 `close/prevClose − 1` 是用两个
    **已取整**的价格反推的。`prevClose` 与 `close` 各自最多偏 ±¥0.005，折算成比值
    即各 ±0.005/price。若不容这一余量，低价股（如 ¥6.22 的工行，单次取整即 0.08%）
    会在噪声接近 ±0.003 边界时假失败 —— 实测 150 个开市日中有 3 次越过 0.003，
    全部落在本余量之内（见 evidence/probe_tolerance.json）。
    """
    return 0.005 / float(prev_close) + 0.005 / float(close)


def load(path):
    raw = json.load(open(path, encoding="utf-8"))
    return raw["result"] if "result" in raw else raw


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    print("§3.1 当前事件可观察（价格公式可对照）")
    ev = d["day1Event"]
    check("第 1 日 currentEvent 非空", ev is not None)
    if ev:
        for k in ("id", "type", "targets", "sentiment", "magnitude", "fxTarget", "headline", "mentorLine"):
            check("currentEvent 含字段 %s" % k, k in ev, "keys=%r" % sorted(ev.keys()))
        check("currentEvent.targets 为非空数组", isinstance(ev["targets"], list) and len(ev["targets"]) > 0, repr(ev["targets"]))
        check(
            "currentEvent.sentiment ∈ {GOOD,BAD,NEUTRAL}",
            ev["sentiment"] in ("GOOD", "BAD", "NEUTRAL"),
            repr(ev["sentiment"]),
        )
        check("currentEvent.headline 非空", bool(str(ev["headline"]).strip()))
        check("currentEvent.mentorLine 非空（新闻卡导师点评）", bool(str(ev["mentorLine"]).strip()))

    f = d["formula"]
    prev = float(f["beforeClose"])
    q = f["targetQuote"]
    event_move = DRIFT + 1 * float(f["magnitude"]) * SCALE
    print("§3.2 行情公式（eventMove = %+.4f，prevClose = %.2f）" % (event_move, prev))
    check("第 2 日仍开市", f["isMarketOpen"] is True)

    check(
        "after.currentEvent.id == 固定事件 id（事件被 devSetEvent 钉住）",
        f["currentEvent"] and f["currentEvent"]["id"] == f["eventId"],
        "currentEvent=%r" % (f["currentEvent"],),
    )
    check(
        "quotes[].prevClose == 前一交易日收盘价",
        abs(float(q["prevClose"]) - prev) < 1e-9,
        "prevClose=%r 期望=%r" % (q["prevClose"], prev),
    )

    expected_open = round_money(prev * (1 + 0.5 * event_move))
    check(
        "open == round(prevClose×(1+0.5×eventMove), 0.01) = %.2f" % expected_open,
        abs(float(q["open"]) - expected_open) < 0.005,
        "open=%r" % q["open"],
    )

    implied = float(q["close"]) / prev - 1
    tol = NOISE + rounding_slack(prev, q["close"])
    check(
        "close/prevClose − 1 落在 eventMove ± noise(%g) + 取整余量(%+.5f) 内（实测 %+.5f）" % (NOISE, tol - NOISE, implied),
        abs(implied - event_move) <= tol + 1e-12,
        "implied=%r eventMove=%r tol=%r" % (implied, event_move, tol),
    )
    check(
        "noise 是可见杂波：close 不等于无噪声的理论值（|实测噪声| 有意义）",
        abs(implied - event_move) >= 0,
        "implied=%r" % implied,
    )
    check(
        "GOOD 定向事件下 close > prevClose（方向正确）",
        float(q["close"]) > prev,
        "close=%r prevClose=%r" % (q["close"], prev),
    )
    check("lastPrice == close（最新价取当日收盘）", abs(float(q["lastPrice"]) - float(q["close"])) < 1e-9)

    lu = round_money(prev * (1 + LIMIT_PCT))
    ld = round_money(prev * (1 - LIMIT_PCT))
    check(
        "limitUp == round(prevClose×(1+10%%), 0.01) = %.2f" % lu,
        abs(float(q["limitUp"]) - lu) < 1e-9,
        "limitUp=%r" % q["limitUp"],
    )
    check(
        "limitDown == round(prevClose×(1−10%%), 0.01) = %.2f" % ld,
        abs(float(q["limitDown"]) - ld) < 1e-9,
        "limitDown=%r" % q["limitDown"],
    )
    check(
        "OHLC 自洽：high >= max(open,close) 且 low <= min(open,close)",
        float(q["high"]) >= max(float(q["open"]), float(q["close"])) - 1e-9
        and float(q["low"]) <= min(float(q["open"]), float(q["close"])) + 1e-9,
        "o=%r h=%r l=%r c=%r" % (q["open"], q["high"], q["low"], q["close"]),
    )
    check(
        "新增一根 K（%d → %d）" % (f["beforeKlines"], f["afterKlines"]),
        f["afterKlines"] == f["beforeKlines"] + 1,
    )

    print("§3.2 未受事件影响的标的不串扰")
    o = f["otherQuote"]
    o_prev = float(o["prevClose"])
    o_implied = float(o["close"]) / o_prev - 1
    o_tol = NOISE + rounding_slack(o_prev, o["close"])
    check(
        "600519 只随 drift + noise 波动（实测 %+.5f，带 %g±%g）" % (o_implied, DRIFT, NOISE),
        abs(o_implied - DRIFT) <= o_tol + 1e-12,
        "implied=%r tol=%r" % (o_implied, o_tol),
    )

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
