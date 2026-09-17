import json
d = json.load(open('config/chapters.json', encoding='utf-8'))
ch = d['chapters'][3]
for pid, p in (ch.get('panels') or {}).items():
    print('=' * 20, pid, '|', p.get('title'))
    for b in p.get('blocks', []):
        t = b.get('type')
        if t == 'choiceGroup':
            c = (ch.get('choices') or {}).get(b.get('choiceId'), {})
            print('  choiceGroup', b.get('choiceId'), '| question:', c.get('question'))
            for o in c.get('options', []):
                print('     -', o.get('key'), '|', o.get('text'))
        else:
            print('  ', json.dumps(b, ensure_ascii=False))
    print('  actions:', json.dumps(p.get('actions'), ensure_ascii=False))
