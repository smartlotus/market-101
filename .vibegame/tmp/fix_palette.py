"""修正换肤后的色板层次：浅色主题下应该『背景偏深、卡片更亮、边框用深褐墨线』。

自动换肤把 bg/screen/panel 压成了几乎同色，边框也失去对比。这里显式覆盖核心变量。
"""
import io
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = ['scripts/ui/theme.js', 'scripts/ui/chapter/theme.js']

PAL = {
    '--bg': '#D5C7AE',        # 最外层：暖纸/木桌
    '--screen': '#E2D7C2',    # 内容区
    '--panel': '#FBF5E9',     # 卡片：比背景更亮，浮起来
    '--panel-2': '#F1E8D6',   # 卡片次级
    '--sunken': '#E7DCC7',    # 内凹的输入/表格槽
    '--hair': '#C4B393',      # 细分隔线
    '--hair-2': '#CFC0A1',
    '--border': '#8A7350',    # 手绘墨线边框（可见）
    '--text': '#33291F',      # 墨字
    '--text-2': '#57493A',
    '--muted': '#7E6E56',
    '--dim': '#A08B6C',
    '--accent': '#3A6B8A',    # 釉蓝（选中/强调）
    '--gold': '#D89A2C',      # 藤黄
    # 语义
    '--up': '#C2402F',        # 涨 = 朱红（中国习惯）
    '--down': '#2E7D5B',      # 跌 = 釉绿
    '--ok': '#2F6E7A',        # 成交 = 釉青（与方向色解耦）
    '--ok-line': '#2F6E7A',
    '--reject': '#8A5A12',    # 拒单 = 赭黄（纸面上可读）
    '--reject-line': '#8A5A12',
    '--ok-soft': 'rgba(47, 110, 122, 0.12)',
    '--reject-soft': 'rgba(138, 90, 18, 0.16)',
}

for rel in FILES:
    p = ROOT / rel
    src = io.open(p, encoding='utf-8').read()
    out = src
    n = 0
    for var, val in PAL.items():
        # 匹配 "--var: 任意值;"（值里不含分号）
        pat = re.compile(r'(' + re.escape(var) + r'\s*:\s*)[^;\n]+(;)')
        out, cnt = pat.subn(lambda m: m.group(1) + val + m.group(2), out)
        n += cnt
    io.open(p, 'w', encoding='utf-8', newline='\n').write(out)
    print('%s: 覆盖 %d 个变量' % (rel, n))

print('色板修正完成')
