import io, json
d = json.load(io.open('config/events.json', encoding='utf-8'))
ev = d['events'] if 'events' in d else d
print('顶层键:', list(d.keys()) if isinstance(d, dict) else 'list')
for e in ev:
    if e['id'] in ('M03', 'B01', 'M01', 'I03'):
        print(json.dumps(e, ensure_ascii=False)[:420])
