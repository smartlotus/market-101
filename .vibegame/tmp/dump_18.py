import json
d = json.load(open('config/chapters.json', encoding='utf-8'))
c1 = [c for c in d['chapters'] if c.get('id') == 1][0]
for b in c1['beats']:
    if b.get('id') in ('1.8', '1.9'):
        print('=== beat', b.get('id'), '===')
        print(json.dumps(b, ensure_ascii=False, indent=1)[:1200])
        print()
