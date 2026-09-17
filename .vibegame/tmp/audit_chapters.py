import json, io

old = open('.vibegame/tmp/chapters.pre_ch4.json', 'rb').read()
new = open('config/chapters.json', 'rb').read()
print('old bytes', len(old), 'new bytes', len(new))
print('new startswith old prefix(except trailing "}"):', new.startswith(old.rstrip()[:-1]) if old.rstrip().endswith(b'}') else 'n/a')

o = json.loads(old.decode('utf-8'))
n = json.loads(new.decode('utf-8'))
print('top keys old:', sorted(o.keys()))
print('top keys new:', sorted(n.keys()))
print('chapters[:3] equal:', o['chapters'][:3] == n['chapters'][:3])
print('top-level copy equal:', o.get('copy') == n.get('copy'))
print('old ch count', len(o['chapters']), 'new ch count', len(n['chapters']))
if o.get('copy') != n.get('copy'):
    ok = set(o.get('copy', {})); nk = set(n.get('copy', {}))
    print(' copy added:', sorted(nk - ok), 'removed:', sorted(ok - nk))
    for k in sorted(ok & nk):
        if o['copy'][k] != n['copy'][k]:
            print('  changed copy key:', k)

for i, ch in enumerate(n['chapters']):
    print(i, 'id', ch.get('id'), 'name', ch.get('name'), 'rated', ch.get('rated'), 'noRemedial', ch.get('noRemedial'),
          'beats', len(ch.get('beats', [])), 'unlocks', ch.get('unlocks'),
          'chapterEnd', {k: v for k, v in (ch.get('chapterEnd') or {}).items() if k in ('settlementPanelId', 'extraPanelId', 'confirmPanelId', 'understandingChoiceId', 'requiresRuleCards')})
