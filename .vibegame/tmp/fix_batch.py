import io

p = 'assets/artifacts/batch_gen.py'
lines = io.open(p, encoding='utf-8').read().split('\n')
fixed = 0
for i, ln in enumerate(lines):
    # 角色条目用 prompt=f"..."（无外层括号），结尾应为 "),
    if 'prompt=f"{CHAR_BASE}' in ln and ln.rstrip().endswith('")) ,'.replace(' ', '')):
        lines[i] = ln.rstrip()[:-3] + '),'
        fixed += 1
    elif 'prompt=f"{CHAR_BASE}' in ln and ln.rstrip().endswith('")),'):
        lines[i] = ln.rstrip()[:-4] + '"),'
        fixed += 1
io.open(p, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
print('fixed character entries:', fixed)

# 语法自检
import ast
ast.parse(io.open(p, encoding='utf-8').read())
print('SYNTAX OK')
