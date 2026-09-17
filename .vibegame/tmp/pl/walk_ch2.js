const b = sceneTree.nodes.get('broker');
const log = [];
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const snap = (tag) => log.push({
  tag, beatId: C().beatId, beatIndex: C().beatIndex, date: S().inGameDate, isMarketOpen: S().isMarketOpen,
  reqs: C().beatRequirements.map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
  lastOrder: S().lastOrder && { accepted: S().lastOrder.accepted, rc: S().lastOrder.reasonCode, status: S().lastOrder.status },
  positions: S().positions.map((p) => p.instrumentId + ':' + p.qty + '/' + p.lockedQty),
  ruleCards: C().ruleCardsSeen, choice: C().pendingChoice && { id: C().pendingChoice.id, ans: C().pendingChoice.answeredKey },
  directed: C().directedEvents, event: S().currentEvent && S().currentEvent.id,
});
b.devGotoBeat(2, '2.1');
snap('2.1 start');
// 2.1 买茅台 1 手（资金不足）
log.push({ tag: '2.1 submit 600519', r: (() => { const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '600519', price: px('600519'), qty: 100 }); return { accepted: r.accepted, rc: r.reasonCode }; })() });
snap('after 2.1');
// 2.2 高于涨停价
const q = S().quotes['601398'];
log.push({ tag: '2.2 limitUp', limitUp: q.limitUp, tick: q.tickSize || null });
log.push({ tag: '2.2 submit', r: (() => { const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: q.limitUp + 1, qty: 100 }); return { accepted: r.accepted, rc: r.reasonCode }; })() });
snap('after 2.2');
// 2.3 当天买当天卖
log.push({ tag: '2.3 buy', r: (() => { const r = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 }); return { accepted: r.accepted, rc: r.reasonCode, status: r.status }; })() });
snap('after 2.3 buy');
log.push({ tag: '2.3 sell same day', r: (() => { const r = b.submitOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 }); return { accepted: r.accepted, rc: r.reasonCode }; })() });
snap('after 2.3 sell');
// 2.4 推进到周末后下单
b.advanceDay();
snap('after advance 1');
const closed = b._advanceToClosedDay ? null : null;
return log;
