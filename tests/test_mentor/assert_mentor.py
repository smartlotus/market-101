#!/usr/bin/env python3
"""test_mentor 断言（读 evidence/drive_result.json + evidence/idle_line.json）。

覆盖交付说明的六条：
  ① 五个开口时机的穷举（含负例）  ② 每概念主动讲解上限 2 次 + 跨章 / 跨存档累加
  ③ 静音抑制台词但计数照常累加    ④ freeDay / sandbox 不主动弹窗
  ⑤ 无隐藏层（持久化面只有三项 + 白名单丢弃未知键）  ⑥ R10 章内只有一个说话面

契约：断言失败 → exit 1（运行时保持存活，便于事后 reattach）。
"""
import json
import sys
from pathlib import Path

EVIDENCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / "evidence"
raw = json.loads((EVIDENCE / "drive_result.json").read_text(encoding="utf-8"))
R = raw["result"]
idle = json.loads((EVIDENCE / "idle_line.json").read_text(encoding="utf-8"))["result"]

MENTOR_STATE_KEYS = ["explainCounts", "muted", "proactiveEnabled"]

fails = []
checks = 0


def ok(name, cond, detail=""):
    global checks
    checks += 1
    if not cond:
        fails.append(f"{name}: {detail}")
    print(("  PASS " if cond else "  FAIL ") + name + ("" if cond else "  <- " + str(detail)))


def has_no_forbidden(line):
    return bool(line) and ("你不该" not in line)


# ── 0 确定性基线 ──────────────────────────────────────────────────────────────
print("[0 确定性基线]")
bl = R["baseline"]
ok("baseline.mode == 'chapter'", bl["mode"] == "chapter", bl["mode"])
ok("baseline.beatId == '1.0'", bl["beatId"] == "1.0", bl["beatId"])
ok("baseline 概念计数为空（确定性起点）", bl["counts"] == {}, bl["counts"])
ok("baseline.muted is False", bl["muted"] is False, bl["muted"])
ok("baseline.proactiveEnabled is True", bl["proactiveEnabled"] is True, bl["proactiveEnabled"])

# ── ①(a) 章开场一次 ───────────────────────────────────────────────────────────
print("[①(a) 章开场：一次，且只说数据里那一句]")
op = R["open"]
ok("章开场有台词", bool(op["line"]), op["line"])
ok("台词逐字等于数据里的 chapterOpen 台词", op["line"] == op["dataLine"], op["line"])
ok("章开场没有 conceptKey（不占概念配额）", op["conceptKey"] is None, op["conceptKey"])
ok("speaker 与数据声明一致", op["speaker"] == op["dataSpeaker"], op["speaker"])
ok("仅刷新视图不再产生新台词", op["lineUnchangedOnRefresh"] is True, op["lineUnchangedOnRefresh"])
ok("章开场不累加任何概念计数", op["counts"] == {}, op["counts"])

# ── ①(b) 首遇概念 / 本拍点名 ─────────────────────────────────────────────────
print("[①(b) 首遇概念：开口一次并累加该概念计数]")
fb = R["firstConceptBank"]
ok("1.0 → 1.1 推进成功", fb["beatId"] == "1.1", fb["beatId"])
ok("1.1 有台词且逐字等于数据", fb["line"] == fb["dataLine"], fb["line"])
ok("1.1 台词挂 conceptKey == '银行'", fb["conceptKey"] == "银行", fb["conceptKey"])
ok("银行 计数 == 1", fb["counts"].get("银行") == 1, fb["counts"])
fl = R["firstConceptLot"]
ok("1.4 首遇「最小交易单位」开口并计数 1",
   fl["conceptKey"] == "最小交易单位" and fl["counts"].get("最小交易单位") == 1, fl["counts"])
ok("1.4 台词逐字等于数据", fl["line"] == fl["dataLine"], fl["line"])
pc = R["negative"]["panelPaths"]["afterClose"]
ok("1.6 首遇「T+1」开口并计数 1",
   pc["conceptKey"] == "T+1" and pc["counts"].get("T+1") == 1, pc["counts"])

# ── ① 负例：其他路径不得产生台词 ─────────────────────────────────────────────
print("[① 负例：非五个时机的路径不得开口]")
neg = R["negative"]
ok("[负例] 开面板不换台词", neg["afterPanelOpen"]["lineUnchanged"] is True, neg["afterPanelOpen"])
ok("[负例] 读面板不换台词", neg["afterPanelRead"]["lineUnchanged"] is True, neg["afterPanelRead"])
ok("[负例] 进入未声明 mentor 的 1.3 → 无台词", neg["into1_3"]["line"] is None, neg["into1_3"])
ok("[负例] 1.3 数据里确实没有任何 mentor 条目", neg["into1_3"]["beatMentor"] == [], neg["into1_3"]["beatMentor"])
ok("[负例] 选标的推进到未声明 mentor 的 1.5 → 无台词", neg["into1_5"]["line"] is None, neg["into1_5"])
ok("[负例] 1.5 数据里确实没有任何 mentor 条目", neg["into1_5"]["beatMentor"] == [], neg["into1_5"]["beatMentor"])
pp = R["negative"]["panelPaths"]
ok("[负例] 跳拍本身（restoring）不开口", pp["afterGoto"] is None, pp["afterGoto"])
ok("[负例] 打开概念卡面板不开口", pp["afterOpen"] is None, pp["afterOpen"])
ok("[负例] 读满概念卡不开口", pp["afterRead"] is None, pp["afterRead"])

# ── ①(c) 被拒单 / 触风险警示线 ───────────────────────────────────────────────
print("[①(c) 被拒单 / 触风险警示线：开口，且comfort 优先、无纠正措辞]")
re_ = R["reactive"]
ok("触风险警示线（NAV ¥9000）开口一句提示", bool(re_["riskLine"]), re_["riskLine"])
ok("风险提示指向补足本金（数据里的 yellowLine）", "补足" in (re_["riskLine"] or ""), re_["riskLine"])
ok("风险提示金额代入当前 NAV（¥9000）", "9000" in (re_["riskLine"] or ""), re_["riskLine"])
ok("风险提示每章最多一次（清台词后再触线不再重复）", re_["secondRiskLine"] is None, re_["secondRiskLine"])
ok("风险提示不消耗任何概念配额", re_["countsAfterRisk"] == re_["countsBefore"], re_["countsAfterRisk"])
rj = re_["reject"]
ok("被拒单（REJECT_2，非本拍期望）确实发生", rj["reasonCode"] == "REJECT_2" and rj["accepted"] is False, rj)
ok("被拒单后仍停在 2.1（未完成本拍）", rj["beatId"] == "2.1", rj["beatId"])
ok("被拒单开口且逐字等于数据里的 rejected 台词", rj["line"] == rj["dataLine"], rj["line"])
ok("被拒单台词挂 conceptKey == '可用资金不足'", rj["conceptKey"] == "可用资金不足", rj["conceptKey"])
ok("被拒单开口不改动概念计数（reactive 不占配额）", rj["counts"] == rj["before"]["counts"], rj["counts"])
ok("被拒单台词 comfort 优先、无「你不该……」", has_no_forbidden(rj["line"]), rj["line"])
ok("全部章节台词 / 反馈都不含「你不该……」", R["forbiddenWording"]["hits"] == [], R["forbiddenWording"]["hits"])

# ── ② 每概念主动讲解上限 2 次 ────────────────────────────────────────────────
print("[② 每概念主动讲解上限 2 次：第 3 次抑制，呼叫仍可用]")
steps = R["quota"]["steps"]
s1, s2, s3, s4 = steps[0], steps[1], steps[2], steps[3]
ok("reset -> 1.0：章开场照常开口（不受概念上限限制）", bool(s1["line"]) and s1["conceptKey"] is None, s1)
ok("银行 第 2 次主动仍开口（比喻 → 机制）", bool(s2["line"]) and s2["counts"].get("银行") == 2, s2)
ok("银行 第 3 次主动被抑制（无台词）", s3["line"] is None, s3["line"])
ok("第 3 次被抑制时计数不再增长（仍为 2）", s3["counts"].get("银行") == 2, s3["counts"])
ok("第 3 次被抑制时 conceptKey 也不再出现", s3["conceptKey"] is None, s3["conceptKey"])
call = R["quota"]["callWhenSuppressed"]
ok("玩家主动呼叫在配额用尽后仍可用", call["res"].get("ok") is True, call["res"])
ok("呼叫确实产生台词", bool(call["line"]), call["line"])
ok("呼叫不计入「最多主动讲 2 次」的上限", call["counts"].get("银行") == 2, call["counts"])
ok("另一概念（券商）不受银行配额影响，第 2 次仍开口",
   bool(s4["line"]) and s4["counts"].get("券商") == 2, s4)

# ── ② 跨章 / 跨存档 ─────────────────────────────────────────────────────────
print("[② 计数跨章累加，且 toJSON → loadFrom 往返一致]")
cc = R["crossChapter"]
ok("进入第二章不清零导师计数", cc["after"] == cc["before"], f"{cc['before']} -> {cc['after']}")
ok("跨章进入 2.1（restoring）不开口", cc["beatId"] == "2.1" and cc["line"] is None, cc)
st = R["saveTrip"]
ok("存档里 mentor 只有三个键", st["saveKeys"] == MENTOR_STATE_KEYS, st["saveKeys"])
ok("loadFrom(空) 确实清空（证明往返断言有效）",
   st["cleared"]["counts"] == {} and st["cleared"]["muted"] is True, st["cleared"])
ok("toJSON → loadFrom 后计数逐项一致", st["restored"]["counts"] == st["before"]["counts"], st["restored"])
ok("toJSON → loadFrom 后 muted 一致", st["restored"]["muted"] == st["before"]["muted"], st["restored"])
ok("toJSON → loadFrom 后 proactiveEnabled 一致",
   st["restored"]["proactiveEnabled"] == st["before"]["proactiveEnabled"], st["restored"])

# ── ⑤ 无隐藏层 ───────────────────────────────────────────────────────────────
print("[⑤ 无隐藏层：持久化面只有计数 + 静音 + 主动开关，白名单丢弃未知键]")
nh = R["noHiddenLayer"]
ok("活的调度器状态面只有三个键", nh["liveKeysBefore"] == MENTOR_STATE_KEYS, nh["liveKeysBefore"])
ok("确实把伏笔 / 身份 / 延迟台词塞进了活对象（测试有效）",
   {"fragment", "identity", "delayedLine", "foreshadow", "pendingReveal"}.issubset(set(nh["afterInjectKeys"])),
   nh["afterInjectKeys"])
ok("MentorScheduler.toJSON() 丢掉全部未知键", nh["liveJSONKeys"] == MENTOR_STATE_KEYS, nh["liveJSONKeys"])
ok("ChapterRuntime.toJSON().mentor 只有三个键", nh["chapterJSONKeys"] == MENTOR_STATE_KEYS, nh["chapterJSONKeys"])
ok("塞进去的键在断言后已清理干净", nh["liveKeysAfter"] == nh["liveKeysBefore"], nh["liveKeysAfter"])
ok("SaveStore 读回的 mentor 只有三个键（白名单生效）", nh["readMentorKeys"] == MENTOR_STATE_KEYS, nh["readMentorKeys"])
ok("白名单保留合法字段（计数器原样读回）", nh["readMentorCounts"] == {"银行": 1}, nh["readMentorCounts"])
ok("净化后的存档里没有任何伏笔 / 身份 / 延迟类键", nh["forbiddenKeyHits"] == [], nh["forbiddenKeyHits"])
ok("真实 localStorage 存档里的 mentor 也只有三个键",
   nh["saveRawMentorKeys"] == MENTOR_STATE_KEYS, nh["saveRawMentorKeys"])
ok("存档快照里没有额外的导师字段（快照面 = 三项 + 当次投影 + 诊断 source）",
   set(st["snapshotKeys"]) == set(MENTOR_STATE_KEYS) | {"line", "speaker", "conceptKey", "source", "callable"}, st["snapshotKeys"])

# ── ③ 静音 ───────────────────────────────────────────────────────────────────
print("[③ 静音：只吞非剧情发言，剧情/功能性台词照常，且计数照常累加（取消静音不补讲）]")
mu = R["mute"]
ok("setMuted(true) 生效", mu["mutedFlag"] is True, mu["mutedFlag"])
# 修正：Stage 1 这里断言「静音下章开场也不出现台词」—— 那是**错的行为**。
# lead 裁决：静音只抑制他主动补的提示 / 讲解 / 点评；章开场是**剧情台词**，必须照常出现，
# 否则玩家在静音下读不到章末交代与选项后果（那是断了反馈，不是少刷屏）。
ok("静音下章开场（剧情台词）照常出现", bool(mu["afterReset"]["line"]), mu["afterReset"])
ok("静音下章开场的来源是剧情来源 beat", mu["afterReset"]["source"] == "beat", mu["afterReset"])
ok("静音下首遇概念的讲解（非剧情发言）不出现", mu["afterAck"]["line"] is None, mu["afterAck"])
ok("静音下对话层也没有台词文本", mu["afterAck"]["chLineText"] == "", repr(mu["afterAck"]["chLineText"]))
ok("静音下计数照常推进（银行 2 → 3）",
   mu["afterAck"]["counts"].get("银行") == mu["before"].get("银行", 0) + 1,
   f"{mu['before']} -> {mu['afterAck']['counts']}")
ok("补记不会重复计数（再刷新一次计数不变）", mu["afterRefresh"]["counts"] == mu["afterAck"]["counts"], mu["afterRefresh"])
ok("静音时判定理由为 muted", mu["reason"]["speak"] is False and mu["reason"]["reason"] == "muted", mu["reason"])
ok("取消静音后不补讲（无积压台词）", mu["afterUnmute"]["line"] is None, mu["afterUnmute"])
ok("取消静音后对话层仍为空", mu["afterUnmute"]["chLineText"] == "", repr(mu["afterUnmute"]["chLineText"]))
ok("取消静音不改变计数", mu["afterUnmute"]["counts"] == mu["afterRefresh"]["counts"], mu["afterUnmute"])
ok("取消静音后章开场恢复开口（静音确实被解除）", bool(mu["openLineAfterUnmute"]), mu["openLineAfterUnmute"])
ok("静音期间累加的计数在取消静音后仍然生效（配额成立）",
   mu["quotaStillHolds"]["line"] is None and mu["quotaStillHolds"]["counts"].get("银行") == 3, mu["quotaStillHolds"])

# ── ④ freeDay / sandbox 不主动弹窗 ─────────────────────────────────────────
print("[④ freeDay / sandbox：普通动作不主动弹窗]")
fd = R["freeDay"]
ok("切到 freeDay 后调度器台词被清空", fd["mode"] == "freeDay" and fd["lineAfterSetMode"] is None, fd)
ok("freeDay 下 reactive 判定为 non_intrusive_mode",
   fd["rejectReason"]["speak"] is False and fd["rejectReason"]["reason"] == "non_intrusive_mode", fd["rejectReason"])
ok("freeDay 下首遇概念同样不开口（即使配额未满）",
   fd["firstConceptReason"]["speak"] is False and fd["firstConceptReason"]["reason"] == "non_intrusive_mode",
   fd["firstConceptReason"])
ok("freeDay 下推进交易日不产生台词", fd["afterAdvanceDay"]["line"] is None, fd["afterAdvanceDay"])
ok("freeDay 下真实被拒单也不产生台词",
   fd["afterRejectedOrder"]["line"] is None and fd["afterRejectedOrder"]["reasonCode"] == "REJECT_1",
   fd["afterRejectedOrder"])
sb = R["sandbox"]
ok("切到 sandbox 后调度器台词为空", sb["mode"] == "sandbox" and sb["lineAfterSwitch"] is None, sb)
ok("sandbox 下 reactive 判定为 non_intrusive_mode",
   sb["rejectReason"]["speak"] is False and sb["rejectReason"]["reason"] == "non_intrusive_mode", sb["rejectReason"])
ok("sandbox 下推进交易日不产生台词", sb["afterAdvanceDay"] is None, sb["afterAdvanceDay"])
ok("sandbox 下真实被拒单也不产生台词",
   sb["afterRejectedOrder"]["line"] is None and sb["afterRejectedOrder"]["reasonCode"] == "REJECT_1",
   sb["afterRejectedOrder"])
ok("sandbox 下对话层整体收起", sb["dialogueLayer"]["hiddenByClass"] is True and sb["dialogueLayer"]["visible"] is False,
   sb["dialogueLayer"])

# ── ⑥ R10 章内只有一个说话面 ────────────────────────────────────────────────
print("[⑥ R10：章内 MentorView 静态（只有中性标签），freeDay 恢复事件台词]")
r10 = R["r10Chapter"]
ok("章内当前存在一条导师台词（有可被抢的内容）", r10["mode"] == "chapter" and bool(r10["mentorLine"]), r10)
ok("制造台词的公开钩子 callMentor 成功", r10["callOk"] is True, r10["callOk"])
ok("MentorView 置 data-mentorStatic=1", r10["datasetStatic"] == "1", r10["datasetStatic"])
ok("MentorView 带 .static 类", r10["hasStaticClass"] is True, r10["cls"])
ok("MentorView 的中性标签为「导师 · 周老师」", r10["whoText"] == "导师 · 周老师", r10["whoText"])
ok("MentorView 的 say 行为空", r10["sayText"] == "", repr(r10["sayText"]))
ok("MentorView 的 foot 行为空", r10["footText"] == "", repr(r10["footText"]))
ok("MentorView 的 say/foot 被 CSS 隐藏（display:none）",
   r10["sayDisplay"] == "none" and r10["footDisplay"] == "none", (r10["sayDisplay"], r10["footDisplay"]))
ok("MentorView 的 DOM 文本 == 中性标签（无台词）", r10["rootText"] == "导师 · 周老师", r10["rootText"])
ok("MentorView 不渲染当日 mentorLine", r10["rendersMentorLine"] is False, r10["mentorLine"])
ok("台词由对话层显示（一次只有一张嘴）", r10["dialogueLayer"]["visible"] is True and r10["chLineText"] == r10["mentorLine"],
   (r10["dialogueLayer"], r10["chLineText"]))
ok("freeDay 下 MentorView 退出静态态", fd["mentorView"]["datasetStatic"] is None, fd["mentorView"]["datasetStatic"])
ok("freeDay 下 MentorView 恢复显示当日事件的 mentorLine",
   fd["mentorView"]["sayText"] == fd["eventMentorLine"] and bool(fd["eventMentorLine"]), fd["mentorView"]["sayText"])
ok("freeDay 下 MentorView 的 say 行可见（display:block）", fd["mentorView"]["sayDisplay"] == "block", fd["mentorView"])
ok("freeDay 下对话层收起（仍然只有一张嘴）", fd["dialogueLayer"]["visible"] is False, fd["dialogueLayer"])

# ── ⑦ 空转帧：无操作时也不得凭空开口 ───────────────────────────────────────
print("[⑦ 空转 30 帧：没有任何操作时不得开口]")
ok("收尾停在章内 1.5", R["final"]["beatId"] == "1.5" and R["final"]["mode"] == "chapter", R["final"])
ok("收尾时无台词", R["final"]["line"] is None, R["final"]["line"])
ok("空转 30 帧后仍无台词", idle["line"] is None, idle["line"])
ok("空转 30 帧后计数不变（没有偷偷记一笔）", idle["counts"] == R["final"]["counts"], idle["counts"])

print(f"\n{checks - len(fails)}/{checks} 断言通过")
if fails:
    print("\n失败项：")
    for f in fails:
        print("  - " + f)
    sys.exit(1)
