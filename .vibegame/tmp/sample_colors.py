from PIL import Image
from collections import Counter

for name in ('reskin-01', 'reskin-02', 'playable-now'):
    p = '.vibegame/logs/review-shots/%s.png' % name
    try:
        im = Image.open(p).convert('RGB')
    except Exception as e:
        print(name, 'SKIP', e)
        continue
    w, h = im.size
    small = im.resize((160, 90))
    cnt = Counter(small.getdata())
    top = cnt.most_common(6)
    total = 160 * 90
    print('=== %s (%dx%d) ===' % (name, w, h))
    for rgb, n in top:
        r, g, b = rgb
        # 判断是否暖色（R > B 说明偏暖）
        tone = '暖' if r > b + 8 else ('冷' if b > r + 8 else '中')
        print('   #%02X%02X%02X  占比 %5.1f%%   %s' % (r, g, b, 100.0 * n / total, tone))
    # 平均色
    px = list(small.getdata())
    ar = sum(p[0] for p in px) / total
    ag = sum(p[1] for p in px) / total
    ab = sum(p[2] for p in px) / total
    print('   平均色 #%02X%02X%02X  -> %s' % (round(ar), round(ag), round(ab),
                                              '暖' if ar > ab + 8 else '冷'))
    print()
