"""把换肤变换只应用到剩下的两个 UI 脚本（ShellRoot / ConceptDictionaryView）。"""
import io
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = ['scripts/ui/ShellRoot.js', 'scripts/ui/chapter/ConceptDictionaryView.js']


def is_warm(r, g, b):
    import colorsys
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return 15 <= h * 360 <= 65 and s > 0.12


def transform(r, g, b):
    import colorsys
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if 15 <= h * 360 <= 65 and s > 0.12:
        return (r, g, b)
    nl = max(0.08, min(0.95, 0.16 + (1.0 - l) * 0.76))
    ns = 0.20 if s < 0.25 else 0.26
    rr, gg, bb = colorsys.hls_to_rgb(38 / 360, nl, ns)
    return (round(rr * 255), round(gg * 255), round(bb * 255))


def hexsub(m):
    r, g, b = int(m.group(0)[1:3], 16), int(m.group(0)[3:5], 16), int(m.group(0)[5:7], 16)
    nr, ng, nb = transform(r, g, b)
    return '#%02X%02X%02X' % (nr, ng, nb)


def rgbasub(m):
    nr, ng, nb = transform(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return 'rgba(%d, %d, %d, %s)' % (nr, ng, nb, m.group(4))


HEX = re.compile(r'#[0-9A-Fa-f]{6}')
RGBA = re.compile(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)')

for rel in FILES:
    p = ROOT / rel
    src = io.open(p, encoding='utf-8').read()
    shutil.copyfile(p, str(p) + '.bak')
    out = RGBA.sub(rgbasub, HEX.sub(hexsub, src))
    io.open(p, 'w', encoding='utf-8', newline='\n').write(out)
    print(rel, 'done')
