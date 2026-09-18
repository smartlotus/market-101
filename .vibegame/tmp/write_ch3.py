# -*- coding: utf-8 -*-
"""写入第三章（ETF + 公募基金）的章节数据。

内容依据：GDD `### 第三章 · 一篮子里的一颗蛋`（处境 / 7 拍 / 概念 / 定向事件 / 出场条件 / 情绪落点）。
机制依据：与第二章同构（require 六种、panels、chapterEnd、settlement）。
新增：`compare`（产品并排对照）与 `docCard`（码排招募说明书）两个块型，
     以及复用 `flowWalk` 做章末「从片段里拼出你的理由」。
"""
import io
import json
import copy

PATH = 'config/chapters.json'
d = json.load(io.open(PATH, encoding='utf-8'))
c2 = [c for c in d['chapters'] if c['id'] == 2][0]

# 章末结算沿用第二章的**结构**（档位线、档位标签、对照行、加演/补救段骨架），只改文案
settlement = copy.deepcopy(c2['settlement'])
settlement['extraSegments']['advanced']['body'] = [
    '你这一章买的是 ETF，不是某一家公司。',
    '所以你赚到的钱里，有很大一部分来自**市场整体**，而不是你猜对了谁——这正是「不用猜对一只股票，也能参与」的意思。',
    '老周补了一句：真要比较，就拿你这一章的收益去比**同期沪深300**。跑赢它是本事，跑平它是常态，跑输了要问自己为什么。',
]
settlement['extraSegments']['remedial']['body'] = [
    '这一章的市场不算差，但你没能把「先选方法、再选公司」落成动作。',
    '我们只做一件事：把 ETF 和场外基金并排再看一遍。',
    '场内 ETF 是**盘中实时报价**，你出的价你自己知道；场外基金是**未知价交易**，你今天申购，按今天收市后的净值成交——你以为的价，其实要等到晚上才知道。',
    '这两句话记住就够了：**前者你定价，后者它定价。** 没有哪个更好，只有你更需要哪一种。',
]

CHOICES = {
    '3.2.pick': {
        'id': '3.2.pick',
        'question': '这两样摆在一起，你更在意哪一件事？',
        'conceptKey': '场内 vs 场外',
        'correctKey': None,
        'options': [
            {'key': 'priceKnown', 'text': '我更在意「价格是我自己知道的」——盘中报价、想买就买，成交价我心里有数。',
             'feedback': '那就走场内。代价是你得自己盯价、自己决定什么时候出手；换来的是一切都在明面上。'},
            {'key': 'feeHidden', 'text': '我更在意「别让我天天动手」——按净值申购、不用盯盘，费用藏在净值里也认。',
             'feedback': '那就走场外。代价是你今天不知道成交价，而且短期赎回要被收一笔惩罚费——它专门治「拿不住」。'},
        ],
    },
    '3.6.whyNotHold': {
        'id': '3.6.whyNotHold',
        'question': '如果你在这几拍里来回买卖了几次，你现在怎么想？',
        'conceptKey': '交易成本',
        'correctKey': None,
        'options': [
            {'key': 'costly', 'text': '我才发现，进出的每一次都要交钱——来回几趟，手续费比赚的还多。',
             'feedback': '这就是**交易成本**。它不显眼，但它每次都在；交易越频繁，它咬得越狠。'},
            {'key': 'timing', 'text': '我其实是在猜什么时候买、什么时候卖——这就是「择时」，我猜得并不准。',
             'feedback': '「长期持有 vs 择时」的第一课，不是择时一定错，而是**择时要有依据**；没有依据的择时，成本却一定在收。'},
            {'key': 'none', 'text': '我没有来回买卖，我就是拿着。',
             'feedback': '那很好。你没有做任何动作，也就没有付出任何成本——这也是一种决定。'},
        ],
    },
    '3.end': {
        'id': '3.end',
        'question': '如果一年后你只能记住这一章的一句话，你希望是哪一句？',
        'conceptKey': '分散投资',
        'correctKey': None,
        'options': [
            {'key': 'pickedRight', 'text': '「我押对了哪只。」',
             'feedback': '这句听起来很爽。但你得接受它另一半的意思：押错的时候，你也要承担全部后果——而这一章想说的恰恰是不必这样。'},
            {'key': 'knowWhy', 'text': '「我知道我为什么买。」',
             'feedback': '这句更慢，但它能重复。知道为什么买的人，跌的时候也知道自己该做什么——这才是这一章真正想留给你的东西。'},
        ],
    },
}

PANELS = {
    'panel.compare': {
        'id': 'panel.compare',
        'kind': 'compare',
        'title': '两样东西摆在一张桌上',
        'blocks': [{
            'type': 'compare',
            'id': '3.2.compare',
            'leftLabel': '场内 ETF（510300）',
            'rightLabel': '场外基金（110020）',
            'rows': [
                {'key': 'where', 'label': '在哪里买',
                 'left': '券商 App 里，和买股票同一个入口。',
                 'right': '基金公司或代销平台，是另一个入口（不在你的券商自选里）。'},
                {'key': 'price', 'label': '价格可知吗',
                 'left': '盘中实时报价，你出多少价自己知道。',
                 'right': '不知道。你提交时只有昨天和前天的净值，成交价按**今天收市后**的净值算。',
                 'note': '这就是「未知价交易」——它不是为了坑你，是因为基金持有的一篮子东西，要等收市才能算清楚值多少钱。'},
                {'key': 'settle', 'label': '什么时候到账',
                 'left': '卖出后资金当日可用（T+1 可卖，卖出款当日就能再买）。',
                 'right': '申购 T+1 确认份额；赎回款 T+3 才回到你的账上。',
                 'note': '所以场外基金不适合「明天要用钱」的场景——它天生鼓励你慢一点。'},
                {'key': 'fee', 'label': '费用结构',
                 'left': '佣金（有最低 5 元），免印花税、免过户费。',
                 'right': '申购费按金额收；赎回费按**你持有了多久**收——持有越短，费率越高。',
                 'note': '免掉的印花税让 ETF 的短线成本更低；而场外基金用赎回费惩罚「拿不住」。这两个设计方向是相反的。'},
                {'key': 'tracking', 'label': '跟踪误差',
                 'left': '你看着报价买，误差几乎全落在你自己的成交价上。',
                 'right': '基金自己也会有很小的跟踪偏离（咱们这个模拟里是 ±0.1%）——它跟着指数走，但不会分毫不差。',
                 'note': '跟踪误差不是缺陷，是「复制一个指数」这件事本身的代价。'},
                {'key': 'manage', 'label': '管理费',
                 'left': '同样有管理费，但它已经体现在你看到的报价里。',
                 'right': '年化管理费**从净值里直接扣**，你不会收到任何账单。',
                 'note': '看不见的费用最容易让人忽略它——这也是它在教学上必须被点名的原因。'},
            ],
        }],
        'actions': [{'id': '3.2.closeCompare', 'label': '两边都看过了'}],
    },
    'panel.prospectus': {
        'id': 'panel.prospectus',
        'kind': 'docCard',
        'title': '基金招募说明书（节选）',
        'blocks': [{
            'type': 'docCard',
            'id': '3.2.doc',
            'title': '沪深300指数基金 · 招募说明书节选',
            'subtitle': '关键字段（由代码排版呈现，不是图片）',
            'fields': [
                {'key': 'name', 'label': '基金名称', 'value': '沪深300指数基金'},
                {'key': 'type', 'label': '基金类型', 'value': '股票型指数基金（场外）'},
                {'key': 'target', 'label': '跟踪标的', 'value': '沪深300ETF（510300）'},
                {'key': 'min', 'label': '起购金额', 'value': '100 元',
                 'note': '场外基金按金额买，不按「手」——这和 ETF、股票都不一样。'},
                {'key': 'sub', 'label': '申购费', 'value': '申购金额 × 0.15%'},
                {'key': 'redeem', 'label': '赎回费', 'value': '持有 < 7 天 1.5% / 7–365 天 0.5% / > 365 天 0',
                 'note': '持仓时间越短罚得越重，这笔钱是「别急着走」的意思。'},
                {'key': 'manage', 'label': '管理费', 'value': '年化 1.2%，按日从基金净值中扣除',
                 'note': '你永远不会收到这张账单——它每天悄悄从净值里走。'},
                {'key': 'confirm', 'label': '确认与到账', 'value': '申购 T+1 确认份额；赎回款 T+3 到账'},
                {'key': 'risk', 'label': '风险提示', 'value': '本基金不保本；净值随所跟踪指数波动而涨跌。'},
            ],
        }],
        'actions': [{'id': '3.2.closeDoc', 'label': '合上说明书'}],
    },
    'panel.unknownPrice': {
        'id': 'panel.unknownPrice',
        'kind': 'text',
        'title': '你今天不知道成交价',
        'blocks': [
            {'type': 'text', 'id': '3.3.head', 'label': '',
             'text': '你的申购单被接受了——但没有立刻成交。'},
            {'type': 'text', 'id': '3.3.body', 'label': '',
             'text': '场外基金是**未知价交易**：你今天提交，按**今天收市后算出来的净值**成交。所以你此刻看到的那个净值，只是昨天的。'},
            {'type': 'text', 'id': '3.3.body2', 'label': '',
             'text': '这不是延迟，也不是系统慢——基金手里握着一篮子资产，要等收市以后才能算清它到底值多少钱。'},
        ],
        'actions': [{'id': '3.3.closePanel', 'label': '知道了'}],
    },
    'panel.holdingPeriod': {
        'id': 'panel.holdingPeriod',
        'kind': 'kvRows',
        'title': '钱不是立刻回来的',
        'blocks': [{
            'type': 'kvRows',
            'id': '3.4.rows',
            'rows': [
                {'key': 'c1', 'label': '申购当天（T 日）', 'value': '提交申购，成交价未知'},
                {'key': 'c2', 'label': 'T+1', 'value': '份额确认，你才真正持有它'},
                {'key': 'c3', 'label': '赎回当天', 'value': '提交赎回，同样按当日收市净值算'},
                {'key': 'c4', 'label': 'T+3', 'value': '赎回款回到你的账上'},
                {'key': 'c5', 'label': '持有不足 7 天就赎回', 'value': '赎回费 1.5% —— 几乎吃掉一次短线的全部利润'},
            ],
        }],
        'actions': [{'id': '3.4.closePanel', 'label': '都看明白了'}],
    },
    'panel.whyNotHold': {
        'id': 'panel.whyNotHold',
        'kind': 'text',
        'title': '为什么拿不住',
        'blocks': [
            {'type': 'text', 'id': '3.6.body', 'label': '',
             'text': '老周把你这两天的操作翻出来看了一眼，没评价对错，只问了一句：你进出的这些次数，每一次都在交钱——你算过一共交了多少吗？'},
            {'type': 'text', 'id': '3.6.body2', 'label': '',
             'text': '这一问你想不想答都行。想看自己的费用，去持仓与账本那边翻一眼。'},
            {'type': 'choiceGroup', 'choiceId': '3.6.whyNotHold'},
        ],
        'actions': [{'id': '3.6.closePanel', 'label': '我想完了'}],
    },
    'panel.confirm': copy.deepcopy(c2['panels']['panel.confirm']),
    'panel.settlement': copy.deepcopy(c2['panels']['panel.settlement']),
    'panel.extraSegment': copy.deepcopy(c2['panels']['panel.extraSegment']),
}
PANELS['panel.confirm']['id'] = 'panel.confirm'

FLOW_WALKS = {
    'reason': {
        'id': 'reason',
        'prompt': '把你选它的理由，从下面这些片段里按顺序拼出来。',
        'cards': [
            {'id': 'p3', 'label': '所以我不需要先猜对哪一家会涨'},
            {'id': 'p1', 'label': '我买的是一篮子，不是一个赌注'},
            {'id': 'p4', 'label': '我赚的是市场的钱，不是我的运气'},
            {'id': 'p2', 'label': '与其把全部本金押在一只股票上'},
        ],
        'order': ['p2', 'p1', 'p3', 'p4'],
        'finishRequireId': '3.7.assemble.done',
    },
}

def mentor(timing, line, concept=None):
    return {'timing': timing, 'speaker': 'face', 'conceptKey': concept, 'line': line}

BEATS = [
    {
        'id': '3.1', 'title': '一篮子', 'shell': 'full', 'scene': 'cafe', 'sceneImageKey': None,
        'mentor': [
            mentor('chapterOpen', '第二章你学会的是「别被规则咬到」。这一章换个问题：既然你不需要猜对一只股票——那你要买的到底是什么？'),
            mentor('firstConcept', '你翻自选列表翻了一上午，每一只都能找出理由，也都能找出理由不买。先别选公司。先选方法。', 'ETF'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'select', 'id': '3.1.selectEtf', 'instrumentId': '510300',
             'label': '在自选列表里找到并选中沪深300ETF'},
        ],
        'concepts': ['ETF', '指数'], 'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '3.2', 'title': '并排看', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '这两样东西，一个是场内的 ETF，一个是场外的基金。我把它们摆在一张桌上，你逐条看。', '场内 vs 场外'),
        ],
        'panels': ['panel.compare', 'panel.prospectus'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '3.2.compare', 'panelId': 'panel.compare', 'count': 6,
             'mustClose': True, 'label': '把六个对照项逐条看过'},
            {'kind': 'read', 'id': '3.2.doc', 'panelId': 'panel.prospectus', 'count': 9,
             'mustClose': True, 'label': '读完招募说明书的关键字段'},
            {'kind': 'choice', 'id': '3.2.pick', 'choiceId': '3.2.pick',
             'label': '回答：你更在意哪一件事'},
        ],
        'concepts': ['场内 vs 场外', 'IOPV', '折溢价', '跟踪误差', '管理费'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '3.3', 'title': '你不知道今天什么价', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '现在去申购那只场外基金。提醒你一句：你按下的那一刻，成交价还没生出来。', '未知价交易'),
        ],
        'panels': ['panel.unknownPrice'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'submit', 'id': '3.3.subscribe',
             'expect': {'accepted': True, 'side': 'buy', 'instrumentId': '110020'},
             'label': '申购一笔场外基金'},
        ],
        'concepts': ['未知价交易', '基金净值NAV'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '3.4', 'title': '钱不是立刻回来的', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '份额还没到你名下。往前推一天看看。', '申购确认'),
        ],
        'panels': ['panel.holdingPeriod'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '3.4.read', 'panelId': 'panel.holdingPeriod', 'count': 5,
             'mustClose': True, 'label': '看清申赎的时间线'},
            {'kind': 'advanceDay', 'id': '3.4.advance1', 'label': '进入下一交易日（T+1 份额确认）',
             'simAction': ['advanceDay']},
            {'kind': 'advanceDay', 'id': '3.4.advance2', 'label': '再推一天，看账户怎么变',
             'simAction': ['advanceDay']},
        ],
        'concepts': ['申购确认', '赎回到账', '持有期惩罚'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '3.5', 'title': '买一篮子', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '现在把 ETF 买进来。买它，等于一次买下三百家公司——你不用挑出对的那一家。', '分散投资'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'select', 'id': '3.5.select', 'instrumentId': '510300',
             'label': '选中沪深300ETF'},
            {'kind': 'submit', 'id': '3.5.buy',
             'expect': {'accepted': True, 'side': 'buy', 'instrumentId': '510300'},
             'label': '买入 ETF'},
        ],
        'concepts': ['分散投资'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '3.6', 'title': '为什么拿不住', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '有个东西一直在悄悄收你的钱，它不显眼，但每一次都在。', '交易成本'),
        ],
        'panels': ['panel.whyNotHold'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '3.6.read', 'panelId': 'panel.whyNotHold', 'count': 2,
             'mustClose': True, 'label': '读老周的点评（想不想回答都可以）'},
        ],
        'concepts': ['交易成本', '长期持有 vs 择时', '机会成本'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '3.7', 'title': '章末', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterClose', '你这一章赚到的钱，主要来自你**没有押一只股票**。收尾之前，把你选它的理由自己拼一遍。'),
        ],
        'panels': ['panel.assemble'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'interact', 'id': '3.7.assemble.done', 'gate': 'flowWalk',
             'label': '把「我为什么选它」按顺序拼出来'},
            {'kind': 'choice', 'id': '3.7.end', 'choiceId': '3.end',
             'label': '回答老周的最后一问'},
        ],
        'concepts': ['投资理念'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
]

PANELS['panel.assemble'] = {
    'id': 'panel.assemble',
    'kind': 'flowWalk',
    'title': '把你选它的理由拼出来',
    'blocks': [{'type': 'flowWalk', 'id': '3.7.walk', 'walkId': 'reason'}],
    'actions': [{'id': '3.7.closePanel', 'label': '拼好了'}],
}

c3 = {
    'id': 3,
    'name': '一篮子里的一颗蛋',
    'implemented': True,
    'situation': '同事都在押一只股票，你觉得太吓人',
    'preview': '先别选公司。先选方法。',
    'rated': True,
    'noScoreLabel': None,
    'clearResidualsOnEnter': True,
    'unlocks': {'instruments': ['510300', '510050', '110020', '000187']},
    'goalCard': {
        'title': '一篮子里的一颗蛋',
        'teach': '这一章结束，你要能说清：买 ETF 和买一只股票，到底差在哪里；以及为什么「先选方法、再选公司」能让你不必猜对。',
        'graded': True,
    },
    'savePoints': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7'],
    'directedEvents': ['M02', 'I02'],
    'pinnedEvents': ['M02'],
    'directedQueue': ['M02', 'I02'],
    'choices': CHOICES,
    'panels': PANELS,
    'flowWalks': FLOW_WALKS,
    'chapterEnd': {
        'settlementPanelId': 'panel.settlement',
        'confirmPanelId': 'panel.confirm',
        'extraPanelId': 'panel.extraSegment',
        'understandingChoiceId': '3.end',
    },
    'settlement': settlement,
    'beats': BEATS,
}

d['chapters'] = [c for c in d['chapters'] if c['id'] != 3] + [c3]
d['chapters'].sort(key=lambda c: c['id'])

io.open(PATH, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('第三章已写入：', len(BEATS), '拍；面板', len(PANELS), '个；选项组', len(CHOICES), '个')
