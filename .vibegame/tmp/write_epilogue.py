# -*- coding: utf-8 -*-
"""写入尾声 · 毕业（章id=9）。内容依据 GDD `### 尾声 · 毕业`。"""
import io
import json
import copy

PATH = 'config/chapters.json'
d = json.load(io.open(PATH, encoding='utf-8'))


def mentor(t, line, c=None):
    return {'timing': t, 'speaker': 'face', 'conceptKey': c, 'line': line}


CHOICES = {
    'E.4.open': {
        'id': 'E.4.open',
        'question': '门开着。你想做什么？',
        'conceptKey': None,
        'correctKey': None,
        'options': [
            {'key': 'free', 'text': '随便看看——现在没有目标卡，也没有人催我。',
             'feedback': '那就随便走走。你要用的东西都在：词典、账户、判断的清单。老周还在，但你不再需要他牵着你。'},
        ],
    },
}

PANELS = {
    'panel.confirm': copy.deepcopy([c for c in d['chapters'] if c['id'] == 2][0]['panels']['panel.confirm']),
    'panel.certificate': {
        'id': 'panel.certificate',
        'kind': 'kvRows',
        'title': '结业报告',
        'blocks': [
            {'type': 'text', 'id': 'E.1.head', 'label': '',
             'text': '你走完了这一整条路。你在咖啡馆等老周，他来得比平时晚，带来一个信封。'},
            {'type': 'kvRows', 'id': 'E.1.rows', 'rows': [
                {'key': 'standing', 'label': '结业评定', 'source': 'graduationStanding.tier'},
                {'key': 'nav', 'label': '期末净值', 'source': 'finale.finalNav'},
                {'key': 'capital', 'label': '初始本金', 'source': 'finale.initialCapital'},
                {'key': 'days', 'label': '一路走过（年）', 'source': 'finale.years'},
            ]},
            {'type': 'kvRows', 'id': 'E.1.grades', 'rows': [
                {'key': 'g2', 'label': '第二章 · 规则会咬人', 'source': 'chapterGrades.2.grade'},
                {'key': 'g3', 'label': '第三章 · 一篮子里的一颗蛋', 'source': 'chapterGrades.3.grade'},
                {'key': 'g5', 'label': '第五章 · 港币的账，美元的梦', 'source': 'chapterGrades.5.grade'},
                {'key': 'g6', 'label': '第六章 · 凌晨三点的红与绿', 'source': 'chapterGrades.6.grade'},
                {'key': 'g7', 'label': '第七章 · 24 小时的赌桌', 'source': 'chapterGrades.7.grade'},
                {'key': 'g8', 'label': '第八章 · 一张会过期的合约', 'source': 'chapterGrades.8.grade'},
            ]},
            {'type': 'text', 'id': 'E.1.tail', 'label': '',
             'text': '一章一行，有 A 有 D。这份记录里既有你赚的，也有你亏的——它是你的，不做任何美化。'},
        ],
        'actions': [{'id': 'E.1.closePanel', 'label': '读完了'}],
    },
    'panel.flashback': {
        'id': 'panel.flashback',
        'kind': 'text',
        'title': '你走过的每一章',
        'blocks': [
            {'type': 'text', 'id': 'E.2.head', 'label': '',
             'text': '老周把信封推过来之前，先问了一句：「你还记得第一章那个存单吗？」'},
            {'type': 'text', 'id': 'E.2.body', 'label': '',
             'text': '第一章，你在银行大厅看见一张活期存单：年利率 1.5%，而物价一年涨约 2%。你当时只是觉得「好像不太划算」。'},
            {'type': 'text', 'id': 'E.2.body2', 'label': '',
             'text': '第二章，你想在群里露一手，连着被拒了四次。第三章，你第一次没有去猜哪家公司，而是买了一篮子。第四章，你看见了你点一下按钮背后那条长长的流水线。第五章，你发现钱会因为汇率而变少。第六章，你熬了一夜，然后明白钱不睡觉但你得睡。第七章，你自己写下了一个数字，并在章末看见了它。第八章，你看着一张合约变成零。'},
            {'type': 'text', 'id': 'E.2.body3', 'label': '',
             'text': '现在，把两个数字并排放在一起——左边是「如果这八章你什么也没做」，右边是你真实的期末净值。'},
            {'type': 'kvRows', 'id': 'E.2.compare', 'rows': [
                {'key': 'dormant', 'label': '如果什么也没做（活期 1.5%）', 'source': 'finale.dormantValue'},
                {'key': 'real', 'label': '你真实的期末净值', 'source': 'finale.finalNav'},
                {'key': 'inflation', 'label': '同样的钱，被物价吃掉后相当于', 'source': 'finale.inflationValue'},
            ]},
            {'type': 'text', 'id': 'E.2.body4', 'label': '',
             'text': '老周没有评语，只让你自己把这两个数字念一遍。第一个是推算，第二个是真的——**这一笔账只有你有。**'},
        ],
        'actions': [{'id': 'E.2.closePanel', 'label': '念过了'}],
    },
    'panel.handover': {
        'id': 'panel.handover',
        'kind': 'text',
        'title': '交还',
        'blocks': [
            {'type': 'text', 'id': 'E.3.head', 'label': '',
             'text': '他把词典、账户、判断的清单交还给你。'},
            {'type': 'text', 'id': 'E.3.body', 'label': '',
             'text': '「这些东西本来就是你的。我只是一直在你旁边，替你把它们摆整齐。」'},
            {'type': 'text', 'id': 'E.3.line', 'label': '',
             'text': '「你不再需要我知道答案——你知道怎么自己找出答案了。」'},
        ],
        'actions': [{'id': 'E.3.closePanel', 'label': '收下了'}],
    },
    'panel.freeMode': {
        'id': 'panel.freeMode',
        'kind': 'kvRows',
        'title': '门开着',
        'blocks': [
            {'type': 'text', 'id': 'E.4.head', 'label': '',
             'text': '从这一刻起，屏幕上不再有目标卡，也没有人告诉你下一步该做什么。'},
            {'type': 'kvRows', 'id': 'E.4.rows', 'rows': [
                {'key': 'all', 'label': '全部七类品种', 'value': '已解锁'},
                {'key': 'dict', 'label': '全部词典条目', 'value': '已展开（含进阶条目）'},
                {'key': 'mentor', 'label': '老周', 'value': '退场了，但你随时可以呼他'},
                {'key': 'goal', 'label': '目标卡 / 引导', 'value': '不再出现'},
            ]},
            {'type': 'text', 'id': 'E.4.body', 'label': '',
             'text': '想玩多久玩多久。这里不再是课程，是你的一个角落。'},
            {'type': 'choiceGroup', 'choiceId': 'E.4.open'},
        ],
        'actions': [{'id': 'E.4.closePanel', 'label': '知道了'}],
    },
}

BEATS = [
    {
        'id': 'E.1', 'title': '结业', 'shell': 'full', 'scene': 'graduation', 'sceneImageKey': None,
        'mentor': [
            mentor('chapterOpen', '走完了。先看报告，别急着说话——这份报告是写给你自己的，不是写给我的。'),
        ],
        'panels': ['panel.certificate'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': 'E.1.read', 'panelId': 'panel.certificate', 'count': 10,
             'mustClose': True, 'label': '读完结业报告（评定 / 净值 / 六次评级）'},
        ],
        'concepts': [], 'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': 'E.2', 'title': '你走过的每一章', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '这一屏不是我的故事。是你的。'),
        ],
        'panels': ['panel.flashback'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': 'E.2.read', 'panelId': 'panel.flashback', 'count': 8,
             'mustClose': True, 'label': '把这一路重看一遍，念出那两个数字'},
        ],
        'concepts': [], 'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': 'E.3', 'title': '交还', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('firstConcept', '最后一句。'),
        ],
        'panels': ['panel.handover'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': 'E.3.read', 'panelId': 'panel.handover', 'count': 3,
             'mustClose': True, 'label': '读完他最后说的话'},
        ],
        'concepts': [], 'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
    },
    {
        'id': 'E.4', 'title': '门开着', 'shell': 'full', 'scene': None, 'sceneImageKey': None,
        'mentor': [
            mentor('chapterClose', '去吧。有不懂的，喊我一声就行。'),
        ],
        'panels': ['panel.freeMode'], 'panelAutoOpen': True,
        'require': [
            {'kind': 'read', 'id': 'E.4.read', 'panelId': 'panel.freeMode', 'count': 4,
             'mustClose': True, 'label': '看清现在开着的门'},
            {'kind': 'choice', 'id': 'E.4.answer', 'choiceId': 'E.4.open',
             'label': '选一条路走进自由模式'},
        ],
        'concepts': [], 'conceptCards': [], 'savePoint': True, 'advanceDay': False, 'forceEvent': None,
        'endOfChapter': True,
    },
]

epilogue = {
    'id': 9,
    'name': '尾声 · 毕业',
    'implemented': True,
    'situation': '你在咖啡馆等老周，他带来了一个信封',
    'preview': '走完了。看看这一路的账。',
    'rated': False,
    'noScoreLabel': '尾声不打分',
    'clearResidualsOnEnter': True,
    'isFinale': True,
    'unlocks': {'instruments': ['600519', '601398', '600036', '000858', '000651', '300750', '688981',
                                '510300', '510050', '110020', '000187',
                                '00700', '03690', '01810', '00388', '01299',
                                'AAPL', 'TSLA', 'NVDA', 'BTC', 'ETH'],
                'markets': ['A_SHARE', 'ETF', 'FUND', 'HK', 'US', 'CRYPTO', 'OPTION']},
    'goalCard': {
        'title': '尾声 · 毕业',
        'teach': '这一屏不是老周的故事，是你自己的。念出那两个数字。',
        'graded': False,
    },
    'savePoints': ['E.1', 'E.2', 'E.3', 'E.4'],
    'directedEvents': [],
    'pinnedEvents': [],
    'directedQueue': [],
    'choices': CHOICES,
    'panels': PANELS,
    'chapterEnd': {
        'settlementPanelId': None,
        'confirmPanelId': 'panel.confirm',
        'understandingChoiceId': None,
    },
    'beats': BEATS,
}

d['chapters'] = [c for c in d['chapters'] if c['id'] != 9] + [epilogue]
d['chapters'].sort(key=lambda c: c['id'])
io.open(PATH, 'w', encoding='utf-8', newline='\n').write(
    json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('尾声已写入：', len(BEATS), '拍；面板', len(PANELS), '个；章节总数',
      len(d['chapters']), '→', [c['id'] for c in d['chapters']])
