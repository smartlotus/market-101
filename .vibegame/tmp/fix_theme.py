import io

path = 'scripts/ui/chapter/theme.js'
src = io.open(path, encoding='utf-8').read()
lines = src.split('\n')

start = 60  # 1-based: 第一行模板正文（第 59 行是 export const CHAPTER_THEME_CSS = `）
changed = []
for i in range(start, len(lines) + 1):
    ln = lines[i - 1]
    if '`' in ln:
        new = ln.replace('`', '')
        changed.append((i, ln.strip(), new.strip()))
        lines[i - 1] = new

io.open(path, 'w', encoding='utf-8', newline='\n').write('\n'.join(lines))
print('fixed lines:', len(changed))
for i, a, b in changed:
    print('  %d:' % i)
    print('    - %s' % a)
    print('    + %s' % b)
