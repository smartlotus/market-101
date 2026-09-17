import json

d = json.load(open('config/chapters.json', encoding='utf-8'))
chs = d['chapters']
for ch in chs:
    print('ch', ch.get('id'), '| rated=', ch.get('rated'), '| beats=', len(ch.get('beats') or []))
    print('   keys =', sorted(ch.keys()))

c1 = [c for c in chs if c.get('id') == 1][0]
c2 = [c for c in chs if c.get('id') == 2][0]

ce2 = c2.get('chapterEnd') or {}
ce1 = c1.get('chapterEnd') or {}
print()
print('ch2 chapterEnd keys:', sorted(ce2.keys()))
print('ch1 chapterEnd keys:', sorted(ce1.keys()))
print()
es2 = ce2.get('extraSegments') or {}
print('ch2 extraSegments keys:', sorted(es2.keys()))
print('ch1 extraSegments     :', (ce1.get('extraSegments') if 'extraSegments' in ce1 else 'ABSENT'))
print()
print('--- ch2 remedial ---')
print(json.dumps(es2.get('remedial'), ensure_ascii=False, indent=1)[:1400])
print()
print('--- ch2 chapterEnd minus extraSegments ---')
print(json.dumps({k: v for k, v in ce2.items() if k != 'extraSegments'}, ensure_ascii=False, indent=1)[:800])
