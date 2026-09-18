# -*- coding: utf-8 -*-
"""更新三处因新功能而失效的测试假设（改的是测试，不是产品）。

1. test_mode_switch §4：原作「第二章确认后进 freeDay」是因为**第三章当时未实现**；
   第三章落地后，确认第二章应当直接进入第三章。断言随之改为「进第三章」，
   并把「下一章预告」的期望从第三章改为第四章。
2. test_calendar：原作「周六→周日行情不变」在**加密 7×24** 之后只在非加密标的上成立。
   改为只比较非加密标的的行情。
3. test_money_precision：港股/美股/加密**没有涨跌停**，`limitUp/limitDown` 合法为 None；
   原 aligned() 直接 float(None) 崩溃。改为把 None 视为「不适用」跳过。
"""
import io

ROOT = '/c/Users/28389/Desktop/grokpet/games/market-101/'
if not __import__('os').path.isdir(ROOT):
    ROOT = 'C:/Users/28389/Desktop/grokpet/games/market-101/'

# ── 1) test_mode_switch ──────────────────────────────────────────────
p = ROOT + 'tests/test_mode_switch/assert_mode_switch.py'
s = io.open(p, encoding='utf-8').read()
old = '''ok("确认后 mode == 'freeDay'", ce["mode"] == "freeDay", ce["mode"])
ok("确认后 chapterId 仍为 2（第三章未实现，不进入）", ce["chapterId"] == 2, ce["chapterId"])
ok("nextChapter 给出第三章名与预告",
   ce["nextChapter"]["id"] == 3 and ce["nextChapter"]["name"] == "一篮子里的一颗蛋" and
   bool(ce["nextChapter"]["preview"]), ce["nextChapter"])
ok("自由窗口常驻卡可见并显示第三章",
   ce["dom"]["freeWinVisible"] is True and "第 3 章" in (ce["dom"]["freeWinText"] or ""), ce["dom"])'''
new = '''# 第三章已实现：确认第二章后**直接进入第三章**（不再是「停在 freeDay + 预告第三章」）。
ok("确认后进入第三章（chapter 模式）", ce["mode"] == "chapter" and ce["chapterId"] == 3,
   {"mode": ce["mode"], "chapterId": ce["chapterId"]})
ok("第三章目标卡已就位",
   (ce["dom"].get("goalCardText") or "").find("一篮子里的一颗蛋") >= 0, ce["dom"])
ok("nextChapter 指向第四章并给出预告",
   ce["nextChapter"]["id"] == 4 and bool(ce["nextChapter"]["name"]) and
   bool(ce["nextChapter"]["preview"]), ce["nextChapter"])'''
assert old in s, 'mode_switch: 未找到待替换片段'
io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
print('1/3 test_mode_switch 已更新')

# ── 2) test_calendar ────────────────────────────────────────────────
p = ROOT + 'tests/test_calendar/assert_calendar.py'
s = io.open(p, encoding='utf-8').read()
old = '''    check(
        "周六 → 周日：行情仍未变（不自动跳过周末）",
        sun["quotes"] == sat["quotes"],
        "quotes mismatch",
    )'''
new = '''    # 加密是 7×24：周末行情**会**动。逐字比较只对非加密标的成立。
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
    )'''
assert old in s, 'calendar: 未找到待替换片段'
io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
print('2/3 test_calendar 已更新')

# ── 3) test_money_precision ─────────────────────────────────────────
p = ROOT + 'tests/test_money_precision/assert_money_precision.py'
s = io.open(p, encoding='utf-8').read()
old = '''def aligned(value):
    """是否为 ¥0.01 的整数倍（与 scripts/sim/fees.js:isPriceTickAligned 同口径）。"""
    n = float(value)
    return abs(n * 100.0 - round(n * 100.0)) < 1e-9'''
new = '''def aligned(value):
    """是否为 ¥0.01 的整数倍（与 scripts/sim/fees.js:isPriceTickAligned 同口径）。

    `None` = 该字段对本标的不适用：港股/美股/加密**没有涨跌停**，`limitUp/limitDown`
    合法为 null。这不是精度问题，跳过即可（否则 float(None) 会直接崩）。
    """
    if value is None:
        return True
    n = float(value)
    return abs(n * 100.0 - round(n * 100.0)) < 1e-9'''
assert old in s, 'money_precision: 未找到待替换片段'
io.open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
print('3/3 test_money_precision 已更新')
