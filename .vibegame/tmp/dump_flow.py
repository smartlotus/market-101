import json, io
d = json.load(io.open('config/chapters.json', encoding='utf-8'))
c4 = [c for c in d['chapters'] if c['id'] == 4][0]
print('flowWalks:', json.dumps(c4.get('flowWalks'), ensure_ascii=False, indent=1)[:900])
print('matchGames keys:', list((c4.get('matchGames') or {}).keys()))
