/* 第五章端到端驱动：5.1 → 5.7。 */
const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const out = [];
const step = (name) => out.push([name, {
  beat: C().beatId,
  req: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
}]);

try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress();
b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(5);
step('goto5');

// 5.1 汇率面板
b.chapterRead('panel.fxPanel', 5);
b.chapterClosePanel('panel.fxPanel');
step('5.1');

// 5.2 每手股数 + 选一只买得起的港股
b.chapterRead('panel.hkLots', 5);
b.chapterClosePanel('panel.hkLots');
{
  // 找出 1 手金额最小的港股（每只的每手股数不同）
  const lots = { '00700': 100, '03690': 100, '01810': 200, '00388': 100, '01299': 500 };
  const q = S().quotes;
  let best = null;
  for (const id of Object.keys(lots)) {
    const cost = q[id].lastPrice * lots[id];
    if (!best || cost < best.cost) best = { id, cost };
  }
  b.selectInstrument(best.id);
  out.push(['5.2.pick', { id: best.id, oneLotCost: Math.round(best.cost) }]);
}
step('5.2');

// 5.3 买入 + 当日卖出
{
  const id = S().selectedInstrumentId;
  const px = S().quotes[id].lastPrice;
  const LOTS = { '00700': 100, '03690': 100, '01810': 200, '00388': 100, '01299': 500 };
  const qty = LOTS[id] || 100;   // 每手股数按标的取，不能硬写 100
  const r1 = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: id, price: px, qty });
  const r2 = b.submitOrder({ side: 'sell', type: 'limit', instrumentId: id, price: px, qty });
  out.push(['5.3.trades', {
    buy: { ok: r1.accepted, code: r1.reasonCode },
    sellSameDay: { ok: r2.accepted, code: r2.reasonCode },
  }]);
}
step('5.3');

// 5.4 先建仓并持有（汇率事件要打在持仓上），再推进一天（forceEvent M01）
{
  const id = S().selectedInstrumentId;
  const LOTS = { '00700': 100, '03690': 100, '01810': 200, '00388': 100, '01299': 500 };
  const qty = (LOTS[id] || 100) * 2;
  const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: id,
                            price: S().quotes[id].lastPrice, qty });
  out.push(['5.4.hold', { id, qty, ok: r.accepted, code: r.reasonCode }]);
}
b.chapterAck('5.4.advance');
b.chapterRead('panel.noLimit', 4);
b.chapterClosePanel('panel.noLimit');
out.push(['5.4.day', { date: b.sim.calendar.inGameDate, event: S().currentEvent ? S().currentEvent.id : null }]);
step('5.4');

// 5.5 推进（应抽到 M03）→ 读拆分 → 回答
b.chapterAck('5.5.advance');
out.push(['5.5.day', {
  date: b.sim.calendar.inGameDate,
  event: S().currentEvent ? S().currentEvent.id : null,
  fx: S().fx.rates,
  split: S().fxSplit,
}]);
b.chapterRead('panel.fxSplit', 4);
b.chapterClosePanel('panel.fxSplit');
b.chapterAnswer('5.5.split', 'fx');
step('5.5');

// 5.6 妈妈的问题
b.chapterAnswer('5.6.mom', 'same');
step('5.6');

// 5.7 章末
b.chapterAnswer('5.end', 'size');
step('5.7');

const c = C();
out.push(['final', {
  beat: c.beatId,
  completed: c.completedBeats,
  chapterEndReached: c.chapterEndReached,
  rating: c.rating ? { S: c.rating.S, grade: c.rating.grade } : null,
  fx: S().fx.rates,
  fxSplit: S().fxSplit,
  NAV: S().NAV,
  positions: S().positions.map((p) => p.instrumentId + ':' + p.qty),
}]);
return JSON.stringify(out, null, 1);
