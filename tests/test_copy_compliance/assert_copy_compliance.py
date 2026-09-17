#!/usr/bin/env python3
"""test_copy_compliance 断言（读 evidence/drive_result.json）。

三个面（范围严格限定）：
  ① 六词纪律 —— **只扫章末结算面板全文 + A/B/C/D 档位标签**。
     补救 / 加演段正文照录 GDD 的市场描述（含「差」），不在扫描范围内。
  ② 评级公式可见 —— 结算面板把 rar / maxDD / costRatio 与逐步代入值连同 S、档位摊开；
     且存在完整公式查询入口（词典与公式 → 评级公式）。
  ③ 无引导 / 纠正措辞 —— 拒单回执与教学反馈不得含「你不该」「建议按导师指引操作」。

契约：断言失败 → exit 1（运行时保持存活，便于事后 reattach）。
"""
import json
import re
import sys
from pathlib import Path

EVIDENCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "evidence"
raw = json.loads((EVIDENCE / "drive_result.json").read_text(encoding="utf-8"))
R = raw["result"] if isinstance(raw, dict) and "result" in raw else raw

# 六词：只用于结算面板 + 档位标签
FORBIDDEN = ["失败", "不及格", "差", "淘汰", "降级", "扣分"]
# 引导 / 纠正措辞：用于拒单回执 + 教学反馈
STEERING = ["你不该", "建议按导师指引操作"]
GRADES = ["A", "B", "C", "D"]

fails = []
checks = 0


def ok(name, cond, detail=""):
    global checks
    checks += 1
    if not cond:
        fails.append(f"{name}: {detail}")
    print(("  PASS " if cond else "  FAIL ") + name + ("" if cond else "  <- " + str(detail)))


def has(text, needle):
    return isinstance(text, str) and needle in text


def corpus(*values):
    """把一层层的字符串 / 列表 / dict 摊平成一段文本（用于「不得出现」扫描）。"""
    out = []
    for v in values:
        if v is None:
            continue
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, (list, tuple, set)):
            out.append(corpus(*v))
        elif isinstance(v, dict):
            out.append(corpus(*v.values()))
    return "\n".join(out)


# ── 0. 落点 ──────────────────────────────────────────────────────────────────
print("[0] 落点：第二章章末结算面板")
entered = R["entered"]
ok("entered.chapterId == 2", entered["chapterId"] == 2, entered["chapterId"])
ok("entered.beatId == '2.1'", entered["beatId"] == "2.1", entered["beatId"])
ok("entered.settlementPanelId == 'panel.settlement'",
   entered["settlementPanelId"] == "panel.settlement", entered["settlementPanelId"])
spec = R["settlementPanelSpec"]
ok("结算面板声明可读（blocks 非空）", isinstance(spec.get("blocks"), list) and len(spec["blocks"]) > 0, spec)
spec_formula = next((blk for blk in spec.get("blocks", []) if blk["type"] == "formula"), None)
ok("声明里有一个 formula 块", spec_formula is not None, spec.get("blocks"))

# ── 1. 六词纪律：结算面板全文 + 档位标签 ──────────────────────────────────────
print("[1] 六词纪律（扫描面 = 结算面板全文 + A/B/C/D 档位标签）")
for g in GRADES:
    rec = R["grades"][g]
    ok(f"{g}.强制档位生效（rating.grade == '{g}'）", rec["ratingGrade"] == g,
       f"settled={rec['settledGrade']} rating={rec['ratingGrade']}")
    ok(f"{g}.settle 走强制档（forced == True）", rec["forcedFlag"] is True, rec["forcedFlag"])
    ok(f"{g}.评级窗口已结算（graded == True）", rec["graded"] is True, rec["graded"])
    ok(f"{g}.结算面板已打开", rec["panelId"] == "panel.settlement" and "panel.settlement" in rec["openPanels"],
       f"panelId={rec['panelId']} open={rec['openPanels']}")
    ok(f"{g}.结算面板 DOM 文本非空", isinstance(rec["panelText"], str) and len(rec["panelText"]) > 0,
       repr(rec["panelText"])[:80])
    ok(f"{g}.面板内无未解析占位（data-ch-unresolved 为空）", rec["panelUnresolved"] == [], rec["panelUnresolved"])
    ok(f"{g}.档位点评已渲染在面板里", has(rec["panelText"], rec["gradeLine"]), rec["gradeLine"])

panel_by_grade = {g: R["grades"][g]["panelText"] or "" for g in GRADES}
labels_data = R["gradeLabelsData"] or {}
labels_runtime = {g: R["grades"][g]["gradeLabel"] for g in GRADES}
labels_dom = {row["grade"]: row["label"] for row in (R["dictionary"].get("gradeLabelRows") or [])}
label_corpus = corpus(list(labels_data.values()), list(labels_runtime.values()), list(labels_dom.values()))

for w in FORBIDDEN:
    hit = [g for g in GRADES if w in panel_by_grade[g]]
    ok(f"结算面板四档全文都不含「{w}」", hit == [], f"命中档位：{hit}")
for w in FORBIDDEN:
    hit = [g for g in GRADES if any(w in str(src.get(g)) for src in (labels_data, labels_runtime, labels_dom))]
    ok(f"档位标签都不含「{w}」", hit == [],
       f"命中：{hit} | data={labels_data} runtime={labels_runtime} dom={labels_dom}")

ok("D 级档位标签 == 「本章需要再摆一次」", labels_data.get("D") == "本章需要再摆一次", labels_data.get("D"))
ok("D 级档位标签（运行时快照）同字面", labels_runtime.get("D") == "本章需要再摆一次", labels_runtime.get("D"))
ok("D 级档位标签（词典 DOM）同字面", labels_dom.get("D") == "本章需要再摆一次", labels_dom.get("D"))
for g in GRADES:
    ok(f"档位标签 {g} 在词典 GRADES 里逐字渲染", labels_dom.get(g) == labels_data.get(g),
       f"dom={labels_dom.get(g)} data={labels_data.get(g)}")
ok("词典 GRADES 四档齐全", sorted(labels_dom.keys()) == GRADES, sorted(labels_dom.keys()))
ok("labels 扫描面非空（确实扫到了东西）", len(label_corpus.strip()) > 20, len(label_corpus))

# ── 2. 评级公式对玩家可见 ────────────────────────────────────────────────────
print("[2] 评级公式可见（不得用单个「综合评分」掩盖算法）")
expr = (spec_formula or {}).get("expression") or ""
notes = (spec_formula or {}).get("notes") or []
declared_kv = next((blk for blk in spec.get("blocks", []) if blk["type"] == "kvRows"), None)
declared_big = next((blk for blk in spec.get("blocks", []) if blk["type"] == "bigNumber"), None)

ok("结算面板三段输入（声明 = kvRows 三行）",
   declared_kv is not None and [r["key"] for r in declared_kv["rows"]] == ["rar", "maxDD", "costRatio"],
   declared_kv)
ok("结算面板分数块（声明 = bigNumber rating.S）",
   declared_big is not None and declared_big.get("source") == "rating.S", declared_big)

for g in GRADES:
    rec = R["grades"][g]
    text = rec["panelText"] or ""
    kv = rec["kvRows"] or []
    ok(f"{g}.面板逐项列出 rar / maxDD / costRatio",
       [r["key"] for r in kv] == ["rar", "maxDD", "costRatio"], [r["key"] for r in kv])
    ok(f"{g}.三项输入各自的数值已代入（非空且为百分比）",
       all("%" in r["text"] for r in kv), [r["text"] for r in kv])
    ok(f"{g}.面板逐字给出公式表达式", rec["expression"] == expr and bool(expr),
       f"dom={rec['expression']}")
    ok(f"{g}.面板列出四条口径说明", len(rec["notes"] or []) == len(notes) == 4, len(rec["notes"] or []))
    chip_keys = [c["key"] for c in (rec["chips"] or [])]
    missing = [k for k in ("baseScore", "ddPenalty", "costPenalty") if k not in chip_keys]
    ok(f"{g}.中间量 baseScore / ddPenalty / costPenalty 逐步展开", missing == [], f"missing={missing} keys={chip_keys}")
    raw_missing = [k for k in ("navStart", "navNow", "feesInWindow", "notionalInWindow") if k not in chip_keys]
    ok(f"{g}.原始输入（NAV 端点 / 费用 / 成交额）也摊开", raw_missing == [], f"missing={raw_missing}")
    big = next((x for x in (rec["bigNumbers"] or []) if x["source"] == "rating.S"), None)
    ok(f"{g}.面板显示本章分数 S（bigNumber）", big is not None, rec["bigNumbers"])
    if big:
        nums = re.findall(r"-?\d+(?:\.\d+)?", big["text"].split("S")[-1])
        shown = float(nums[-1]) if nums else None
        ok(f"{g}.显示的 S 与计算出的一致", shown is not None and abs(shown - rec["S"]) <= 0.01,
           f"shown={shown} computed={rec['S']} text={big['text']!r}")
    ok(f"{g}.分数与档位同屏（S 与档位点评在同一面板）",
       has(text, "本章分数 S") and has(text, rec["gradeLine"]),
       f"S? {'本章分数 S' in text} line? {rec['gradeLine']!r}")

ok("表达式含基分项 50 + rar × 833", "833" in expr and "rar" in expr, expr)
ok("表达式含回撤罚分项（maxDD）", "maxDD" in expr, expr)
ok("表达式含成本罚分项（costRatio）", "costRatio" in expr, expr)
ok("表达式含三段 clamp", expr.count("clamp") == 3, expr.count("clamp"))
ok("口径说明覆盖 rar / maxDD / costRatio 三条",
   all(any(k in n for n in notes) for k in ("rar", "maxDD", "costRatio")), notes)

dic = R["dictionary"]
print("[2b] 完整公式查询入口（词典与公式）")
ok("存在「词典与公式」入口按钮", dic.get("entryExists") is True and dic.get("entryText") == "词典与公式",
   f"exists={dic.get('entryExists')} text={dic.get('entryText')!r}")
ok("openDictionary() 能打开查询面板", dic.get("opened") is True and dic.get("hiddenOnOpen") is False,
   f"opened={dic.get('opened')} hidden={dic.get('hiddenOnOpen')}")
ok("查询面板有「评级公式」页签", "评级公式" in (dic.get("tabs") or []), dic.get("tabs"))
ok("点击后停在「评级公式」页", "评级公式:on" in (dic.get("tabsAfterClick") or []), dic.get("tabsAfterClick"))
ok("查询面板逐字给出同一条公式", dic.get("formulaExpression") == expr and bool(expr),
   f"dict={dic.get('formulaExpression')}")
ok("查询面板列出同四条口径说明",
   len(dic.get("formulaNotes") or []) == 4, dic.get("formulaNotes"))
dict_chips = [c["key"] for c in (dic.get("chips") or [])]
ok("查询面板列出 RATING_PARAMS 常量",
   all(k in dict_chips for k in ("baseScore", "rarSlope", "ddMaxPenalty", "costMaxPenalty")), dict_chips)
ok("查询面板列出本次代入值（navStart / feesInWindow / ddPenalty …）",
   all(k in dict_chips for k in ("navStart", "feesInWindow", "baseScore", "ddPenalty", "costPenalty")), dict_chips)
ok("查询面板档位行含门槛数值",
   len(dic.get("gradeRows") or []) == 4
   and all(any(("≥" in r) or ("<" in r) for r in row["rows"]) for row in dic["gradeRows"]),
   dic.get("gradeRows"))
ok("查询面板无未解析占位", dic.get("unresolved") == [], dic.get("unresolved"))

# ── 3. 无引导 / 纠正措辞 ─────────────────────────────────────────────────────
print("[3] 拒单回执与教学反馈：无「你不该」「建议按导师指引操作」")
ref = R["refusal"]
ok("拒单场景在开市时段（前置条件）", ref.get("marketOpen") is True, ref.get("marketOpen"))
for case in ref["cases"]:
    tag = case["tag"]
    ok(f"拒单[{tag}]：被拒且有回执文案",
       case["status"] == "rejected" and bool(case.get("rejectText")) and case.get("err") is None,
       f"status={case['status']} rejectText={case.get('rejectText')!r} err={case.get('err')}")
    ok(f"拒单[{tag}]：回执文案渲染到下单面板",
       case.get("receiptShown") is True and has(case.get("receiptText"), case.get("rejectText")),
       f"shown={case.get('receiptShown')} receipt={case.get('receiptText')!r}")
ok("拒单场景覆盖 7 类（资金 / 涨跌停 / T+1 / 价位 / 手数 / 数量 / 休市）",
   len(ref["cases"]) == 7, len(ref["cases"]))

refusal_corpus = corpus(
    [c.get("rejectText") for c in ref["cases"]],
    [c.get("receiptText") for c in ref["cases"]],
    ref.get("ticketTexts"),
    ref.get("lastOrder"),
)

tea = R["teaching"]
teaching_corpus = corpus(
    tea.get("choices"), tea.get("panels"), tea.get("mentorLines"), tea.get("segmentTexts"),
    tea.get("dataFeedback"), tea.get("dataMentorLines"), tea.get("feedbackShown"),
    tea.get("feedbackShown19"), tea.get("segments"),
)
ok("教学语料：两道选择题的题干与逐选项反馈都在",
   len(tea.get("dataFeedback") or []) >= 6, len(tea.get("dataFeedback") or []))
ok("教学语料：导师台词都在", len(tea.get("dataMentorLines") or []) >= 8,
   len(tea.get("dataMentorLines") or []))
ok("教学语料：四张规则卡面板已渲染",
   any(p["id"] == "panel.ruleCards" and has(p.get("text"), "资金不足") for p in tea.get("panels") or []),
   [p["id"] for p in tea.get("panels") or []])
ok("教学语料：补救段与加演段正文都在（仅用于本面扫描）",
   sorted(tea.get("segmentKinds") or []) == ["advanced", "remedial"], tea.get("segmentKinds"))
ok("教学语料：选错后的反馈确实被抛出", bool(tea.get("feedbackShown")) and bool(tea.get("feedbackShown19")),
   f"2.5={bool(tea.get('feedbackShown'))} 1.9={bool(tea.get('feedbackShown19'))}")
ok("拒单语料非空（确实扫到了东西）", len(refusal_corpus.strip()) > 50, len(refusal_corpus))
ok("教学语料非空（确实扫到了东西）", len(teaching_corpus.strip()) > 200, len(teaching_corpus))

for w in STEERING:
    ok(f"拒单回执不含「{w}」", w not in refusal_corpus,
       [c["tag"] for c in ref["cases"] if has(c.get("receiptText"), w) or has(c.get("rejectText"), w)])
for w in STEERING:
    ok(f"教学反馈不含「{w}」", w not in teaching_corpus,
       [w] if w in teaching_corpus else [])

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
