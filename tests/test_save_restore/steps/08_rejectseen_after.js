/** 场景 4 的刷新后：提交 2.6 要求的四类合法委托，节拍必须能完成（→ 2.7）。 */
const before = {
  beatId: C().beatId,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  isMarketOpen: S().isMarketOpen,
};
let guard = 0;
while (!S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
const id = '601398';
const steps = [];
const submit = (spec) => {
  const r = b.submitOrder(spec);
  steps.push({
    spec: spec.side + '/' + spec.type,
    reasonCode: r.reasonCode,
    status: r.status,
    beatId: C().beatId,
    requirements: C().beatRequirements.map((x) => x.id + '=' + x.satisfied),
  });
  return r;
};
// 限价买 / 限价卖 / 市价买 / 修正后的限价单（四类齐全）
submit({ side: 'buy', type: 'limit', instrumentId: id, qty: 100, price: px(id) });
guard = 0;
while (!S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
submit({ side: 'sell', type: 'limit', instrumentId: id, qty: 100, price: px(id) });
submit({ side: 'buy', type: 'market', instrumentId: id, qty: 100 });
submit({ side: 'buy', type: 'limit', instrumentId: id, qty: 100, price: px(id) });
const after = {
  beatId: C().beatId,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  correctedLimitSatisfied: reqDone(C(), '2.6.correctedLimit'),
};
// 一路推到章末，确认第二章真的能结章（不是只过了一拍）
guard = 0;
while (C().beatId !== '2.7' && guard < 10) { b.advanceDay(); guard += 1; }
return { before, steps, after, reached27: C().beatId === '2.7' };
