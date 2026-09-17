import json, io
c = json.load(io.open('config/concepts.json', encoding='utf-8'))
concepts = c['concepts'] if isinstance(c, dict) else c
print('CONCEPT COUNT', len(concepts))
for x in concepts:
    print('  ', x.get('key'), '|ch', x.get('chapter'), '|adv', x.get('advanced'))
e = json.load(io.open('config/events.json', encoding='utf-8'))['events']
for x in e:
    if x.get('id') in ('P02', 'B01'):
        print('EVENT', json.dumps(x, ensure_ascii=False)[:800])
i = json.load(io.open('config/instruments.json', encoding='utf-8'))
ins = i['instruments'] if isinstance(i, dict) else i
for x in ins:
    print('INST', x.get('id'), x.get('name'))
