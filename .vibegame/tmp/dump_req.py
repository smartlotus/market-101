import json

d = json.load(open('config/chapters.json', encoding='utf-8'))
c1 = [c for c in d['chapters'] if c.get('id') == 1][0]
for b in c1['beats']:
    if b.get('id') in ('1.1', '1.2', '1.3', '1.4', '1.5'):
        print('=== beat', b.get('id'), '===')
        print(json.dumps(b.get('require'), ensure_ascii=False, indent=1))
        print('panels:', b.get('panels'))
        print()
