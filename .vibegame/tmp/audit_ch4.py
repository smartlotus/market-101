import json, re

doc = json.load(open('config/chapters.json', encoding='utf-8'))
ch = doc['chapters'][3]
print('chapter4 keys:', sorted(ch.keys()))
print('rated', ch.get('rated'), 'noRemedial', ch.get('noRemedial'))
print('has settlement:', 'settlement' in ch, 'has extraPanelId:', 'extraPanelId' in (ch.get('chapterEnd') or {}))
print('chapterEnd:', json.dumps(ch.get('chapterEnd'), ensure_ascii=False))
print('unlocks:', ch.get('unlocks'), 'directedQueue:', ch.get('directedQueue'), 'savePoints', ch.get('savePoints'))
print('pinnedEvents:', ch.get('pinnedEvents'))

KINDS = {'interact', 'read', 'select', 'submit', 'choice', 'advanceDay'}
allkinds = set()
for b in ch['beats']:
    ks = [r['kind'] for r in b.get('require', [])]
    allkinds |= set(ks)
    print('---', b['id'], b.get('title'), 'kinds', ks, 'gate', [r.get('gate') for r in b.get('require', []) if r.get('gate')])
    for r in b.get('require', []):
        print('    ', r['id'], r['kind'], r.get('panelId') or r.get('opensPanel') or r.get('choiceId') or '', r.get('label') or '')
    for m in b.get('mentor', []):
        print('    MENTOR', m.get('timing'), '|', m.get('line'))
print('all require kinds:', allkinds, 'subset of closed set:', allkinds <= KINDS)

# choices
for cid, c in (ch.get('choices') or {}).items():
    print('CHOICE', cid, 'correctKey=', c.get('correctKey'), 'conceptKey=', c.get('conceptKey'))
    for o in c.get('options', []):
        print('   opt', o.get('key'), '|', o.get('text'), '|fb:', o.get('feedback'))

# matchGames / flowWalks
mg = ch.get('matchGames') or {}
for gid, g in mg.items():
    print('MATCH', gid, 'pairs', len(g.get('pairs', [])), 'prompt', g.get('prompt'))
    for p in g.get('pairs', []):
        print('   pair', p.get('cardId'), p.get('targetKey'), p.get('requireId'))
fw = ch.get('flowWalks') or {}
for wid, w in fw.items():
    print('WALK', wid, 'order', w.get('order'), 'finishRequireId', w.get('finishRequireId'))
    print('   cards', [(c.get('id'), c.get('label')) for c in w.get('cards', [])])
    print('   prompt', w.get('prompt'))

# panels
for pid, p in (ch.get('panels') or {}).items():
    print('PANEL', pid, 'title', p.get('title'), 'blocks', [b.get('type') for b in p.get('blocks', [])], 'actions', [a.get('label') for a in p.get('actions', [])])
print('goalCard:', json.dumps(ch.get('goalCard'), ensure_ascii=False))
print('preview:', ch.get('preview'))
print('copy keys:', sorted((ch.get('copy') or {}).keys()))

def scan(text, label, words):
    hits = [(w, text.count(w)) for w in words if w in text]
    if hits:
        print('  HIT', label, hits)

FORBIDDEN = ['失败', '不及格', '差', '淘汰', '降级', '扣分']
print('=== four word: 错 in ch4 ===')
s = json.dumps(ch, ensure_ascii=False)
print('  count 错 =', s.count('错'))
for m in re.finditer(r'[^"]{0,30}错[^"]{0,30}', s):
    print('   ...', m.group(0))

print('=== six forbidden words in settlement panels + grade labels (ch2) ===')
ch2 = doc['chapters'][1]
st = json.dumps({'panels': {k: v for k, v in (ch2.get('panels') or {}).items() if 'settlement' in k},
                 'gradeLabels': (ch2.get('settlement') or {}).get('gradeLabels')}, ensure_ascii=False)
for w in FORBIDDEN:
    if w in st:
        print('  HIT', w, st.count(w))
print('  (scan done)')
print('PRD 4.7 line present:', '你怕的不是市场，是你看不见的那些手。现在你看见它们了。下一章我带你去看一种多了两个变量的东西。' in json.dumps(ch, ensure_ascii=False))
print('4.0 opening line present:', '这一章不花你的钱，只花你的时间' in json.dumps(ch, ensure_ascii=False))
print('本章不打分 present:', '本章不打分' in json.dumps(ch, ensure_ascii=False))
print('P02/B01 in ch4 directedQueue/pinned:', ch.get('directedQueue'), ch.get('pinnedEvents'))
print('B01 in any require id/label:', [r for b in ch['beats'] for r in b.get('require', []) if 'B01' in json.dumps(r, ensure_ascii=False)])
