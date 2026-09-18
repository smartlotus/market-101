import json, io

d = json.load(io.open('config/chapters.json', encoding='utf-8'))
chs = d['chapters']

c3 = [c for c in chs if c['id'] == 3][0]
print('=== 第三章现状 ===')
print(json.dumps(c3, ensure_ascii=False, indent=1)[:1800])

c2 = [c for c in chs if c['id'] == 2][0]

print('\n=== 第二章 choices 形状 ===')
k = list(c2['choices'].keys())[0]
print(k, json.dumps(c2['choices'][k], ensure_ascii=False)[:600])

print('\n=== 第二章 panels 形状（第一个） ===')
pk = list(c2['panels'].keys())[0]
print(pk, json.dumps(c2['panels'][pk], ensure_ascii=False)[:900])

print('\n=== 第二章 chapterEnd ===')
print(json.dumps(c2['chapterEnd'], ensure_ascii=False))

print('\n=== 带 panels 的 beat（2.5） ===')
b = [x for x in c2['beats'] if x['id'] == '2.5'][0]
print(json.dumps(b, ensure_ascii=False, indent=1)[:1800])

print('\n=== goalCard / unlocks / savePoints / directed* ===')
for kk in ('goalCard', 'unlocks', 'savePoints', 'directedEvents', 'pinnedEvents', 'directedQueue'):
    print(kk, '=', json.dumps(c2[kk], ensure_ascii=False)[:300])
