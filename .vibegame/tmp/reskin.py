"""
UI 换肤：从「冷色 AI 味终端」改为「岭南市井手绘」暖色纸感。

策略（避免逐条手改 210 处硬编码）：
  1. 把每个 #RRGGBB 转 HSL。
  2. 若它**已经是暖色**（色相 15°–65° 且饱和 > 12%）→ 原样保留（如 #E0A33E 藤黄、#F0D9A8 纸色）。
  3. 否则 → **色相统一到 38°（暖褐/纸色），明度反转并压缩**：
     L_new = 0.16 + (1 - L_old) * 0.76
     于是原来的深色底(#05070C)→浅纸面，原来的浅色字(#E6EAF2)→深墨字，中间灰→中间暖褐。
  4. rgba() 里的 rgb 三元组同样处理（保留 alpha）。
  5. 语义色（涨/跌/成交/拒单/强调/金）用显式岭南色覆盖，保证可读性与中国习惯（涨红跌绿）。

用法：python .vibegame/tmp/reskin.py      （会先写 .bak 备份）
"""
import colorsys
import io
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = ['scripts/ui/theme.js', 'scripts/ui/chapter/theme.js']

# ── 语义色：岭南手绘配色（与《凉茶王》的市井暖色系同源）────────────
OVERRIDE = {
    # 价格方向：中国习惯 涨=红 跌=绿
    '#F5484A': '#C2402F',   # 涨 → 朱红（砖红）
    '#1DBA70': '#2E7D5B',   # 跌 → 釉绿
    '#F5A0A1': '#C2402F',
    '#FFB4A2': '#D9564A',
    # 委托结果色：与方向色解耦
    '#7FD3E8': '#2F6E7A',   # 成交 → 釉青
    '#1F4A5A': '#2F6E7A',
    '#CFEAF3': '#DCEBEE',
    '#F2CC8A': '#8A5A12',   # 拒单 → 赭黄（深，保证纸面上可读）
    '#6E5522': '#8A5A12',
    '#E9B75A': '#B8862C',
    '#E8C078': '#B8862C',
    '#CE8F27': '#A8721F',
    '#E0A33E': '#D89A2C',   # 藤黄
    # 强调 / 选中
    '#3D7EFF': '#3A6B8A',   # 靛蓝（釉蓝）
    '#4A88FF': '#4A7C99',
    '#2F6BE0': '#3A6B8A',
    # 已经是纸/墨的，显式固定
    '#FBF3E0': '#FBF3E0',
    '#EFE3CB': '#EFE3CB',
    '#EADFC4': '#EADFC4',
}


def is_warm(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    deg = h * 360
    return 15 <= deg <= 65 and s > 0.12


def transform(r, g, b):
    """冷色 → 暖色 + 明度反转；已暖色则原样。"""
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    deg = h * 360
    if 15 <= deg <= 65 and s > 0.12:
        return (r, g, b)
    new_l = 0.16 + (1.0 - l) * 0.76
    new_l = max(0.08, min(0.95, new_l))
    # 中间调保留一点冷灰的层次差异，避免全部撞成一个色
    new_s = 0.20 if s < 0.25 else 0.26
    rr, gg, bb = colorsys.hls_to_rgb(38 / 360, new_l, new_s)
    return (round(rr * 255), round(gg * 255), round(bb * 255))


def hex_to_new(m):
    txt = m.group(0)
    key = txt.upper()
    if key in OVERRIDE:
        return OVERRIDE[key]
    r = int(txt[1:3], 16)
    g = int(txt[3:5], 16)
    b = int(txt[5:7], 16)
    nr, ng, nb = transform(r, g, b)
    return '#%02X%02X%02X' % (nr, ng, nb)


def rgba_to_new(m):
    r, g, b, a = int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(4)
    nr, ng, nb = transform(r, g, b)
    return 'rgba(%d, %d, %d, %s)' % (nr, ng, nb, a)


HEX_RE = re.compile(r'#[0-9A-Fa-f]{6}')
RGBA_RE = re.compile(r'rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)')

changed_total = 0
for rel in FILES:
    p = ROOT / rel
    src = io.open(p, encoding='utf-8').read()
    shutil.copyfile(p, str(p) + '.bak')
    new = RGBA_RE.sub(rgba_to_new, HEX_RE.sub(hex_to_new, src))
    if new != src:
        io.open(p, 'w', encoding='utf-8', newline='\n').write(new)
        n = len(HEX_RE.findall(src)) + len(RGBA_RE.findall(src))
        changed_total += n
        print('%s: 处理 %d 处颜色' % (rel, n))
    else:
        print('%s: 无变化' % rel)

print('完成，共 %d 处；备份在 *.bak' % changed_total)
