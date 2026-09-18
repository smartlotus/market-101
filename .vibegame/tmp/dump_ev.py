import io, json
d = json.load(io.open('config/events.json', encoding='utf-8'))
ev = d['events'] if 'events' in d else d
print('事件数:', len(ev))
for e in ev:
    mark = ' [fxTarget=%s]' % e.get('fxTarget') if e.get('fxTarget') else ''
    print('  %-5s %-9s %-9s %-5s %s%s' % (e.get('id'), e.get('type'), e.get('sentiment'),
          e.get('magnitude'), (e.get('headline') or '')[:22], mark))
