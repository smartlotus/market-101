import io
p = '.vibegame/tmp/walk_ch5.js'
s = io.open(p, encoding='utf-8').read()
old = """// 5.4 推进一天（forceEvent M01）+ 读面板
b.chapterAck('5.4.advance');"""
new = """// 5.4 先建仓并持有（汇率事件要打在持仓上），再推进一天（forceEvent M01）
{
  const id = S().selectedInstrumentId;
  const LOTS = { '00700': 100, '03690': 100, '01810': 200, '00388': 100, '01299': 500 };
  const qty = (LOTS[id] || 100) * 2;
  const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: id,
                            price: S().quotes[id].lastPrice, qty });
  out.push(['5.4.hold', { id, qty, ok: r.accepted, code: r.reasonCode }]);
}
b.chapterAck('5.4.advance');"""
assert old in s
s = s.replace(old, new)
old2 = """b.chapterAck('5.5.advance');"""
new2 = """b.chapterAck('5.5.advance');"""
s = s.replace(old2, new2)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('walk patched')
