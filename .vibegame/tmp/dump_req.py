import json, io
d = json.load(io.open('config/chapters.json', encoding='utf-8'))
seen = {}
for c in d['chapters']:
    for b in c.get('beats', []):
        for r in b.get('require', []):
            k = r.get('kind')
            if k not in seen:
                seen[k] = r
for k in ('select', 'submit', 'advanceDay', 'interact', 'read', 'choice'):
    if k in seen:
        print(k, '=', json.dumps(seen[k], ensure_ascii=False))
