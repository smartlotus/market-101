# -*- coding: utf-8 -*-
"""第四章数据自检（静态）。"""
import io
import json
import re

doc = json.load(io.open('config/chapters.json', encoding='utf-8'))
menus = json.load(io.open('scenes/main.scene.json', encoding='utf-8'))
concepts = json.load(io.open('config/concepts.json', encoding='utf-8'))['concepts']
concept_keys = set(c['key'] for c in concepts)

menu_ids = set()
for node in menus['root']['children']:
    for m in (node.get('config', {}).get('menus') or []):
        menu_ids.add(m['id'])

fails = []
checks = 0


def ok(name, cond, detail=''):
    global checks
    checks += 1
    print(('  PASS ' if cond else '  FAIL ') + name + ('' if cond else '  <- ' + str(detail)))
    if not cond:
        fails.append(name)


ch4 = doc['chapters'][3]
KINDS = {'interact', 'read', 'select', 'submit', 'choice', 'advanceDay'}

print('[1] 结构')
ok('chapter id == 4 且 implemented', ch4['id'] == 4 and ch4['implemented'] is True)
ok('恰好 7 拍，id = 4.1 … 4.7', [b['id'] for b in ch4['beats']] == ['4.%d' % i for i in range(1, 8)],
   [b['id'] for b in ch4['beats']])
ok('rated=false + noScoreLabel + goalCard.graded=false',
   ch4['rated'] is False and ch4['noScoreLabel'] == '本章不打分' and ch4['goalCard']['graded'] is False)
ok('noRemedial=true（呼吸章）', ch4['noRemedial'] is True)
ok('unlocks.instruments 为空（不新增品种）', ch4['unlocks']['instruments'] == [], ch4['unlocks'])
ok('chapterEnd.confirmPanelId 已声明、无 extraPanelId、understandingChoiceId=null',
   ch4['chapterEnd']['confirmPanelId'] == 'panel.confirm'
   and 'extraPanelId' not in ch4['chapterEnd']
   and ch4['chapterEnd']['understandingChoiceId'] is None
   and ch4['chapterEnd']['settlementPanelId'] is None, ch4['chapterEnd'])
ok('章数据里没有 settlement.extraSegments（无加演/补救段）', 'settlement' not in ch4)

print('[2] require[] 闭集与「无新规则」')
kinds = set()
for b in ch4['beats']:
    ok('%s：require 非空（不得进入即过关）' % b['id'], bool(b.get('require')))
    for r in b['require']:
        kinds.add(r['kind'])
        ok('%s：%s 只用六种 kind' % (b['id'], r['id']), r['kind'] in KINDS, r['kind'])
ok('全章未出现 submit 条件（不新增委托/拒单）', 'submit' not in kinds, sorted(kinds))
ok('全章未出现 select 条件', 'select' not in kinds)
ok('全章无 rejectExpected / giveUp', all('rejectExpected' not in b and 'giveUp' not in b for b in ch4['beats']))
ok('全章 forceEvent 均为 null（定向事件靠定拍钉）', all(b.get('forceEvent') is None for b in ch4['beats']))
ok('只有 4.2 声明 advanceDay（消耗 1 个开市日）',
   [b['id'] for b in ch4['beats'] if b.get('advanceDay')] == ['4.2'])
ok('任何 require 都不含余额 / 评级相关字段',
   not re.search(r'nav|balance|cash|money|score|rating', json.dumps(ch4['beats'], ensure_ascii=False), re.I))

print('[3] 定向事件')
ok('directedEvents == ["P02"]', ch4['directedEvents'] == ['P02'], ch4['directedEvents'])
ok('P02 定拍钉在 4.2', [p['eventId'] for p in ch4['pinnedEvents']] == ['P02']
   and ch4['pinnedEvents'][0]['beatId'] == '4.2', ch4['pinnedEvents'])
ok('B01 不是任何 require / 任何钉（只可能出现供观察）',
   'B01' not in json.dumps(ch4, ensure_ascii=False))

print('[4] 面板与块型')
blocks_all = []
for pid, spec in ch4['panels'].items():
    ok('面板 %s 已在场景 menus 静态声明' % pid, pid in menu_ids, pid)
    ok('面板 %s：blocks 非空且有 actions（互动不被打成段落）' % pid,
       bool(spec.get('blocks')) and bool(spec.get('actions')))
    ok('面板 %s：id 与键一致' % pid, spec['id'] == pid)
    for blk in spec['blocks']:
        blocks_all.append((pid, blk['type']))
        ok('面板 %s：块型 %s 在全集内' % (pid, blk['type']),
           blk['type'] in {'text', 'bigNumber', 'kvRows', 'list', 'formula', 'choiceGroup', 'steps',
                           'conceptCard', 'ruleCard', 'eventCard', 'tower', 'orderBook', 'matchGame',
                           'flowWalk', 'dictionary', 'mentorHistory', 'progressUnlock', 'navStanding'},
           blk['type'])
ok('4.1 有三个 tower 块', sum(1 for p, t in blocks_all if t == 'tower') == 3)
ok('4.2 有 orderBook 块', ('panel.orderBook', 'orderBook') in blocks_all)
ok('4.3 有 matchGame 块', ('panel.matchGame', 'matchGame') in blocks_all)
ok('4.4 有 flowWalk 块', ('panel.flowWalk', 'flowWalk') in blocks_all)

print('[5] 配对游戏')
game = ch4['matchGames']['institutions']
ok('matchGames 键与 game.id 一致', ch4['matchGames'].get(game['id']) is game)
ok('六张卡 / 六条职责 / 六对', len(game['cards']) == 6 and len(game['targets']) == 6 and len(game['pairs']) == 6)
ok('卡 id 唯一', len(set(c['id'] for c in game['cards'])) == 6)
ok('职责 key 唯一', len(set(t['key'] for t in game['targets'])) == 6)
beat43 = [b for b in ch4['beats'] if b['id'] == '4.3'][0]
req43 = {r['id']: r for r in beat43['require']}
ok('4.3 的六条 require 全是 gate=matchGame 的 interact',
   len(req43) == 6 and all(r['kind'] == 'interact' and r.get('gate') == 'matchGame' for r in beat43['require']))
ok('每个 pair.requireId 都指向 4.3 里的一条 interact 条件',
   sorted(p['requireId'] for p in game['pairs']) == sorted(req43), [p['requireId'] for p in game['pairs']])
ok('卡片名 = 六类机构', sorted(c['name'] for c in game['cards']) ==
   sorted(['交易所', '券商', '银行', '清算机构', '监管机构', '基金管理人']))
ok('卡片有职责文本', all(t.get('text') for t in game['targets']))
ok('配对文案里没有「错」字样', '错' not in json.dumps(game, ensure_ascii=False))

print('[6] 流程走查')
walk = ch4['flowWalks']['orderFlow']
ok('flowWalks 键与 walk.id 一致', ch4['flowWalks'].get(walk['id']) is walk)
ok('cards 与 order 同一批 step id', sorted(c['id'] for c in walk['cards']) == sorted(walk['order']),
   (sorted(c['id'] for c in walk['cards']), sorted(walk['order'])))
ok('展示顺序故意不同于点击顺序', [c['id'] for c in walk['cards']] != walk['order'])
ok('第一步是「你点下买入」、末两步含 T+2 交收与监管',
   walk['order'][0] == 'buy' and 'register' in walk['order'] and 'regulate' in walk['order'])
beat44 = [b for b in ch4['beats'] if b['id'] == '4.4'][0]
req44 = {r['id']: r for r in beat44['require']}
ok('4.4 只有一条 gate=flowWalk 的 interact，且 = finishRequireId',
   len(beat44['require']) == 1 and beat44['require'][0].get('gate') == 'flowWalk'
   and walk['finishRequireId'] == beat44['require'][0]['id'] == '4.4.flow.done')
ok('走查文案里没有「错」字样', '错' not in json.dumps(walk, ensure_ascii=False))
ok('走查卡片文本齐全', all(c.get('label') for c in walk['cards']))

print('[7] 四个互动块的数据形状（PanelHost 读取口径）')
book = [blk for blk in ch4['panels']['panel.orderBook']['blocks'] if blk['type'] == 'orderBook'][0]
ok('orderBook 的 bids/asks 都是 {price,qty}', all(set(r) >= {'price', 'qty'} for r in book['bids'] + book['asks']))
ok('orderBook 有 last/spread/notes（视图读 spread 数字）',
   book['last'].get('price') and book.get('spread') == 0.01 and len(book['notes']) == 3)
tower_blks = [blk for pid, spec in ch4['panels'].items() for blk in spec['blocks'] if blk['type'] == 'tower']
ok('每个 tower 块有 name/tagline/lines/mentorLine',
   len(tower_blks) == 3 and all(b.get('name') and b.get('tagline') and len(b.get('lines', [])) == 3 and b.get('mentorLine') for b in tower_blks))

print('[8] choices')
ok('4.2 的选择题带正确项', ch4['choices']['4.2.match']['correctKey'] == 'match'
   and len(ch4['choices']['4.2.match']['options']) == 2)
ok('4.5 的选择题 correctKey=null（不判对错）', ch4['choices']['4.5.ifNoRule']['correctKey'] is None)
ok('4.5 两条选项都有各自反馈（不同）',
   all(o.get('feedback') for o in ch4['choices']['4.5.ifNoRule']['options'])
   and ch4['choices']['4.5.ifNoRule']['options'][0]['feedback'] != ch4['choices']['4.5.ifNoRule']['options'][1]['feedback'])
ok('4.5 题干 = 设计原文', ch4['choices']['4.5.ifNoRule']['question'] == '如果没有那道规定，会怎样？')

print('[9] 概念键都在 concepts.json 里')
used = set(ch4['goalCard']['teach'])
for b in ch4['beats']:
    used |= set(b.get('concepts') or [])
for pid, spec in ch4['panels'].items():
    for blk in spec['blocks']:
        if blk.get('conceptKey'):
            used.add(blk['conceptKey'])
missing = sorted(k for k in used if k not in concept_keys)
ok('所有引用的 conceptKey 均存在', missing == [], missing)
ok('goalCard.teach 非空', len(ch4['goalCard']['teach']) > 0)

print('[10] 设计原文逐字')
verbatim = {
    '生活处境': ch4['situation'].startswith('你换了工作，新公司在金融街旁边。午休出门，你抬头发现三栋楼：一栋写着「证券」，一栋写着「基金」，一栋写着「交易所」。'),
    '章开场台词': ch4['beats'][0]['mentor'][0]['line'] == '这一章不花你的钱，只花你的时间。',
    '4.7 收场台词': ch4['beats'][6]['mentor'][0]['line']
        == '你怕的不是市场，是你看不见的那些手。现在你看见它们了。下一章我带你去看一种多了两个变量的东西。',
}
for k, v in verbatim.items():
    ok('逐字：' + k, v)

print('\n%d/%d 断言通过' % (checks - len(fails), checks))
if fails:
    print('失败项：')
    for f in fails:
        print('  - ' + f)
    raise SystemExit(1)
