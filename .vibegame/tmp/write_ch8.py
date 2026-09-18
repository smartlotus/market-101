# -*- coding: utf-8 -*-
"""写入第八章（期权）。内容依据 GDD `### 第八章 · 一张会过期的合约`。"""
import io
import json
import copy

PATH = 'config/chapters.json'
d = json.load(io.open(PATH, encoding='utf-8'))
c2 = [c for c in d['chapters'] if c['id'] == 2][0]


def mentor(t, line, c=None):
    return {'timing': t, 'speaker': 'face', 'conceptKey': c, 'line': line}


CHOICES = {
    '8.1.atm': {
        'id': '8.1.atm',
        'question': '哪一档是「平值」？',
        'conceptKey': '平值/实值/虚值',
        'correctKey': 'same',
        'options': [
            {'key': 'high', 'text': '行权价最高的那两档。',
             'feedback': '不是。行权价远离现价的叫**虚值**——那是「现在还不成立」的那些。平值是最贴近现价的那一档。'},
            {'key': 'same', 'text': '行权价最接近现价的那一档。',
             'feedback': '对。平值 = 行权价 ≈ 现价。它同时是时间价值最高的那一档——因为「还有没有可能」这个可能性，在它身上最大。'},
            {'key': 'low', 'text': '行权价最低的那两档。',
             'feedback': '那不是平值，那是**实值**——现在就已经「成立」的那些。它们的权利金里有一大块是内在价值，不会随时间长出来，也不会随时间消失。'},
        ],
    },
    '8.5.tenLots': {
        'id': '8.5.tenLots',
        'question': '如果第 8.3 天你买的不是 1 张，而是 10 张，现在是什么感觉？',
        'conceptKey': '杠杆',
        'correctKey': None,
        'options': [
            {'key': 'regret', 'text': '庆幸——还好我只买了 1 张。',
             'feedback': '这就是这一章想让你带走的。同样的判断、同样的行情，**张数决定了它是「一次体验」还是「一次损失」**。'},
            {'key': 'more', 'text': '那如果它涨了呢？10 张不也是赚 10 倍？',
             'feedback': '对，方向反过来的话也是 10 倍。这就是杠杆的**双向性**——它不偏袒你，它只是放大。所以真正要决定的不是「看不看好」，而是「你能承受多大的错」。'},
        ],
    },
    '8.7.quiz': {
        'id': '8.7.quiz',
        'question': '小考：下面哪一句是对的？',
        'conceptKey': '时间价值衰减',
        'correctKey': 'time',
        'options': [
            {'key': 'safe', 'text': '买期权最多亏掉权利金，所以风险很小。',
             'feedback': '前半句对——买方的最大亏损确实就是权利金，这是它「风险有限」的意思。但「很小」不一定：如果你买了 100 张，这个「有限」也会很大。再想一想。'},
            {'key': 'time', 'text': '标的没动，权利金也会一天天变少，因为时间价值在衰减。',
             'feedback': '对。这是这一章最重要的一句：**时间是买方的对手**。你买入的那一刻起，时间价值就开始单向流逝，标的必须动得足够快、足够多，才追得上它。'},
            {'key': 'expire', 'text': '到期时只要不是实值，权利金会退给我一部分。',
             'feedback': '不会。虚值到期是**作废**——权利金一分不退。你刚刚亲眼看过一次：那张合约是变成零的，不是退回一半。再想一想。'},
        ],
    },
    '8.end': {
        'id': '8.end',
        'question': '老周说「这个，我会怕」。你现在的感觉是——',
        'conceptKey': '杠杆',
        'correctKey': None,
        'options': [
            {'key': 'afraid', 'text': '确实吓人，我大概不会碰。',
             'feedback': '怕是合理的，但「不碰」不是唯一答案。你更该带走的是：**知道自己怕什么**——你怕的是「它快」，那你就永远只放很少的仓位。'},
            {'key': 'respect', 'text': '我知道它是什么了，所以我不会随便用它。',
             'feedback': '这就是敬畏——比恐惧更有用。恐惧会让你错过，敬畏会让你用对。'},
        ],
    },
}

PANELS = {
    'panel.confirm': copy.deepcopy(c2['panels']['panel.confirm']),
    'panel.settlement': copy.deepcopy(c2['panels']['panel.settlement']),
    'panel.extraSegment': copy.deepcopy(c2['panels']['panel.extraSegment']),
    'panel.chain': {
        'id': 'panel.chain',
        'kind': 'optionChain',
        'title': '期权链',
        'blocks': [
            {'type': 'text', 'id': '8.1.head', 'label': '',
             'text': '老周推过来一张纸，上面写着一个日期。他不带笔记本，只说了一句：「最后一样东西。我想让你先害怕它，再理解它。」'},
            {'type': 'optionChain', 'id': '8.1.chain'},
            {'type': 'choiceGroup', 'choiceId': '8.1.atm'},
        ],
        'actions': [{'id': '8.1.closePanel', 'label': '看完了'}],
    },
    'panel.leverage': {
        'id': 'panel.leverage',
        'kind': 'kvRows',
        'title': '用 X 元，控制 Y 元',
        'blocks': [
            {'type': 'text', 'id': '8.2.head', 'label': '',
             'text': '期权最反直觉的地方在这里：你付出的钱，和你「控制」的东西完全不是一个量级。'},
            {'type': 'kvRows', 'id': '8.2.rows', 'rows': [
                {'key': 'l1', 'label': '1 张合约代表', 'value': '10000 份 50ETF'},
                {'key': 'l2', 'label': '名义价值', 'value': '标的价 × 10000 —— 这才是你「控制」的量'},
                {'key': 'l3', 'label': '你实际付出的', 'value': '权利金 —— 只是名义价值的一小部分'},
                {'key': 'l4', 'label': '杠杆', 'value': '名义价值 ÷ 权利金（在上面的链上看得到）'},
            ]},
            {'type': 'text', 'id': '8.2.body', 'label': '',
             'text': '所以同一笔「看懂了的判断」，你用 ETF 做和用期权做，结果会差好几倍——**盈亏都是**。'},
        ],
        'actions': [{'id': '8.2.closePanel', 'label': '看懂了'}],
    },
    'panel.decayWatch': {
        'id': 'panel.decayWatch',
        'kind': 'kvRows',
        'title': '标的没动，钱在掉',
        'blocks': [
            {'type': 'text', 'id': '8.3.head', 'label': '',
             'text': '买一张**虚值**合约，然后什么都不做，只是推进交易日。'},
            {'type': 'text', 'id': '8.3.body', 'label': '',
             'text': '看你的持仓：标的几乎没动，你的权利金却一天比一天少。'},
            {'type': 'kvRows', 'id': '8.3.rows', 'rows': [
                {'key': 'tv', 'label': '时间价值公式', 'value': 'K × 0.02 × (剩余天数 ÷ 生命周期) × 平值因子 × 波动情景'},
                {'key': 'why', 'label': '为什么它会减', 'value': '因为「还有没有可能」这件事，随时间流逝在变少'},
                {'key': 'who', 'label': '谁在收这笔钱', 'value': '卖给你的人。**你是买方，时间是你的对手。**'},
            ]},
        ],
        'actions': [{'id': '8.3.closePanel', 'label': '看到了'}],
    },
    'panel.zero': {
        'id': 'panel.zero',
        'kind': 'kvRows',
        'title': '它归零了',
        'blocks': [
            {'type': 'text', 'id': '8.4.head', 'label': '',
             'text': '这张合约走到了到期日，而且它是**虚值**。'},
            {'type': 'kvRows', 'id': '8.4.rows', 'rows': [
                {'key': 'r1', 'label': '到期时它值多少', 'value': '0 —— 不是「少一点」，是**作废**'},
                {'key': 'r2', 'label': '你能拿回什么', 'value': '什么都没有。权利金一分不退'},
                {'key': 'r3', 'label': '你亏了多少', 'value': '恰好就是你付出的那笔权利金'},
                {'key': 'r4', 'label': '这句话的另一面', 'value': '**买方最大亏损 = 权利金**。不会更多，也不可能更多'},
            ]},
            {'type': 'text', 'id': '8.4.body', 'label': '',
             'text': '你现在见过「东西凭空消失」了。记住这一刻——不是记住损失，是记住「它真的会变成零」。'},
        ],
        'actions': [{'id': '8.4.closePanel', 'label': '记住了'}],
    },
    'panel.exercise': {
        'id': 'panel.exercise',
        'kind': 'kvRows',
        'title': '实值的那一刻',
        'blocks': [
            {'type': 'text', 'id': '8.6.head', 'label': '',
             'text': '这次买一张**实值**合约，然后持有到到期。'},
            {'type': 'kvRows', 'id': '8.6.rows', 'rows': [
                {'key': 'e1', 'label': '实值意味着', 'value': '内在价值 > 0 —— 这张合约现在「成立」'},
                {'key': 'e2', 'label': '到期怎么处理', 'value': '自动**现金行权**：直接把内在价值折算成现金打给你'},
                {'key': 'e3', 'label': '你不用做什么', 'value': '不用买股票、不用卖股票、不用点任何东西'},
                {'key': 'e4', 'label': '你的盈亏', 'value': '行权收到的现金 − 当初付出的权利金'},
            ]},
            {'type': 'text', 'id': '8.6.body', 'label': '',
             'text': '注意一件事：实值合约的权利金里有一大块是**内在价值**，那部分不会随时间消失；会消失的只有时间价值。这就是 8.3 那张虚值合约和这张的区别。'},
        ],
        'actions': [{'id': '8.6.closePanel', 'label': '看懂了'}],
    },
    'panel.quiz': {
        'id': 'panel.quiz',
        'kind': 'text',
        'title': '期权理解确认',
        'blocks': [
            {'type': 'text', 'id': '8.7.head', 'label': '',
             'text': '老周合上本子：「最后一道题。答错我会重讲，不着急。」'},
            {'type': 'choiceGroup', 'choiceId': '8.7.quiz'},
        ],
        'actions': [{'id': '8.7.closePanel', 'label': '答完了'}],
    },
}

BEATS = [
    {
        'id': '8.1', 'title': '一张会过期的东西', 'shell': 'full', 'scene': 'cafe', 'sceneImageKey': None,
        'mentor': [
            mentor('chapterOpen', '最后一样东西。我想让你先害怕它，再理解它。'),
            mentor('firstConcept', '上面这三个序列、五个价位、两种方向——先找出「平值」那一档。', '期权'),
        ],
        'panels': ['panel.chain'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '8.1.read', 'panelId': 'panel.chain', 'count': 10,
             'mustClose': True, 'label': '把三张到期表看清（每档点开）'},
            {'kind': 'choice', 'id': '8.1.answer', 'choiceId': '8.1.atm',
             'label': '指出哪一档是平值'},
        ],
        'concepts': ['期权', '行权价', '到期日', '平值/实值/虚值'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '8.2', 'title': '用 X 元控制 Y 元', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '看清楚：你付出去的钱，和你「控制」的东西，不是一个量级。', '杠杆'),
        ],
        'panels': ['panel.leverage'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': '8.2.read', 'panelId': 'panel.leverage', 'count': 4,
             'mustClose': True, 'label': '读懂名义价值与杠杆'},
        ],
        'concepts': ['杠杆', '权利金'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '8.3', 'title': '标的没动，钱在掉', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '买一张虚值的。然后什么都不做——只是推进交易日。', '时间价值衰减'),
        ],
        'panels': ['panel.decayWatch'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'submit', 'id': '8.3.buyOtm', 'expect': {'accepted': True, 'side': 'buy', 'optionMoney': '虚值'},
             'label': '买入 1 张虚值合约'},
            {'kind': 'advanceDay', 'id': '8.3.advance', 'label': '推进一天，看权利金怎么变',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '8.3.read', 'panelId': 'panel.decayWatch', 'count': 3,
             'mustClose': True, 'label': '看清时间价值为什么会减'},
        ],
        'concepts': ['时间价值衰减', '内在价值'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '8.4', 'title': '它归零了', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '一直推进，直到这张合约到期。', '到期归零'),
        ],
        'panels': ['panel.zero'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'advanceDay', 'id': '8.4.advance', 'label': '推进到这张合约到期',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '8.4.read', 'panelId': 'panel.zero', 'count': 4,
             'mustClose': True, 'label': '看清归零意味着什么'},
        ],
        'concepts': ['到期归零'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '8.5', 'title': '如果当时你买了 10 张', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '如果第 8.3 天你买的不是 1 张，而是 10 张——现在是什么感觉？', '杠杆'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'choice', 'id': '8.5.answer', 'choiceId': '8.5.tenLots',
             'label': '回答老周的问题'},
        ],
        'concepts': ['杠杆'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '8.6', 'title': '实值的那一刻', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '这次换一张实值的，同样持有到到期。看看有什么不一样。', '实值/虚值/平值'),
        ],
        'panels': ['panel.exercise'], 'panelAutoOpen': False,
        'require': [
            {'kind': 'submit', 'id': '8.6.buyItm', 'expect': {'accepted': True, 'side': 'buy', 'optionMoney': '实值'},
             'label': '买入 1 张实值合约'},
            {'kind': 'advanceDay', 'id': '8.6.advance', 'label': '推进到它到期，看现金行权',
             'simAction': ['advanceDay']},
            {'kind': 'read', 'id': '8.6.read', 'panelId': 'panel.exercise', 'count': 4,
             'mustClose': True, 'label': '看清实值与虚值的区别'},
        ],
        'concepts': ['实值/虚值/平值', '现金行权'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '8.7', 'title': '期权理解确认', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '最后一道题。答错我会重讲。', '时间价值衰减'),
        ],
        'panels': ['panel.quiz'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'choice', 'id': '8.7.answer', 'choiceId': '8.7.quiz',
             'label': '通过期权理解确认（答错只重讲）'},
        ],
        'concepts': ['杠杆', '时间价值衰减', '到期归零'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': '8.8', 'title': '章末', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterClose', '这个，我会怕。我见过太多人在这个东西上把十年积蓄交出去。我说怕，是因为我知道它有多快——你现在也知道它有多快了。'),
        ],
        'panels': [], 'panelAutoOpen': False,
        'require': [
            {'kind': 'choice', 'id': '8.8.end', 'choiceId': '8.end',
             'label': '回答老周的最后一问'},
        ],
        'concepts': ['杠杆'],
        'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
        'endOfChapter': True,
    },
]

settlement = copy.deepcopy(c2['settlement'])
settlement['extraSegments']['advanced']['body'] = [
    '你走完了全剧最难的一章，而且没有把自己搭进去。',
    '老周说：能在这一章全身而退的人不多，不是因为聪明，是因为**他一开始就只买了 1 张**。',
]
settlement['extraSegments']['remedial']['body'] = [
    '你不是做错了。你是花了一笔很小的钱，买到了别人要花很多年才肯相信的一件事。',
    '**东西真的会变成零。** 这句话，看过一次的人和有仓位的人，理解完全不同——你现在是后者了。',
    '再确认一次：买方的最大亏损就是权利金，不会更多。你这一次亏的是「学费」，不是「窟窿」。',
    '真正要记住的不是「别碰期权」，而是：**张数决定了它是体验还是灾难。**',
]

c8 = {
    'id': 8,
    'name': '一张会过期的合约',
    'implemented': True,
    'situation': '老周第一次没带笔记本，说想让你先害怕它',
    'preview': '最后一样东西：一张会过期的合约。',
    'rated': True,
    'noScoreLabel': None,
    'clearResidualsOnEnter': True,
    'unlocks': {'instruments': ['510050'], 'markets': ['OPTION']},
    'goalCard': {
        'title': '一张会过期的合约',
        'teach': '这一章要让你亲眼看见一次「归零」。带走一句话就够：时间是买方的对手，张数决定它是体验还是灾难。',
        'graded': True,
    },
    'savePoints': ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8'],
    'directedEvents': ['C02', 'C08', 'P01'],
    'pinnedEvents': [],
    'directedQueue': [],
    'choices': CHOICES,
    'panels': PANELS,
    'chapterEnd': {
        'settlementPanelId': 'panel.settlement',
        'confirmPanelId': 'panel.confirm',
        'extraPanelId': 'panel.extraSegment',
        'understandingChoiceId': '8.end',
    },
    'settlement': settlement,
    'beats': BEATS,
}

d['chapters'] = [c for c in d['chapters'] if c['id'] != 8] + [c8]
d['chapters'].sort(key=lambda c: c['id'])
io.open(PATH, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('第八章已写入：', len(BEATS), '拍；面板', len(PANELS), '个；选项组', len(CHOICES), '个')
