import json, io
d = json.load(io.open('config/chapters.json', encoding='utf-8'))
c4 = [c for c in d['chapters'] if c['id'] == 4][0]
b = [x for x in c4['beats'] if x['id'] == '4.4'][0]
print(json.dumps(b, ensure_ascii=False, indent=1)[:1100])
print('--- panels 里的 flowWalk 块 ---')
p = c4['panels'].get('panel.flowWalk')
print(json.dumps(p, ensure_ascii=False)[:500] if p else 'none')
print('--- 所有 panel id ---')
print(list(c4['panels'].keys()))
print('--- chapterEnd ---')
print(json.dumps(c4['chapterEnd'], ensure_ascii=False))
