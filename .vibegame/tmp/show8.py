import json
import sys

raw = open('/tmp/ch8e.json', encoding='utf-8').read()
i = raw.find('{')
d = json.loads(raw[i:])
if 'error' in d:
    print('ERR', d['error'])
    raise SystemExit(1)
arr = json.loads(d['result'])
for it in arr:
    name = it[0]
    if len(it) > 1 and isinstance(it[1], dict) and 'req' in it[1]:
        v = it[1]
        pend = [r for r in v['req'] if r.endswith('=false')]
        print('%-16s beat=%-6s %s' % (name, v['beat'], ('缺:' + ','.join(pend)) if pend else 'OK'))
    else:
        print('%-16s %s' % (name, json.dumps(it[1:], ensure_ascii=False)[:190]))
