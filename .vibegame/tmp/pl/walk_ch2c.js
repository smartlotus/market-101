const b = sceneTree.nodes.get('broker');
const log = [];
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const qty = (id) => { const p = (S().positions || []).find((x) => x.instrumentId === id); return p ? p.qty : 0; };
const sv = () => ({
  beatId: C().beatId, idx: C().beatIndex, date: S().inGameDate, open: S().isMarketOpen,
  reqs: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  last: S().lastOrder && (S().lastOrder.reasonCode + '/' + S().lastOrder.status),
  pos: qty('601398'), ruleCards: C().ruleCardsSeen.slice(), ans: C().pendingChoice && C().pendingChoice.answeredKey,
  directed: C().directedEvents, event: S().currentEvent && S().currentEvent.id, completed: C().completedBeats.length,
});
const snap = (t) => log.push({ t, ...sv() });
const tryOrder = (spec) => { const r = b.submitOrder(spec); log.push({ t: 'order', spec: spec.side + '/' + spec.type + '/' + (spec.instrumentId || ''), rc: r.reasonCode, st: r.status }); return r; };

b.devGotoBeat(2, '2.1');
snap('2.1');
tryOrder({ side: 'buy', type: 'limit', instrumentId: '600519', price: px('600519'), qty: 100 });
snap('after2.1');
const q = S().quotes['601398'];
tryOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: q.limitUp + 0.01, qty: 100 });
snap('after2.2');
tryOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
snap('2.3 buy');
tryOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
snap('2.3 sell');
let guard = 0;
while (S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
snap('2.4 weekend');
tryOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
snap('after2.4');
b.chapterRead('panel.ruleCards', 4);
b.chapterClosePanel('panel.ruleCards');
snap('2.5 read');
const ch5 = C().pendingChoice;
log.push({ t: '2.5 choice', c: ch5 });
if (ch5) b.chapterAnswer(ch5.id, ch5.options[0].key);
snap('after2.5');
// 2.6
guard = 0;
while (!S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
snap('2.6 monday');
tryOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
snap('2.6 limitBuy');
tryOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
snap('2.6 limitSell');
tryOrder({ side: 'buy', type: 'market', instrumentId: '601398', qty: 100 });
snap('2.6 marketBuy');
tryOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
snap('2.6 correctedLimit');
return log;
