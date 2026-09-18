import json, io
d = json.load(io.open('config/chapters.json', encoding='utf-8'))
c4 = [c for c in d['chapters'] if c['id'] == 4][0]
fw = c4['flowWalks']['orderFlow']
print('keys:', list(fw.keys()))
for k, v in fw.items():
    if k != 'cards':
        print(k, '=', json.dumps(v, ensure_ascii=False)[:400])
print('cards:', len(fw['cards']))
