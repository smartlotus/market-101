import io

path = 'scripts/ui/chapter/theme.js'
src = io.open(path, encoding='utf-8').read()
lines = src.split('\n')

# 只处理模板正文里 CSS 注释（/* ... */）中的裸反引号；绝不碰第 59 行的起始与第 1546 行的结束反引号
start_line = 60
end_line = None
for i, ln in enumerate(lines, 1):
    if i > start_line and ln.strip() == '`':
        end_line = i
        break

changed = []
for i in range(start_line, (end_line or len(lines))):
    ln = lines[i - 1]
    stripped = ln.strip()
    if stripped.startswith('/*') and '`' in ln:
        new = ln.replace('`', '')
        changed.append((i, stripped, new.strip()))
        lines[i - 1] = new

io.open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
print('template body: %d..%s' % (start_line, end_line))
print('fixed lines:', len(changed))
for i, a, b in changed:
    print('  %d: %s' % (i, a))
    print('     -> %s' % b)
