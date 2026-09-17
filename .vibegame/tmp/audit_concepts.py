import json, collections, re

doc = json.load(open('config/concepts.json', encoding='utf-8'))
entries = doc['concepts'] if isinstance(doc, dict) else doc
print('total entries:', len(entries))
keys = [e.get('key') for e in entries]
print('unique keys:', len(set(keys)))
dups = [k for k, c in collections.Counter(keys).items() if c > 1]
print('dup keys:', dups)

# field completeness
bad = []
for e in entries:
    for f in ('key', 'name', 'chapter', 'def', 'explain', 'metaphor'):
        v = e.get(f)
        if v is None or (isinstance(v, str) and not v.strip()):
            bad.append((e.get('key'), f))
    if not isinstance(e.get('related', []), list):
        bad.append((e.get('key'), 'related-not-list'))
print('missing-field entries:', bad[:20], 'count=', len(bad))

# any extra fields beyond the known shape
shape = collections.Counter()
for e in entries:
    shape[tuple(sorted(e.keys()))] += 1
for k, v in shape.items():
    print('shape', v, k)

adv = [e['key'] for e in entries if e.get('advanced')]
print('advanced count:', len(adv), adv)
print('chapters:', collections.Counter(e.get('chapter') for e in entries))
print('topics:', len(set(e.get('topic') for e in entries)), sorted(set(e.get('topic') for e in entries)))

# PRD 3 key list
prd_groups = {
 '市场规则': 'T+0 T+1 涨跌停 交易时段 休市/交易日历 撮合 滑点 最小交易单位 停牌'.split(),
 '品种类型': 'A股 ETF 公募基金(场外) 港股 美股 加密货币 期权 指数 蓝筹/成长股'.split(),
 '估值与价格': '市盈率PE 市净率PB 基金净值NAV 内在价值 IOPV 折溢价 开盘价/收盘价/最高最低 K线'.split(),
 '风险': '波动率 杠杆 时间价值衰减 汇率风险 流动性风险 集中度风险 黑天鹅 退市'.split(),
 '机构与生态': '交易所 券商 银行 清算交收 监管机构 基金管理人'.split(),
 '账户与费用': '佣金 印花税 过户费 申购费/赎回费 管理费 可用资金/冻结资金 持仓成本 已实现/未实现盈亏'.split(),
 '投资理念': '复利 资产配置 分散投资 长期持有 vs 择时 风险与收益匹配 定投 机会成本 通胀侵蚀购买力 本金安全'.split(),
}
v2 = '场内 vs 场外|未知价交易|每手股数不固定|碎股|交易成本|买卖价差|流动性|平台费|止盈止损|汇率折算|熔断|盘前/盘后|仓位管理|纪律|存管|清算交收（跨市场）|实值/虚值/平值|幸存者偏差'.split('|')
missing = []
for g, ks in prd_groups.items():
    for k in ks:
        if k not in keys:
            missing.append((g, k))
for k in v2:
    if k not in keys:
        missing.append(('v2', k))
print('MISSING PRD keys:', missing)
print('v2 count:', len(v2))
# related links resolve?
unknown_rel = []
for e in entries:
    for r in (e.get('related') or []):
        if r not in keys:
            unknown_rel.append((e['key'], r))
print('unknown related refs:', unknown_rel[:30], 'count=', len(unknown_rel))
