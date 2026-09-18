import io, json
P = 'config/chapters.json'
d = json.load(io.open(P, encoding='utf-8'))
# 确认既有章的最后一拍确实带 endOfChapter
for cid in (2, 4):
    c = [x for x in d['chapters'] if x['id'] == cid][0]
    own = [k for k in c['beats'][-1].keys() if 'ndOfChapter' in k or 'endOf' in k]
    print('章', cid, '最后一拍', c['beats'][-1]['id'], '字段:', own, '值:', c['beats'][-1].get('endOfChapter'))
c3 = [x for x in d['chapters'] if x['id'] == 3][0]
for b in c3['beats']:
    b['endOfChapter'] = (b['id'] == '3.7')
io.open(P, 'w', encoding='utf-8', newline='\n').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
print('3.7 已标 endOfChapter')
