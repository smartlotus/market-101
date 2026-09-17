/**
 * 场景 6（反证，证明场景 4 的判别力）：全新会话直接落到 2.6（**没有**撞过 2.1–2.4 的拒单），
 * 同样提交四类合法委托。若 `2.6.correctedLimit` 仍能被满足，说明场景 4 的
 * 「刷新后能推进」根本没在测 `chapterRejectSeen`，判别力为零。
 * 期望：**停**在 2.6（`correctedLimit` 不满足）—— 于是场景 4 的「推进到 2.7」才是有效证据。
 */
b.reset();
b.resetChapterProgress();
b.refresh();
toCh2();
b.devGotoBeat(2, '2.6');
let guard = 0;
while (!S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
const id = '601398';
const steps = [];
const submit = (spec) => {
  const r = b.submitOrder(spec);
  steps.push({ spec: spec.side + '/' + spec.type, reasonCode: r.reasonCode, status: r.status, beatId: C().beatId });
  return r;
};
submit({ side: 'buy', type: 'limit', instrumentId: id, qty: 100, price: px(id) });
// 推一天解锁 T+1：让本次售卖**成功**，从而全程不出现任何拒单
guard = 0;
while (guard < 3) { b.advanceDay(); guard += 1; if (S().isMarketOpen) break; }
guard = 0;
while (!S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
submit({ side: 'sell', type: 'limit', instrumentId: id, qty: 100, price: px(id) });
submit({ side: 'buy', type: 'market', instrumentId: id, qty: 100 });
submit({ side: 'buy', type: 'limit', instrumentId: id, qty: 100, price: px(id) });
return {
  beatId: C().beatId,
  requirements: C().beatRequirements.map((r) => r.id + '=' + r.satisfied),
  correctedLimitSatisfied: reqDone(C(), '2.6.correctedLimit'),
  steps,
};
