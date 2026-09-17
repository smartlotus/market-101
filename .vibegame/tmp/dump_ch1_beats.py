import json

d = json.load(open('config/chapters.json', encoding='utf-8'))
c1 = [c for c in d['chapters'] if c.get('id') == 1][0]
print('chapter 1, rated =', c1.get('rated'))
for b in c1['beats']:
    req = b.get('require') or []
    ids = []
    for r in req:
        if isinstance(r, dict):
            ids.append('%s:%s' % (r.get('kind'), r.get('id') or r.get('requireId') or ''))
        else:
            ids.append(str(r))
    print('%-7s | panels=%-28s | require=%s' % (
        b.get('id'), str(b.get('panels'))[:28], ids))
print()
print('chapterEnd:', json.dumps(c1.get('chapterEnd'), ensure_ascii=False))
print('savePoints:', c1.get('savePoints'))
