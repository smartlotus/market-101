# -*- coding: utf-8 -*-
"""写入第六、七章。内容依据 GDD 对应小节。"""
import io
import json
import copy

PATH = 'config/chapters.json'
d = json.load(io.open(PATH, encoding='utf-8'))
c2 = [c for c in d['chapters'] if c['id'] == 2][0]


def mentor(timing, line, concept=None):
    return {'timing': timing, 'speaker': 'face', 'conceptKey': concept, 'line': line}


def base_panels():
    return {
        'panel.confirm': copy.deepcopy(c2['panels']['panel.confirm']),
        'panel.settlement': copy.deepcopy(c2['panels']['panel.settlement']),
        'panel.extraSegment': copy.deepcopy(c2['panels']['panel.extraSegment']),
    }


# ══════════════════════════════ 第六章 ══════════════════════════════
CH6_CHOICES = {
    '6.1.session': {
        'id': '6.1.session',
        'question': '美股 21:30 开盘，那个 21:30 是什么时间？',
        'conceptKey': '时差',
        'correctKey': 'beijingNight',
        'options': [
            {'key': 'beijingMorning', 'text': '北京时间上午——那会儿我在上班。',
             'feedback': '不对。看表：21:30 是**北京时间晚上**。美股的开盘时间，正好是你的睡前。这也是为什么那么多人熬夜——不是意志力问题，是时区问题。'},
            {'key': 'beijingNight', 'text': '北京时间晚上 21:30——那不是我要睡觉的时候吗？',
             'feedback': '对。所以「美股」这件事天生和你的作息打架。这不是你不够自律，是**时差**本身。盘前盘后还能更长，但那更是熬夜。'},
        ],
    },
    '6.3.fee': {
        'id': '6.3.fee',
        'question': '同一笔一万元的交易，两边的费用你看出什么了？',
        'conceptKey': '平台费',
        'correctKey': 'structure',
        'options': [
            {'key': 'cheaper', 'text': '美股更便宜——它零佣金。',
             'feedback': '「零佣金」是它宣传的那一面。翻回明细看另一面：还有一笔**固定的平台费**。小额交易时，这笔固定费用占的比例反而更高——「免费」通常只是换了个地方收。'},
            {'key': 'structure', 'text': '不是谁更便宜，是**收费的方式不一样**：一边按比例、一边是固定的一笔。',
             'feedback': '对。A 股按金额比例收，美股按笔固定收。所以「哪边便宜」取决于你交易多大——买得越小，固定费用越吃亏。这叫**费率结构差异**。'},
        ],
    },
    '6.6.sleep': {
        'id': '6.6.sleep',
        'question': '你昨天睡得挺好，市场替你做了一晚上的决定。你怎么想？',
        'conceptKey': '止盈止损',
        'correctKey': None,
        'options': [
            {'key': 'uncomfortable', 'text': '有点不舒服——我的钱在动，可我不在场。',
             'feedback': '这份不舒服是有用的。它提示你一件事：如果你承受不了「睡觉时它在动」，那你能做的不是不睡，而是**少放一点**，或者**提前想好什么情况下要动手**。后者就是你将来会学到的止损。'},
            {'key': 'fine', 'text': '还好——反正我也管不了，长期看它自己会走。',
             'feedback': '如果你真的想清楚了「我长期持有、不看短期」，这个心态是成立的。但要注意：长期持有是**你主动选的**，不是「管不了所以不管」。这两者结果可能一样，过程完全不同。'},
        ],
    },
    '6.end': {
        'id': '6.end',
        'question': '这一章不教你技术。留一句话给你自己：',
        'conceptKey': '长期持有 vs 择时',
        'correctKey': None,
        'options': [
            {'key': 'awake', 'text': '钱不睡觉，但我得睡。',
             'feedback': '记住它。这句话比任何指标都值钱——因为它决定你能不能在这条路上待得久。'},
            {'key': 'boundary', 'text': '投资得在我的生活里有个位置，而不是反过来。',
             'feedback': '这是同一件事的另一种说法，而且更准确。你已经开始把自己当**长期的人**看了。'},
        ],
    },
}

CH6_PANELS = base_panels()
CH6_PANELS.update({
    'panel.timezone': {
        'id': 'panel.timezone',
        'kind': 'kvRows',
        'title': '北京时间对照表',
        'blocks': [
            {'type': 'text', 'id': '6.1.head', 'label': '',
             'text': '北京时间凌晨一点，A 股早就休市了，但大洋彼岸的屏幕刚亮。'},
            {'type': 'kvRows', 'id': '6.1.rows', 'rows': [
                {'key': 'cn', 'label': 'A 股 / 港股（北京时间）', 'value': '09:30 – 15:00 / 09:30 – 16:00'},
                {'key': 'us', 'label': '美股（北京时间，夏令）', 'value': '21:30 – 次日 04:00'},
                {'key': 'pre', 'label': '美股盘前 / 盘后', 'value': '盘前约 16:00 起；盘后约 04:00 后 —— 更晚'},
                {'key': 'crypto', 'label': '加密货币', 'value': '7×24，永不休市（下一章去看）'},
            ]},
            {'type': 'text', 'id': '6.1.body', 'label': '',
             'text': '所以「炒美股」在中国时区里，是一件**天生和作息打架**的事。这不是自律问题，是地理问题。'},
        ],
        'actions': [{'id': '6.1.closePanel', 'label': '看懂了'}],
    },
    'panel.feeCompare': {
        'id': 'panel.feeCompare',
        'kind': 'compare',
        'title': '同一笔钱，两边怎么收',
        'blocks': [{
            'type': 'compare',
            'id': '6.3.cmp',
            'leftLabel': 'A 股（一万元一笔）',
            'rightLabel': '美股（一万元一笔）',
            'rows': [
                {'key': 'comm', 'label': '佣金',
                 'left': '成交额 × 0.025%，最低 5 元。',
                 'right': '**零佣金**。这一栏是 0。',
                 'note': '这就是「零佣金」宣传的那个零。'},
                {'key': 'tax', 'label': '印花税 / 过户费',
                 'left': '卖出收印花税 0.05%；过户费双向 0.001%。',
                 'right': '没有印花税，也没有过户费。'},
                {'key': 'platform', 'label': '平台费',
                 'left': '没有这一项。',
                 'right': '**每笔固定 0.99 美元**，和金额大小无关。',
                 'note': '固定费用对**小额**最不友好：买 100 美元也是 0.99，等于 1% 的成本。'},
                {'key': 'shape', 'label': '收费的形状',
                 'left': '按**比例**收——交易越大，交得越多，但占比稳定。',
                 'right': '按**笔数**收——和金额无关，交易越小越吃亏。',
                 'note': '所以「哪边便宜」没有统一答案，取决于你交易多大。'},
                {'key': 'fx', 'label': '别忘了汇率',
                 'left': '本币，没有这一层。',
                 'right': '要用美元，进出各有一次汇率折算——这也是成本。',
                 'note': '上一章刚学过的那个变量，在这里又一次出现。'},
            ],
        }],
        'actions': [{'id': '6.3.closePanel', 'label': '两边都看过了'}],
    },
    'panel.circuitBreaker': {
        'id': 'panel.circuitBreaker',
        'kind': 'text',
        'title': '没有涨停板，但有熔断',
        'blocks': [
            {'type': 'text', 'id': '6.4.head', 'label': '',
             'text': '美股也没有涨跌停。今天它跌得很凶。'},
            {'type': 'text', 'id': '6.4.body', 'label': '',
             'text': '但它有一个**熔断**机制：当跌幅达到一定程度，整个市场会暂停交易一段时间。'},
            {'type': 'text', 'id': '6.4.body2', 'label': '',
             'text': '注意措辞：熔断是**暂停**，不是**止跌**。它给你一段冷静时间，但它不保证之后会反弹——这是很多人误解的地方。'},
        ],
        'actions': [{'id': '6.4.closePanel', 'label': '知道了'}],
    },
    'panel.nightTimeline': {
        'id': 'panel.nightTimeline',
        'kind': 'kvRows',
        'title': '你睡着以后发生了什么',
        'blocks': [
            {'type': 'text', 'id': '6.5.head', 'label': '',
             'text': '你在凌晨下了一单，然后去睡了。第二天早上醒来——'},
            {'type': 'kvRows', 'id': '6.5.rows', 'rows': [
                {'key': 't1', 'label': '你下单的那一刻', 'value': '价格已经反映在盘面上'},
                {'key': 't2', 'label': '你睡着之后', 'value': '市场继续交易，价格继续动'},
                {'key': 't3', 'label': '你醒来时看到的', 'value': '那晚所有变化的结果'},
            ]},
            {'type': 'text', 'id': '6.5.body', 'label': '',
             'text': '关键在最后一行：你看到的是**结果**，不是**过程**。你没有机会在中间做任何决定——这就是「不在场风险」。'},
        ],
        'actions': [{'id': '6.5.closePanel', 'label': '看完了'}],
    },
})

CH6_BEATS = [
    {
        'id': '6.1', 'title': '时差', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterOpen', '这一章外面风大，我先说破：这一章你可能收获不好看。风大的时候，能站稳就算赢。'),
            mentor('firstConcept', '你想买美股。先看清楚它在你的几点。', '交易时段'),
        ],
        'panels': ['panel.timezone'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '6.1.read', 'panelId': 'panel.timezone', 'count': 5,
             'mustClose': True, 'label': '看清各市场的北京时间'},
            {'kind': 'choice', 'id': '6.1.answer', 'choiceId': '6.1.session',
             'label': '回答：美股 21:30 是什么时间'},
        ],
        'concepts': ['交易时段', '时差', '盘前/盘后'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '6.2', 'title': '半股也是股', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '在美股，1 股起，还能买半股。一只你一直觉得「太贵买不起」的公司，现在你买得起了。', '碎股'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'select', 'id': '6.2.select', 'instrumentId': 'AAPL',
             'label': '选中一只美股'},
            {'kind': 'submit', 'id': '6.2.buy', 'expect': {'accepted': True, 'side': 'buy', 'instrumentId': 'AAPL'},
             'label': '买入 0.5 股（碎股）'},
        ],
        'concepts': ['碎股', '美股'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '6.3', 'title': '零佣金？', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '「零佣金」三个字很响。把两边的费用摊开来看。', '平台费'),
        ],
        'panels': ['panel.feeCompare'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '6.3.read', 'panelId': 'panel.feeCompare', 'count': 5,
             'mustClose': True, 'label': '逐项对比两边的费用结构'},
            {'kind': 'choice', 'id': '6.3.answer', 'choiceId': '6.3.fee',
             'label': '回答：你看出什么了'},
        ],
        'concepts': ['零佣金', '平台费', '交易成本'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '6.4', 'title': '没有涨停板，但有熔断', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '今天外面风很大。', '熔断'),
        ],
        'panels': ['panel.circuitBreaker'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'advanceDay', 'id': '6.4.advance', 'label': '进入下一交易日',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '6.4.read', 'panelId': 'panel.circuitBreaker', 'count': 3,
             'mustClose': True, 'label': '看清熔断是什么、不是什么'},
        ],
        'concepts': ['无涨跌停', '熔断', '波动率'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': 'B01',
    },
    {
        'id': '6.5', 'title': '你睡着的这一夜', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '去睡吧。明天早上再看。', '止盈止损'),
        ],
        'panels': ['panel.nightTimeline'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'advanceDay', 'id': '6.5.sleep', 'label': '去睡觉（推进一天）',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '6.5.read', 'panelId': 'panel.nightTimeline', 'count': 4,
             'mustClose': True, 'label': '回放你睡着那晚发生的事'},
        ],
        'concepts': ['止盈止损'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': 'M01',
    },
    {
        'id': '6.6', 'title': '钱不睡觉', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '你昨天睡得挺好。市场替你做了一晚上的决定。', '长期持有 vs 择时'),
        ],
        'panels': ['panel.sleepQuestion'] if False else [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'choice', 'id': '6.6.answer', 'choiceId': '6.6.sleep',
             'label': '回答：你怎么想'},
        ],
        'concepts': ['长期持有 vs 择时', '风险与收益匹配'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '6.7', 'title': '章末', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterClose', '这一章我不教你任何技术。我只想让你知道：钱不睡觉，但你得睡。你把这句话记住，比记住任何一个指标都值钱。'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'choice', 'id': '6.7.end', 'choiceId': '6.end',
             'label': '留一句话给自己'},
        ],
        'concepts': ['长期持有 vs 择时'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
        'endOfChapter': True,
    },
]

ch6_settlement = copy.deepcopy(c2['settlement'])
ch6_settlement['extraSegments']['advanced']['body'] = [
    '这一章外面风大，而你没有被打乱。',
    '你做到的事很简单，但很少人做得到：**你知道自己不在场**，所以你放的钱不多，也没有在醒来之后追着价格跑。',
    '老周说：跑赢市场不稀奇，风大的时候少输一点才稀奇。',
]
ch6_settlement['extraSegments']['remedial']['body'] = [
    '这一章外面风大，市场跌得比你想的凶。',
    '先分清一件事：**你亏的钱有多少是市场给的，有多少是你自己动作给的**。',
    '如果是市场跌了、你也跟着跌了——那不是你的错，是这一章本来就风大。你要学的是：风大的时候，**你能控制的是放多少钱，而不是风什么时候停**。',
    '你还做对了一件事：你没在半夜爬起来操作。钱不睡觉，但你得睡——这句话这一章已经说过了，现在你亲身体会到了。',
]

c6 = {
    'id': 6,
    'name': '凌晨三点的红与绿',
    'implemented': True,
    'situation': '你开始熬夜，发现美股一股就能买',
    'preview': '一股也能买。',
    'rated': True,
    'noScoreLabel': None,
    'clearResidualsOnEnter': True,
    'unlocks': {'instruments': ['AAPL', 'TSLA', 'NVDA']},
    'goalCard': {
        'title': '凌晨三点的红与绿',
        'teach': '这一章不教技术。你要带走的是边界感：投资得在你的生活里有个位置，而不是反过来。',
        'graded': True,
    },
    'savePoints': ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7'],
    'directedEvents': ['B01', 'M01'],
    'pinnedEvents': [],
    'directedQueue': [],
    'choices': CH6_CHOICES,
    'panels': CH6_PANELS,
    'chapterEnd': {
        'settlementPanelId': 'panel.settlement',
        'confirmPanelId': 'panel.confirm',
        'extraPanelId': 'panel.extraSegment',
        'understandingChoiceId': '6.end',
    },
    'settlement': ch6_settlement,
    'beats': CH6_BEATS,
}


# ══════════════════════════════ 第七章 ══════════════════════════════
CH7_CHOICES = {
    '7.2.baseline': {
        'id': '7.2.baseline',
        'question': '这笔钱，你能接受亏掉多少？（没有正确答案，这是给你自己写的）',
        'conceptKey': '本金安全',
        'correctKey': None,
        'options': [
            {'key': '500', 'text': '¥500 —— 亏到这个数我就停手。',
             'feedback': '记下了：¥500。它不会影响你的分数，但章末我会把它和你这一章真实的回撤摆在一起。'},
            {'key': '1000', 'text': '¥1,000 —— 这是我大概能接受的。',
             'feedback': '记下了：¥1,000。它不会影响你的分数，但章末我会把它和你这一章真实的回撤摆在一起。'},
            {'key': '2500', 'text': '¥2,500 —— 一半，再多我会睡不着。',
             'feedback': '记下了：¥2,500。它不会影响你的分数，但章末我会把它和你这一章真实的回撤摆在一起。'},
            {'key': '5000', 'text': '¥5,000 —— 这就是闲钱，全亏了也不影响生活。',
             'feedback': '记下了：¥5,000。写大不扣分，写小也不加分——重要的是这个数是你自己写的，而且你会在章末看到它。'},
        ],
    },
    '7.3.vol': {
        'id': '7.3.vol',
        'question': '和 ETF 比，加密的波动你看出什么了？',
        'conceptKey': '波动率',
        'correctKey': 'bigger',
        'options': [
            {'key': 'same', 'text': '差不多吧，都是涨涨跌跌。',
             'feedback': '再看一眼幅度：ETF 一天动一两个点，加密一天能动十几个点——**同样一笔钱，感受完全不同**。这叫波动率。'},
            {'key': 'bigger', 'text': '大得多——同样的钱，这里的上下幅度是 ETF 的好几倍。',
             'feedback': '对。这也意味着：你在 ETF 上能扛住的仓位，放到这里可能扛不住。**仓位要跟着波动率改**，这是后面那句「只投了多少」的由来。'},
        ],
    },
    '7.6.check': {
        'id': '7.6.check',
        'question': '这次波动，有没有超出你写下的那个数？',
        'conceptKey': '纪律',
        'correctKey': None,
        'options': [
            {'key': 'within', 'text': '没有超出——还在我写的范围内。',
             'feedback': '那你这一章是**按自己的承诺过的**。继续这样：数字不是用来预测的，是用来决定你放多少的。'},
            {'key': 'beyond', 'text': '超出了——比我写的更难受。',
             'feedback': '那就把这句话记下来：**你写下的数字应该是你能睡着觉的数，而不是你想赚到的数**。超了不是失败，是校准——下次把仓位调小，直到它落在你写的范围内。'},
        ],
    },
    '7.end': {
        'id': '7.end',
        'question': '你同学晒的是赢的那一次。你想到了什么？',
        'conceptKey': '幸存者偏差',
        'correctKey': None,
        'options': [
            {'key': 'lucky', 'text': '他可能只是运气好，输的那些人不会发截图。',
             'feedback': '你看见了一个很关键的东西：**你只能看到活下来的人**。这不是说他在骗你，是他的样本里少了你看不到的那部分——这叫幸存者偏差。'},
            {'key': 'mine', 'text': '刺激是真的，但我知道我为什么只买了这么多。',
             'feedback': '这句话比任何一句「别碰加密」都更有用。你不必远离高风险的东西，你只需要**带着自己的底线靠近它**。'},
        ],
    },
}

CH7_PANELS = base_panels()
CH7_PANELS.update({
    'panel.weekend': {
        'id': 'panel.weekend',
        'kind': 'kvRows',
        'title': '同一个周末，两边的屏幕',
        'blocks': [
            {'type': 'text', 'id': '7.1.head', 'label': '',
             'text': '你推进到一个周末。'},
            {'type': 'kvRows', 'id': '7.1.rows', 'rows': [
                {'key': 'cn', 'label': 'A 股', 'value': '休市'},
                {'key': 'hk', 'label': '港股', 'value': '休市'},
                {'key': 'us', 'label': '美股', 'value': '休市'},
                {'key': 'crypto', 'label': '加密货币', 'value': '**还在跳** —— 它没有周末'},
            ]},
            {'type': 'text', 'id': '7.1.body', 'label': '',
             'text': '你第一次看见这件事：**有一个地方，永远不关门**。方便，也意味着你永远找不到一个「它停下来」的时刻——那要靠你自己给自己设。'},
        ],
        'actions': [{'id': '7.1.closePanel', 'label': '看完了'}],
    },
    'panel.volatility': {
        'id': 'panel.volatility',
        'kind': 'compare',
        'title': '同样一笔钱，两边的心跳',
        'blocks': [{
            'type': 'compare',
            'id': '7.3.cmp',
            'leftLabel': 'ETF（一篮子股票）',
            'rightLabel': '加密货币',
            'rows': [
                {'key': 'amp', 'label': '单日波动幅度',
                 'left': '通常一两个百分点。',
                 'right': '可以十几、二十几个百分点。',
                 'note': '这个差距不是「更刺激」，是**同样的钱在你心里的重量不同**。'},
                {'key': 'limit', 'label': '涨跌停',
                 'left': 'A 股 ETF 有 ±10%。',
                 'right': '没有。也没有熔断替你喊停。'},
                {'key': 'guard', 'label': '谁在看着',
                 'left': '交易所、清算、监管，一层一层。',
                 'right': '**没有中央监管**。这是它便宜、自由、也危险的原因。'},
                {'key': 'size', 'label': '所以该放多少',
                 'left': '波动小，可以放多一点。',
                 'right': '波动大，**同样的钱感受完全不同**——所以要么少放，要么别放。'},
            ],
        }],
        'actions': [{'id': '7.3.closePanel', 'label': '看完了'}],
    },
    'panel.concentration': {
        'id': 'panel.concentration',
        'kind': 'text',
        'title': '只投了多少',
        'blocks': [
            {'type': 'text', 'id': '7.5.head', 'label': '',
             'text': '一条消息让加密剧烈波动了一次。'},
            {'type': 'text', 'id': '7.5.body', 'label': '',
             'text': '现在看你的账户：这次波动，在你的总资产里占了多少？'},
            {'type': 'text', 'id': '7.5.body2', 'label': '',
             'text': '如果你只投了一小笔，这次波动就是个数字；如果你把大部分钱放进来——它就会变成一件事。**同一个行情，对不同仓位的人来说，是完全不同的两个世界。**这就是集中度风险。'},
        ],
        'actions': [{'id': '7.5.closePanel', 'label': '明白了'}],
    },
    'panel.baselineCallback': {
        'id': 'panel.baselineCallback',
        'kind': 'kvRows',
        'title': '回到你写下的那个数字',
        'blocks': [
            {'type': 'text', 'id': '7.6.head', 'label': '',
             'text': '老周把你在这一章开头写下的数字重新提了出来。'},
            {'type': 'kvRows', 'id': '7.6.rows', 'rows': [
                {'key': 'wrote', 'label': '你写下的底线', 'source': 'baselineAmount'},
                {'key': 'real', 'label': '这一章真实的最大回撤', 'source': 'chapterMaxDrawdown'},
            ]},
            {'type': 'text', 'id': '7.6.body', 'label': '',
             'text': '两个数字摆在一起，我不加评语。你只要回答一件事：这次波动，有没有超出你写下的那个数？'},
            {'type': 'choiceGroup', 'choiceId': '7.6.check'},
        ],
        'actions': [{'id': '7.6.closePanel', 'label': '我想完了'}],
    },
    'panel.baselineWrite': {
        'id': 'panel.baselineWrite',
        'kind': 'text',
        'title': '先写下你的底线',
        'blocks': [
            {'type': 'text', 'id': '7.2.head', 'label': '',
             'text': '你大学同学在群里晒了一张翻倍的截图，配文「这还用上班？」。私聊里他劝你也来：「你的钱放着也是放着。」'},
            {'type': 'text', 'id': '7.2.body', 'label': '',
             'text': '你手上有 ¥5,000 是真的可以亏掉的闲钱。你打算进去试试。'},
            {'type': 'text', 'id': '7.2.body2', 'label': '',
             'text': '老周没有阻止你。他只让你做一件事：**先写下你最多能接受亏多少，然后才能下单。**'},
            {'type': 'choiceGroup', 'choiceId': '7.2.baseline'},
        ],
        'actions': [{'id': '7.2.closePanel', 'label': '写好了'}],
    },
})

CH7_BEATS = [
    {
        'id': '7.1', 'title': '全天不休', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterOpen', '这一章我不拦你。但进去之前，我要你先做一件事——先写下一个数。'),
            mentor('firstConcept', '先看一件小事：现在是周末。', '7×24'),
        ],
        'panels': ['panel.weekend'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'advanceDay', 'id': '7.1.advance', 'label': '推进几日，走到一个周末',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '7.1.read', 'panelId': 'panel.weekend', 'count': 4,
             'mustClose': True, 'label': '看清「永不休市」是什么意思'},
        ],
        'concepts': ['加密货币', '7×24'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '7.2', 'title': '先写下你的底线', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '这笔钱你能接受亏掉多少？写下来，然后才能下单。', '本金安全'),
        ],
        'panels': ['panel.baselineWrite'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'choice', 'id': '7.2.baseline', 'choiceId': '7.2.baseline',
             'label': '写下自己的底线数字'},
        ],
        'concepts': ['本金安全', '仓位管理'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '7.3', 'title': '波动不一样', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '同样一笔钱，放在这里，心跳不一样。', '波动率'),
        ],
        'panels': ['panel.volatility'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '7.3.read', 'panelId': 'panel.volatility', 'count': 4,
             'mustClose': True, 'label': '逐项对比两边的波动'},
            {'kind': 'choice', 'id': '7.3.answer', 'choiceId': '7.3.vol',
             'label': '回答：你看出什么了'},
        ],
        'concepts': ['波动率'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '7.4', 'title': '第一次自己买', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '买一小笔。多大由你决定——但记住你刚写下的那个数。', '加密货币'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'select', 'id': '7.4.select', 'instrumentId': 'BTC',
             'label': '选中比特币'},
            {'kind': 'submit', 'id': '7.4.buy', 'expect': {'accepted': True, 'side': 'buy', 'instrumentId': 'BTC'},
             'label': '买入一小笔（金额由你决定）'},
        ],
        'concepts': ['加密货币'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '7.5', 'title': '只投了多少', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '看你的账户——这次波动，在你的总资产里占了多少？', '集中度风险'),
        ],
        'panels': ['panel.concentration'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'advanceDay', 'id': '7.5.advance', 'label': '推进一天，看它怎么动',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '7.5.read', 'panelId': 'panel.concentration', 'count': 3,
             'mustClose': True, 'label': '看看这次波动占了你的多少'},
        ],
        'concepts': ['集中度风险', '风险与收益匹配'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': 'I03',
    },
    {
        'id': '7.6', 'title': '回到那个数字', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '你在这个章开头写了一个数。现在把它拿出来对一下。', '纪律'),
        ],
        'panels': ['panel.baselineCallback'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '7.6.read', 'panelId': 'panel.baselineCallback', 'count': 3,
             'mustClose': True, 'label': '把你的底线与真实回撤并排看'},
            {'kind': 'choice', 'id': '7.6.answer', 'choiceId': '7.6.check',
             'label': '回答：有没有超出你写的数'},
        ],
        'concepts': ['纪律', '仓位管理'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '7.7', 'title': '章末', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterClose', '你同学晒的是赢的那一次。他没晒的是输的那九次。'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'choice', 'id': '7.7.end', 'choiceId': '7.end',
             'label': '回答老周的最后一问'},
        ],
        'concepts': ['幸存者偏差'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
        'endOfChapter': True,
    },
]

ch7_settlement = copy.deepcopy(c2['settlement'])
# 结算面板并排「你写下的数字」与「真实最大回撤」（GDD 第七章：全剧唯一一次让自我承诺与真实数字对撞）
ch7_settlement['baselineRowLabel'] = '你写下的底线 / 真实最大回撤'
CH7_PANELS['panel.settlement']['blocks'].append({
    'type': 'kvRows', 'id': '7.end.baseline', 'rows': [
        {'key': 'wrote', 'label': '你写下的底线', 'source': 'baselineAmount'},
        {'key': 'real', 'label': '这一章真实的最大回撤', 'source': 'chapterMaxDrawdown'},
    ],
})
ch7_settlement['extraSegments']['advanced']['body'] = [
    '这一章你主动走进了一个高波动的地方，然后**带着自己的数字出来了**。',
    '你做到的最重要的一件事不是赚了多少，而是：你没有让一次刺激改变你对钱的安排。',
    '老周说：能反复做这件事的人，才配得上「长期」这两个字。',
]
ch7_settlement['extraSegments']['remedial']['body'] = [
    '加密的波动比你想的更大，这一章数字不好看。',
    '先做一件事：把你在章首写下的那个数，和真实回撤摆在一起看。',
    '**如果你写的数比真实回撤大，那这一章你其实没有违背自己的承诺**——难看不等于做错，风大不等于你不会开船。',
    '如果是反过来，那答案也很清楚：不是这个市场不能碰，是你放的钱超过了你能睡着觉的量。**下一次把它调小，就这么简单。**',
]

c7 = {
    'id': 7,
    'name': '24 小时的赌桌',
    'implemented': True,
    'situation': '同学晒了翻倍截图，劝你也来',
    'preview': '先写下你能亏多少。',
    'rated': True,
    'noScoreLabel': None,
    'clearResidualsOnEnter': True,
    'unlocks': {'instruments': ['BTC', 'ETH']},
    'baselineChoiceId': '7.2.baseline',
    'goalCard': {
        'title': '24 小时的赌桌',
        'teach': '这一章不教你远离高风险。它教你带着自己的底线靠近任何东西——先写下你能亏多少，再决定放多少。',
        'graded': True,
    },
    'savePoints': ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7'],
    'directedEvents': ['I03', 'C05', 'P03'],
    'pinnedEvents': [],
    'directedQueue': [],
    'choices': CH7_CHOICES,
    'panels': CH7_PANELS,
    'chapterEnd': {
        'settlementPanelId': 'panel.settlement',
        'confirmPanelId': 'panel.confirm',
        'extraPanelId': 'panel.extraSegment',
        'understandingChoiceId': '7.end',
    },
    'settlement': ch7_settlement,
    'beats': CH7_BEATS,
}

d['chapters'] = [c for c in d['chapters'] if c['id'] not in (6, 7)] + [c6, c7]
d['chapters'].sort(key=lambda c: c['id'])
io.open(PATH, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('第六章', len(CH6_BEATS), '拍；第七章', len(CH7_BEATS), '拍')
