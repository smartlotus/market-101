#!/usr/bin/env python3
"""断言：事件池抽签与洗牌循环（PRD §3.3 / plan 修正后的行文）。

开局 `reset()`/`_enterDay()` 已为第 1 交易日抽掉 1 件（`drawnThisCycle === 1`），
故 19 次 `devDrawEvent()` 恰好用尽本轮 20 件；第 20 次触发洗牌开启第 2 轮。

用法： assert_event_deck.py <drive.json>
退出码：0 = 全部通过；1 = 至少一条断言失败。
"""
import json
import os
import sys

TOTAL = 20

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


def load_pool_ids():
    """事件池的权威 id 列表（config/events.json），用于确认本轮真的覆盖全池。"""
    here = os.path.dirname(os.path.abspath(__file__))
    cfg = os.path.join(here, "..", "..", "config", "events.json")
    with open(cfg, encoding="utf-8") as fh:
        doc = json.load(fh)
    return [e["id"] for e in doc["events"]]


def main():
    d = load(sys.argv[1])
    if d.get("fatal"):
        print("  FAIL  drive.js 抛出异常: %s" % d["fatal"])
        return 1

    print("§3.3 开机状态：第 1 交易日已抽 1 件")
    r = d["deckAfterReset"]
    check("eventDeck.total == 20", r["total"] == TOTAL, "total=%r" % r["total"])
    check("eventDeck.cycle == 1", r["cycle"] == 1, "cycle=%r" % r["cycle"])
    check(
        "eventDeck.drawnThisCycle == 1（开机已抽当日事件）",
        r["drawnThisCycle"] == 1,
        "drawnThisCycle=%r" % r["drawnThisCycle"],
    )
    check("usedIds 长度 == 1", len(r["usedIds"]) == 1, "usedIds=%r" % r["usedIds"])

    print("§3.3 再连续 devDrawEvent() 19 次 → 本轮用尽")
    after19 = d["deckAfter19"]
    ids19 = d["idsAfter19"]
    check("19 次调用返回 19 个 id", len(ids19) == 19, "len=%r" % len(ids19))
    check(
        "usedIds 长度 == 20（本轮 20 件全部用过）",
        len(after19["usedIds"]) == TOTAL,
        "usedIds=%r" % after19["usedIds"],
    )
    check(
        "usedIds 为 20 个互异 id（同一轮内不重复）",
        len(set(after19["usedIds"])) == TOTAL,
        "usedIds=%r" % after19["usedIds"],
    )
    pool = load_pool_ids()
    check(
        "usedIds 与 config/events.json 的 20 个 id 完全一致（本轮确实覆盖全池）",
        set(after19["usedIds"]) == set(pool),
        "usedIds=%r pool=%r" % (sorted(after19["usedIds"]), sorted(pool)),
    )
    check(
        "19 次抽到的 id 两两互异（本轮内不重复）",
        len(set(ids19)) == len(ids19),
        "ids19=%r" % ids19,
    )
    check("cycle 仍为 1（本轮未结束）", after19["cycle"] == 1, "cycle=%r" % after19["cycle"])
    check(
        "drawnThisCycle == 20",
        after19["drawnThisCycle"] == TOTAL,
        "drawnThisCycle=%r" % after19["drawnThisCycle"],
    )

    print("§3.3 第 20 次抽签：池空 → 洗牌开启第 2 轮")
    after20 = d["deckAfter20"]
    check("cycle == 2", after20["cycle"] == 2, "cycle=%r" % after20["cycle"])
    check(
        "usedIds 长度回到 1（洗牌归零后计入本次抽签）",
        len(after20["usedIds"]) == 1,
        "usedIds=%r" % after20["usedIds"],
    )
    check(
        "drawnThisCycle == 1（不是 0 —— 洗牌清零后再计入本次抽签）",
        after20["drawnThisCycle"] == 1,
        "drawnThisCycle=%r" % after20["drawnThisCycle"],
    )
    check(
        "第 20 次抽到的事件 id 属于事件池（允许与上一轮重复）",
        d["twentieth"]["id"] in after19["usedIds"],
        "id=%r" % d["twentieth"]["id"],
    )
    check(
        "第 20 次抽到的事件带完整公开字段（headline / targets）",
        bool(str(d["twentieth"]["headline"]).strip()) and isinstance(d["twentieth"]["targets"], list),
        "twentieth=%r" % d["twentieth"],
    )

    print("§3.3 第 2 轮继续抽签")
    after21 = d["deckAfter21"]
    check("cycle 仍为 2", after21["cycle"] == 2, "cycle=%r" % after21["cycle"])
    check("usedIds 长度 == 2", len(after21["usedIds"]) == 2, "usedIds=%r" % after21["usedIds"])
    check(
        "第 2 轮内不重复（usedIds 两个互异）",
        len(set(after21["usedIds"])) == 2,
        "usedIds=%r" % after21["usedIds"],
    )
    check(
        "第 2 轮第 2 件与第 1 件不同",
        d["twentyFirst"]["id"] != d["twentieth"]["id"],
        "ids=%r" % [d["twentieth"]["id"], d["twentyFirst"]["id"]],
    )

    print("\n%d 项断言，%d 项失败" % (CHECKS, len(FAILS)))
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
