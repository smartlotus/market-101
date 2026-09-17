import json, re, collections

doc = json.load(open('config/chapters.json', encoding='utf-8'))
concepts = json.load(open('config/concepts.json', encoding='utf-8'))['concepts']
ckey = {c['key']: c for c in concepts}

print('=== A 级解锁声明 ===')
for ch in doc['chapters']:
    seg = ((ch.get('settlement') or {}).get('extraSegments') or {}).get('advanced')
    print(ch.get('id'), ch.get('name'), 'rated', ch.get('rated'), 'advancedDecl',
          (seg or {}).get('unlockConcepts'), 'remedialDecl', bool(((ch.get('settlement') or {}).get('extraSegments') or {}).get('remedial')))

print('=== 声明 key 是否存在 & 其 chapter 归属 ===')
for ch in doc['chapters']:
    seg = ((ch.get('settlement') or {}).get('extraSegments') or {}).get('advanced')
    for k in ((seg or {}).get('unlockConcepts') or []):
        e = ckey.get(k)
        print(' ch', ch.get('id'), '->', k, 'exists' if e else 'MISSING', 'entryChapter', (e or {}).get('chapter'), 'advanced', (e or {}).get('advanced'))

FORB = ['失败', '不及格', '差', '淘汰', '降级', '扣分']
raw = open('config/chapters.json', encoding='utf-8').read()
print('=== 六词全量出现位置（章/路径）===')
def walk(node, path=''):
    if isinstance(node, dict):
        for k, v in node.items():
            walk(v, f'{path}.{k}')
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, f'{path}[{i}]')
    elif isinstance(node, str):
        for w in FORB:
            if w in node:
                print('  ', w, '@', path, '|', node[:70])
walk(doc)
print('=== 禁止指令串扫描（我该怎么办 / 全仓） ===')
pat = re.compile(r'你应该(买|卖|加仓|减仓)|建议(你)?(买|卖|加仓|减仓)|应该(买|卖|加仓|减仓)')
for label, text in [('chapters.json', raw), ('concepts.json', open('config/concepts.json', encoding='utf-8').read())]:
    hits = pat.findall(text)
    print(' ', label, 'hits', hits[:5], len(hits))
print('=== askBack / 视角式回应 ===')
print(json.dumps(doc['copy'].get('askBack'), ensure_ascii=False, indent=1))
