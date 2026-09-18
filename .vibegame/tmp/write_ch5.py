# -*- coding: utf-8 -*-
"""写入第五章（港股 + 汇率）的章节数据。内容依据 GDD `### 第五章 · 港币的账，美元的梦`。"""
import io
import json
import copy

PATH = 'config/chapters.json'
d = json.load(io.open(PATH, encoding='utf-8'))
c2 = [c for c in d['chapters'] if c['id'] == 2][0]

settlement = copy.deepcopy(c2['settlement'])
settlement['extraSegments']['advanced']['body'] = [
    '这一章你的账户里有**两个人在写字**：一个写股价，一个写汇率。',
    '你赚到的钱里，有一部分不是因为你选对了公司，而是因为你换了个地方放钱——而那个地方的钱，自己对人民币涨了。',
    '老周说：这不是坏事，但你得知道自己赚的是哪一份。分不清来源的收益，下次也守不住。',
]
settlement['extraSegments']['remedial']['body'] = [
    '汇率这一口，很多人第一年都要被咬一次。',
    '先只看一件事：你买港股花的钱，是**按当天的汇率**换成港币花出去的；你卖回来的时候，是**按那天的汇率**换回人民币的。',
    '中间隔着的这几天，港币对人民币的价一直在动。股价没变，你换回来的钱也可能变少——这就是**汇率风险**。',
    '记住一句话就够：**你赚的可能是股价的钱，亏的可能是汇率的钱。** 两个都得看，才算看懂了自己的账。',
]

CHOICES = {
    '5.5.split': {
        'id': '5.5.split',
        'question': '刚才这次 NAV 变化里，哪一部分来自汇率？',
        'conceptKey': '汇率风险',
        'correctKey': 'fx',
        'options': [
            {'key': 'price', 'text': '来自股价——因为港股跌了。',
             'feedback': '股价这一次其实没怎么动。你看一眼拆分：股价那一行的数很小，汇率那一行的数才是主要的那块。再看一次。'},
            {'key': 'fx', 'text': '来自汇率——因为人民币相对美元贬值，港币换回人民币就变少了。',
             'feedback': '对。这次你亏的主要不是公司，而是**货币之间的价**。同一个公司、同样的股价，在不同的汇率下，你的账不一样。'},
            {'key': 'both', 'text': '两个都有，但我说不清哪个更多。',
             'feedback': '说不清是对的起点。往上看拆分那两行：它们相加就是你的浮动盈亏——分得清来源，下次才知道该盯哪个。再看一次。'},
        ],
    },
    '5.6.mom': {
        'id': '5.6.mom',
        'question': '你妈问：「港币跌了，你那钱是不是就少了？」你怎么答？',
        'conceptKey': '汇率折算',
        'correctKey': None,
        'options': [
            {'key': 'less', 'text': '是。我手里是港股，港币跌了，折算回人民币就少了。',
             'feedback': '这个答案是对的——只要你**还没换回来**。这也正是刚刚发生在你账上的事。'},
            {'key': 'same', 'text': '不一定。得看股价有没有涨，也要看我换回去那天是什么价。',
             'feedback': '这个答案更完整。汇率只影响「换回来时值多少」，而换回来这个动作是由你决定的——所以它是一份**还没结清的风险**，不是一个已经发生的事实。'},
        ],
    },
    '5.end': {
        'id': '5.end',
        'question': '如果你的钱会同时被两个东西影响，你能做的是什么？',
        'conceptKey': '风险与收益匹配',
        'correctKey': None,
        'options': [
            {'key': 'avoid', 'text': '那就别碰港币——什么都不做最安全。',
             'feedback': '不碰确实躲开了这一份风险，但你也同时放弃了它带来的机会。这不是错，是一个选择——要知道自己付了什么代价。'},
            {'key': 'size', 'text': '既然多了一个变量，那就别把全部钱放在这里。',
             'feedback': '这是这一章真正想说的话：你控制不了汇率，但你能控制**自己在它上面放多少钱**。这也是后面几章要展开的「仓位」与「分散」。'},
            {'key': 'watch', 'text': '先看清它是怎么动的，再决定放多少。',
             'feedback': '对——先看得懂，再决定下多少注。你把这一章学成了「观察」，这比记住任何一个数字都有用。'},
        ],
    },
}

FX_ROWS = [
    {'key': 'hkd', 'label': 'HKD → CNY', 'source': 'fx.rates.HKD'},
    {'key': 'usd', 'label': 'USD → CNY', 'source': 'fx.rates.USD'},
    {'key': 'usdt', 'label': 'USDT → CNY', 'source': 'fx.rates.USDT'},
    {'key': 'base', 'label': '基准货币', 'source': 'fx.base'},
]

PANELS = {
    'panel.fxPanel': {
        'id': 'panel.fxPanel',
        'kind': 'kvRows',
        'title': '今日汇率',
        'blocks': [
            {'type': 'text', 'id': '5.1.head', 'label': '',
             'text': '你打开券商 App，发现香港那一栏是灰的——不是你不敢买，是你**没有港币**。',
             },
            {'type': 'text', 'id': '5.1.body', 'label': '',
             'text': '老周只回了三个字：先换钱。',
             },
            {'type': 'kvRows', 'id': '5.1.rates', 'rows': FX_ROWS},
            {'type': 'text', 'id': '5.1.body2', 'label': '',
             'text': '这就是**计价货币**：同一个东西，用不同的钱算，价钱就不一样。你账上的钱是人民币，而港股是按港币标价的——中间那道换算，从今天起会一直跟着你。',
             },
        ],
        'actions': [{'id': '5.1.closePanel', 'label': '看懂了'}],
    },
    'panel.hkLots': {
        'id': 'panel.hkLots',
        'kind': 'kvRows',
        'title': '港股每手股数不一样',
        'blocks': [
            {'type': 'text', 'id': '5.2.head', 'label': '',
             'text': '在香港，1 手是多少股，**每一只都不一样**。在同一张列表里，有的 1 手是 100 股，有的是 200，有的是 500。',
             },
            {'type': 'kvRows', 'id': '5.2.rows', 'rows': [
                {'key': 'tx', 'label': '腾讯控股 00700', 'value': '1 手 = 100 股'},
                {'key': 'mt', 'label': '美团-W 03690', 'value': '1 手 = 100 股'},
                {'key': 'xm', 'label': '小米集团-W 01810', 'value': '1 手 = 200 股'},
                {'key': 'hkex', 'label': '香港交易所 00388', 'value': '1 手 = 100 股'},
                {'key': 'aia', 'label': '友邦保险 01299', 'value': '1 手 = 500 股'},
            ]},
            {'type': 'text', 'id': '5.2.body', 'label': '',
             'text': '所以「这只买不买得起」不能只看股价——得看**股价 × 它自己的每手股数**。在自选列表里找一只「1 手你买得起」的，选中它。',
             },
        ],
        'actions': [{'id': '5.2.closePanel', 'label': '看完了'}],
    },
    'panel.noLimit': {
        'id': 'panel.noLimit',
        'kind': 'text',
        'title': '没有任何东西拦住它',
        'blocks': [
            {'type': 'text', 'id': '5.4.head', 'label': '',
             'text': '今天港股跌了不少。你可能会想起第二章那两条规则——涨跌停、T+1。',
             },
            {'type': 'text', 'id': '5.4.body', 'label': '',
             'text': '港股**没有涨跌停**。它今天可以跌 8%，明天可以再跌 8%，没有任何东西替你在某个价位喊停。这不是它更坏，只是它不设这道墙。',
             },
            {'type': 'text', 'id': '5.4.body2', 'label': '',
             'text': '它会用另一种方式提醒你：**熔断**。当跌到一定程度，市场会停下来歇一会儿——那是「暂停」，不是「到底了」。',
             },
            {'type': 'text', 'id': '5.4.body3', 'label': '',
             'text': '没有墙的市场，波动更真实，也更需要你自己知道自己能承受多少。',
             },
        ],
        'actions': [{'id': '5.4.closePanel', 'label': '知道了'}],
    },
    'panel.fxSplit': {
        'id': 'panel.fxSplit',
        'kind': 'kvRows',
        'title': '这笔浮盈浮亏，是谁写的',
        'blocks': [
            {'type': 'text', 'id': '5.5.head', 'label': '',
             'text': '你的港股未必跌了，但你的账户变少了。把它拆开看：',
             },
            {'type': 'kvRows', 'id': '5.5.rows', 'rows': [
                {'key': 'price', 'label': '股价贡献', 'source': 'fxSplit.priceContribution'},
                {'key': 'fx', 'label': '汇率贡献', 'source': 'fxSplit.fxContribution'},
                {'key': 'total', 'label': '合计（浮动盈亏）', 'source': 'fxSplit.total'},
            ]},
            {'type': 'text', 'id': '5.5.body', 'label': '',
             'text': '两行相加，恰好等于合计——这不是巧合，是它们本来就是同一笔钱的两个来源。**股价贡献**是你选的公司；**汇率贡献**是你换钱的那一天和今天之间的价差。',
             },
        ],
        'actions': [{'id': '5.5.closePanel', 'label': '分清了'}],
    },
    'panel.momQuestion': {
        'id': 'panel.momQuestion',
        'kind': 'text',
        'title': '我妈的问题',
        'blocks': [
            {'type': 'text', 'id': '5.6.head', 'label': '',
             'text': '你妈在电话里问：「我听说港币跌了，你那钱是不是就少了？」',
             },
            {'type': 'text', 'id': '5.6.body', 'label': '',
             'text': '这个问题你答不上来——直到今天。',
             },
            {'type': 'choiceGroup', 'choiceId': '5.6.mom'},
        ],
        'actions': [{'id': '5.6.closePanel', 'label': '想好了'}],
    },
    'panel.confirm': copy.deepcopy(c2['panels']['panel.confirm']),
    'panel.settlement': copy.deepcopy(c2['panels']['panel.settlement']),
    'panel.extraSegment': copy.deepcopy(c2['panels']['panel.extraSegment']),
}
PANELS['panel.confirm']['id'] = 'panel.confirm'

# 结算面板追加「股价贡献 / 汇率贡献」两行（GDD 第五章：与 5.5 复盘共用同一次拆分）
PANELS['panel.settlement']['blocks'].append({
    'type': 'kvRows', 'id': '5.end.split', 'rows': [
        {'key': 'p', 'label': '其中：股价贡献', 'source': 'fxSplit.priceContribution'},
        {'key': 'f', 'label': '其中：汇率贡献', 'source': 'fxSplit.fxContribution'},
    ],
})


def mentor(timing, line, concept=None):
    return {'timing': timing, 'speaker': 'face', 'conceptKey': concept, 'line': line}


BEATS = [
    {
        'id': '5.1', 'title': '先换钱', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterOpen', '这一章多加了一个变量。前四章你只需要看公司，从今天起，你还得看钱本身。'),
            mentor('firstConcept', '你想买腾讯。可你打开一看，香港那一栏是灰的——不是你不敢买，是你没有港币。先换钱。', '汇率'),
        ],
        'panels': ['panel.fxPanel'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '5.1.readFx', 'panelId': 'panel.fxPanel', 'count': 5,
             'mustClose': True, 'label': '看懂汇率面板上的每一行'},
        ],
        'concepts': ['汇率', '计价货币', '汇率折算'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '5.2', 'title': '一手不一定是一百股', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '在香港，1 手是多少股，每一只都不一样。别用 A 股的习惯去猜。', '每手股数不固定'),
        ],
        'panels': ['panel.hkLots'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '5.2.readLots', 'panelId': 'panel.hkLots', 'count': 5,
             'mustClose': True, 'label': '逐只看清每手股数'},
            {'kind': 'select', 'id': '5.2.pickAffordable', 'rule': 'affordable',
             'label': '在港股列表里选一只「1 手我买得起」的'},
        ],
        'concepts': ['每手股数不固定', '港股'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '5.3', 'title': '今天可以卖', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '买一只港股。然后——今天就把它卖掉试试。', 'T+0'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'submit', 'id': '5.3.buy', 'expect': {'accepted': True, 'side': 'buy'},
             'label': '买入一只港股'},
            {'kind': 'submit', 'id': '5.3.sell', 'expect': {'accepted': True, 'side': 'sell'},
             'label': '当天把它卖掉（A 股做不到的事）'},
        ],
        'concepts': ['T+0'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '5.4', 'title': '没有涨停板的一天', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '今天没有墙。', '无涨跌停'),
        ],
        'panels': ['panel.noLimit'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'advanceDay', 'id': '5.4.advance', 'label': '进入下一交易日，看看会发生什么',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '5.4.read', 'panelId': 'panel.noLimit', 'count': 4,
             'mustClose': True, 'label': '看清「没有墙」意味着什么'},
        ],
        'concepts': ['无涨跌停', '波动率', '熔断'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': 'M01',
    },
    {
        'id': '5.5', 'title': '汇率咬了你一口', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '你的港股未必跌了。但你的账户变少了。为什么？', '汇率风险'),
        ],
        'panels': ['panel.fxSplit'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'advanceDay', 'id': '5.5.advance', 'label': '进入下一交易日',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '5.5.readSplit', 'panelId': 'panel.fxSplit', 'count': 4,
             'mustClose': True, 'label': '把这一笔拆成「股价」与「汇率」两行'},
            {'kind': 'choice', 'id': '5.5.answer', 'choiceId': '5.5.split',
             'label': '回答：哪一部分来自汇率'},
        ],
        'concepts': ['汇率风险', '汇率折算'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '5.6', 'title': '我妈的问题', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '你现在答得上来了。', '汇率折算'),
        ],
        'panels': ['panel.momQuestion'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'choice', 'id': '5.6.answer', 'choiceId': '5.6.mom',
             'label': '回答妈妈的问题'},
        ],
        'concepts': ['汇率风险'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '5.7', 'title': '章末', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterClose', '同一个公司，在不同的地方卖，命运不一样。世界变大了——变量也变多了。'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'choice', 'id': '5.7.end', 'choiceId': '5.end',
             'label': '回答老周的最后一问'},
        ],
        'concepts': ['风险与收益匹配', '分散投资'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
        'endOfChapter': True,
    },
]

c5 = {
    'id': 5,
    'name': '港币的账，美元的梦',
    'implemented': True,
    'situation': '你想买腾讯，发现自己没有港币',
    'preview': '先换钱。',
    'rated': True,
    'noScoreLabel': None,
    'clearResidualsOnEnter': True,
    'unlocks': {'instruments': ['00700', '03690', '01810', '00388', '01299']},
    'goalCard': {
        'title': '港币的账，美元的梦',
        'teach': '这一章结束，你要能说清：为什么「股价没跌，我的钱却少了」；以及一笔跨币种的盈亏，怎么拆成股价和汇率两份。',
        'graded': True,
    },
    'savePoints': ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'],
    'directedEvents': ['M03'],
    'pinnedEvents': ['M03'],
    'directedQueue': ['M03'],
    'choices': CHOICES,
    'panels': PANELS,
    'chapterEnd': {
        'settlementPanelId': 'panel.settlement',
        'confirmPanelId': 'panel.confirm',
        'extraPanelId': 'panel.extraSegment',
        'understandingChoiceId': '5.end',
    },
    'settlement': settlement,
    'beats': BEATS,
}

d['chapters'] = [c for c in d['chapters'] if c['id'] != 5] + [c5]
d['chapters'].sort(key=lambda c: c['id'])
io.open(PATH, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('第五章已写入：', len(BEATS), '拍；面板', len(PANELS), '个；选项组', len(CHOICES), '个')
