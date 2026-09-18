import sys, json
raw = sys.stdin.read()
i = raw.find('{')
if i < 0:
    print(raw[-500:]); raise SystemExit(1)
d = json.loads(raw[i:])
arr = json.loads(d.get('result', '[]'))
for name, val in arr:
    if isinstance(val, dict) and 'req' in val:
        pend = [r for r in val['req'] if r.endswith('=false')]
        print('%-16s beat=%-6s %s' % (name, val['beat'], ('未满足: ' + ', '.join(pend)) if pend else 'OK'))
    else:
        print('%-16s %s' % (name, json.dumps(val, ensure_ascii=False)[:160]))
