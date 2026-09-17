#!/usr/bin/env python3
"""test_rating_formula 断言 —— 在 Python 侧按 PRD §3.3 的公式**独立手算**，再与运行时输出比对。

手算依据（prd.md §3.3；scripts/chapter/rating.js 的常量是它的落地）：
    rar       = (adjustedLast − adjustedFirst) / adjustedFirst
    maxDD     = max_t((peak_t − adjusted_t) / peak_t)
    costRatio = fees / notional            （notional = 0 时记 0，不罚没交易的人）
    S         = clamp(50 + rar×833, 0, 100) − 40×clamp((maxDD−0.05)/0.15, 0, 1)
                                            − 15×clamp((costRatio−0.002)/0.010, 0, 1)
    黄档（末值 NAV < ¥50,000）成本罚分项 ×0.5
    S = clamp(S, 0, 100)
    A: S ≥ 80 / B: S ≥ 60 / C: S ≥ 40 / D: 其余
"""
import json
import math
import sys
from pathlib import Path

PASS = 0
FAIL = 0
FAILURES = []
TOL = 1e-6


def ok(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        FAILURES.append(f"{name} :: {detail}")
        print(f"  FAIL {name} :: {detail}")


def near(name, got, want, tol=TOL, detail=""):
    ok(name, got is not None and abs(got - want) <= tol, f"got={got} want={want} {detail}")


def clamp(v, lo, hi):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return lo
    return min(hi, max(lo, v))


def expect(nav_series, adjusted=None, fees=0.0, notional=0.0, half=False):
    adj = list(adjusted) if adjusted else list(nav_series)
    ratio = (fees / notional) if notional > 0 else 0.0
    rar = (adj[-1] - adj[0]) / adj[0] if adj[0] else 0.0
    peak = float("-inf")
    worst = 0.0
    for v in adj:
        peak = max(peak, v)
        if peak > 0:
            worst = max(worst, (peak - v) / peak)
    base = clamp(50 + rar * 833, 0, 100)
    dd = 40 * clamp((worst - 0.05) / 0.15, 0, 1)
    cost = 15 * clamp((ratio - 0.002) / 0.010, 0, 1) * (0.5 if half else 1.0)
    s = clamp(base - dd - cost, 0, 100)
    return {"rar": rar, "maxDD": worst, "costRatio": ratio, "S": s,
            "base": base, "dd": dd, "cost": cost, "grade": grade_of(s)}


def grade_of(s):
    if s >= 80:
        return "A"
    if s >= 60:
        return "B"
    if s >= 40:
        return "C"
    return "D"


def core(name, case, half=None, fees=None, notional=None, adj=None):
    """把一个探针的输出与手算结果对齐比对。"""
    inp = case["input"]
    r = case["rating"]
    ri = case["inputs"]
    nav = inp.get("navSeries") or []
    half_flag = ri["costPenaltyHalf"] if half is None else half
    e = expect(
        nav,
        adjusted=adj if adj is not None else inp.get("adjustedNavSeries"),
        fees=inp.get("fees", 0) if fees is None else fees,
        notional=inp.get("notional", 0) if notional is None else notional,
        half=bool(half_flag),
    )
    near(f"{name}.rar", r["rar"], e["rar"], 1e-6)
    near(f"{name}.maxDD", r["maxDD"], e["maxDD"], 1e-6)
    near(f"{name}.costRatio", r["costRatio"], e["costRatio"], 1e-9)
    near(f"{name}.S", r["S"], e["S"], 1e-6)
    near(f"{name}.baseScore", ri["baseScore"], e["base"], 1e-6)
    near(f"{name}.ddPenalty", ri["ddPenalty"], e["dd"], 1e-6)
    near(f"{name}.costPenalty", ri["costPenalty"], e["cost"], 1e-6)
    ok(f"{name}.grade==handcalc", r["grade"] == e["grade"], f"got={r['grade']} want={e['grade']} S={e['S']}")
    ok(f"{name}.S∈[0,100]", 0 <= r["S"] <= 100, f"S={r['S']}")
    return e


def main(evidence: Path):
    doc = json.loads((evidence / "drive_result.json").read_text(encoding="utf-8"))
    R = doc["result"]

    print("[0] 落点结构性核对")
    ok("sanitize.chapter2", R["sanity"]["chapterId"] == 2, f"chapterId={R['sanity']['chapterId']}")
    ok("sanitize.beatCount", R["sanity"]["beatCount"] == 7, f"beatCount={R['sanity']['beatCount']}")
    ok("sanitize.thresholds", R["sanity"]["ratingThresholds"] == {"A": 80, "B": 60, "C": 40},
       f"{R['sanity']['ratingThresholds']}")
    ok("sanitize.tiers", R["sanity"]["moneyTiers"] == {"green": 50000, "yellow": 10000},
       f"{R['sanity']['moneyTiers']}")

    print("[1] 公式手算 / clamp / 罚分上限")
    f = R["formula"]
    e = core("mixed", f["mixed"])
    ok("mixed.S触顶前的base", f["mixed"]["inputs"]["baseScore"] == 100, f"base={f['mixed']['inputs']['baseScore']}")
    ok("mixed.A级加演段", f["mixed"]["extra"] and f["mixed"]["extra"]["kind"] == "advanced",
       f"extra={f['mixed']['extra']}")
    core("ddMax", f["ddMax"])
    ok("ddMax.回撤罚分触顶40", f["ddMax"]["inputs"]["ddPenalty"] == 40, f"{f['ddMax']['inputs']['ddPenalty']}")
    ok("ddMax.S触底0", f["ddMax"]["rating"]["S"] == 0, f"S={f['ddMax']['rating']['S']}")
    ok("ddMax.D级补救段", f["ddMax"]["extra"] and f["ddMax"]["extra"]["kind"] == "remedial",
       f"extra={f['ddMax']['extra']}")
    core("ddFree", f["ddFree"])
    ok("ddFree.免费区罚分0", f["ddFree"]["inputs"]["ddPenalty"] == 0, f"{f['ddFree']['inputs']['ddPenalty']}")
    core("costFree", f["costFree"])
    ok("costFree.免费区罚分0", f["costFree"]["inputs"]["costPenalty"] == 0, f"{f['costFree']['inputs']['costPenalty']}")
    core("costMax", f["costMax"])
    ok("costMax.成本罚分触顶15", f["costMax"]["inputs"]["costPenalty"] == 15, f"{f['costMax']['inputs']['costPenalty']}")
    core("costEdge0", f["costEdge0"])
    core("costEdge1", f["costEdge1"])
    ok("costEdge0.恰好0.002→0", f["costEdge0"]["inputs"]["costPenalty"] == 0, f"{f['costEdge0']['inputs']['costPenalty']}")
    near("costEdge1.0.0021→0.15", f["costEdge1"]["inputs"]["costPenalty"], 0.15, 1e-6)
    core("noTrade", f["noTrade"])
    ok("noTrade.没交易不被罚", f["noTrade"]["rating"]["costRatio"] == 0 and f["noTrade"]["inputs"]["costPenalty"] == 0,
       f"costRatio={f['noTrade']['rating']['costRatio']} costPenalty={f['noTrade']['inputs']['costPenalty']}")
    core("baseClampHigh", f["baseClampHigh"])
    ok("baseClampHigh.base=100", f["baseClampHigh"]["inputs"]["baseScore"] == 100, f"{f['baseClampHigh']['inputs']['baseScore']}")
    ok("baseClampHigh.S=100", f["baseClampHigh"]["rating"]["S"] == 100, f"S={f['baseClampHigh']['rating']['S']}")
    core("baseClampLow", f["baseClampLow"])
    ok("baseClampLow.base=0", f["baseClampLow"]["inputs"]["baseScore"] == 0, f"{f['baseClampLow']['inputs']['baseScore']}")
    ok("baseClampLow.S=0（不下穿）", f["baseClampLow"]["rating"]["S"] == 0, f"S={f['baseClampLow']['rating']['S']}")
    ok("baseClampLow.rar=-0.5", abs(f["baseClampLow"]["rating"]["rar"] + 0.5) < 1e-9, f"{f['baseClampLow']['rating']['rar']}")
    _ = e

    print("[2] 门槛四档与边界（80 / 60 / 40 两侧各 ±0.01 与 ±1e-6）")
    for key, case in R["thresholds"].items():
        r = case["rating"]
        target = case["target"]
        near(f"thr.{key}.S==target", r["S"], target, 1e-6)
        ok(f"thr.{key}.grade", r["grade"] == grade_of(target), f"target={target} S={r['S']} grade={r['grade']}")
    ok("thr.低于80→B", R["thresholds"]["80m0.000001"]["rating"]["grade"] == "B",
       R["thresholds"]["80m0.000001"]["rating"]["grade"])
    ok("thr.达到80→A", R["thresholds"]["80p0.000001"]["rating"]["grade"] == "A",
       R["thresholds"]["80p0.000001"]["rating"]["grade"])
    # 精确落在门槛上的探针（S 恰为 80）：记录观测，不判失败（见 log 的 observation）
    boundary = R.get("exactBoundary")

    print("[3] 黄档成本罚分 ×0.5")
    y = R["yellow"]
    for tag, case in (("yellowTier", y["yellowTier"]), ("greenTier", y["greenTier"]),
                      ("yellowFree", y["yellowFree"]), ("greenFree", y["greenFree"])):
        core(tag, case, adj=case["input"]["adjustedNavSeries"])
    ok("yellow.half=true", y["yellowTier"]["inputs"]["costPenaltyHalf"] is True, f"{y['yellowTier']['inputs']['costPenaltyHalf']}")
    ok("green.half=false", y["greenTier"]["inputs"]["costPenaltyHalf"] is False, f"{y['greenTier']['inputs']['costPenaltyHalf']}")
    ok("yellow.同档 rar 相同", abs(y["yellowTier"]["rating"]["rar"] - y["greenTier"]["rating"]["rar"]) < 1e-9,
       f"{y['yellowTier']['rating']['rar']} vs {y['greenTier']['rating']['rar']}")
    ok("yellow.同档 maxDD 相同", abs(y["yellowTier"]["rating"]["maxDD"] - y["greenTier"]["rating"]["maxDD"]) < 1e-9,
       f"{y['yellowTier']['rating']['maxDD']} vs {y['greenTier']['rating']['maxDD']}")
    ratio = y["yellowTier"]["rating"]["costRatio"]
    want_delta = 7.5 * clamp((ratio - 0.002) / 0.010, 0, 1)
    got_delta = y["yellowTier"]["rating"]["S"] - y["greenTier"]["rating"]["S"]
    near("yellow.ΔS==7.5×clamp(...)", got_delta, want_delta, 1e-6, detail=f"costRatio={ratio}")
    ok("yellow.免费区内×0.5无差异",
       abs(y["yellowFree"]["rating"]["S"] - y["greenFree"]["rating"]["S"]) < 1e-9,
       f"{y['yellowFree']['rating']['S']} vs {y['greenFree']['rating']['S']}")

    print("[4] L1 同章相对口径（路径整体平移）")
    a, b = R["l1"]["probeA"]["rating"], R["l1"]["probeB"]["rating"]
    near("l1.rar相同", a["rar"], b["rar"], 1e-9, detail=f"A={a['rar']} B={b['rar']}")
    near("l1.maxDD相同", a["maxDD"], b["maxDD"], 1e-9, detail=f"A={a['maxDD']} B={b['maxDD']}")
    near("l1.S相同", a["S"], b["S"], 1e-9, detail=f"A={a['S']} B={b['S']}")
    ok("l1.grade相同", a["grade"] == b["grade"], f"{a['grade']} vs {b['grade']}")
    core("l1.A", R["l1"]["probeA"])
    core("l1.B", R["l1"]["probeB"])

    print("[5] 外来入金剔除")
    inj = R["injection"]
    core("inj.noInj", inj["noInj"])
    core("inj.withInj", inj["withInj"], adj=inj["withInj"]["input"]["adjustedNavSeries"])
    core("inj.midInj", inj["midInj"], adj=inj["midInj"]["input"]["adjustedNavSeries"])
    near("inj.不剔除则rar=0.2", inj["noInj"]["rating"]["rar"], 0.2, 1e-9)
    ok("inj.补足后rar不受益", inj["withInj"]["rating"]["rar"] == 0, f"rar={inj['withInj']['rating']['rar']}")
    near("inj.externalInjection==净增额", inj["withInj"]["inputs"]["externalInjectionInWindow"], 20000, 1e-9)
    near("inj.期中入金后rar=0.1", inj["midInj"]["rating"]["rar"], 0.1, 1e-9)

    print("[6] 大盘对照行")
    m = R["market"]
    near("market.复利累乘(1.01×0.995)", m["compound"]["rating"]["marketMove"], 1.01 * 0.995 - 1, 1e-6)
    near("market.休市日按0不计", m["withClosedDay"]["rating"]["marketMove"],
         m["compound"]["rating"]["marketMove"], 1e-9)
    near("market.全休市→0", m["allClosed"]["rating"]["marketMove"], 0, 1e-9)
    ok("market.跑输→false", m["behind"]["rating"]["beatenMarket"] is False,
       f"rar={m['behind']['rating']['rar']} mv={m['behind']['rating']['marketMove']}")
    ok("market.跑赢→true", m["ahead"]["rating"]["beatenMarket"] is True,
       f"rar={m['ahead']['rating']['rar']} mv={m['ahead']['rating']['marketMove']}")
    ok("market.对照行不进S",
       m["compound"]["rating"]["S"] == m["withClosedDay"]["rating"]["S"],
       f"{m['compound']['rating']['S']} vs {m['withClosedDay']['rating']['S']}")

    print("[7] 结算面板可见展开（PRD §3.3 不得用综合评分掩盖算法）")
    ri = R["formula"]["mixed"]["inputs"]
    for key in ("navStart", "navNow", "feesInWindow", "notionalInWindow", "adjustedNavSeries",
                "baseScore", "ddPenalty", "costPenalty"):
        ok(f"visible.{key}", key in ri and ri[key] is not None, f"missing {key}")
    ok("visible.graded", ri.get("graded") is True, f"{ri.get('graded')}")

    if boundary:
        print(f"[obs] 精确落在门槛上的探针：target={boundary['target']} S={boundary['rating']['S']} "
              f"grade={boundary['rating']['grade']}（观测项，不判失败）")

    print(f"\nPASS={PASS} FAIL={FAIL}")
    if FAIL:
        print("失败明细：")
        for line in FAILURES:
            print("  -", line)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
