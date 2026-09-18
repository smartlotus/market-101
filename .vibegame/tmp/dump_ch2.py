import json, io

d = json.load(io.open('config/chapters.json', encoding='utf-8'))
print('顶层键:', list(d.keys()))
print('copy 键:', list(d.get('copy', {}).keys())[:40])
chs = d['chapters']
print('章节数:', len(chs))
for c in chs:
    print('  章', c.get('id'), list(c.keys()))

c2 = [c for c in chs if c.get('id') == 2][0]
print('\n=== 第二章 shot keys ===')
for k, v in c2.items():
    if isinstance(v, list):
        print(' %-22s list[%d]' % (k, len(v)))
    elif isinstance(v, dict):
        print(' %-22s dict(%d) %s' % (k, len(v), list(v.keys())[:6]))
    else:
        print(' %-22s %r' % (k, v))

print('\n=== 第二章第一个 beat 全文 ===')
print(json.dumps(c2['beats'][0], ensure_ascii=False, indent=1)[:1400])

print('\n=== 第二章 beat 的 require 种类汇总 ===')
kinds = {}
for b in c2['beats']:
    for r in b.get('require', []):
        kinds[r.get('kind')] = kinds.get(r.get('kind'), 0) + 1
print(kinds)

print('\n=== 面板名汇总 ===')
pids = set()
for b in c2['beats']:
    for p in (b.get('panels') or []):
        pids.add(p.get('id'))
    for r in (b.get('require') or []):
        if r.get('panelId'):
            pids.add(r['panelId'])
print(sorted(pids))
