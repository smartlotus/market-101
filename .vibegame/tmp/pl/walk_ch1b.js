const b = sceneTree.nodes.get('broker');
const log = [];
const snap = (tag) => {
  const st = b.runtimeState();
  const c = st.chapter;
  log.push({
    tag,
    beatId: c.beatId,
    beatIndex: c.beatIndex,
    panelId: c.panelId,
    cash: st.cash,
    NAV: st.NAV,
    positions: st.positions,
    tradedNotional: st.tradedNotional,
    feesPaid: st.feesPaid,
    realizedPnL: st.realizedPnL,
    lastOrder: st.lastOrder && { accepted: st.lastOrder.accepted, rc: st.lastOrder.reasonCode, status: st.lastOrder.status, notional: st.lastOrder.notional, fee: st.lastOrder.fee, fillPrice: st.lastOrder.fillPrice },
    date: st.inGameDate,
    dayIndex: st.dayIndex,
    reqs: (c.beatRequirements || []).map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    choice: c.pendingChoice ? { id: c.pendingChoice.id, ans: c.pendingChoice.answeredKey, opts: (c.pendingChoice.options || []).map((o) => o.key), fb: c.pendingChoice.feedbackByOption ? Object.keys(c.pendingChoice.feedbackByOption) : null } : null,
    concepts: c.conceptsIntroduced,
    done: c.completedBeats,
  });
};
snap('t0');
const q = b.runtimeState().quotes;
const qq = q['601398'] || q[0];
log.push({ tag: 'quote601398', q: qq });
const px = (qq && (qq.lastPrice ?? qq.last ?? qq.price)) || 6.28;
const r1 = b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px, qty: 100 });
log.push({ tag: 'submit1', r: { accepted: r1.accepted, rc: r1.reasonCode, status: r1.status, notional: r1.notional, fee: r1.fee, fillPrice: r1.fillPrice } });
snap('after buy');
try { b.chapterRead('panel.conceptCards', 1); } catch (e) { log.push({ tag: 'ERR cr1', err: String(e) }); }
try { b.chapterRead('panel.conceptCards', 2); } catch (e) { log.push({ tag: 'ERR cr2', err: String(e) }); }
snap('after read cards');
try { b.chapterClosePanel('panel.conceptCards'); } catch (e) { log.push({ tag: 'ERR cc', err: String(e) }); }
snap('after close cards');
try { b.advanceDay(); } catch (e) { log.push({ tag: 'ERR adv', err: String(e) }); }
snap('after advanceDay');
const q2 = b.runtimeState().quotes;
const qq2 = q2['601398'];
log.push({ tag: 'quote601398 day2', q: qq2 });
const qty = (b.runtimeState().positions || []).reduce((a, p) => a + (p.qty || 0), 0);
log.push({ tag: 'posQty', qty });
const r2 = b.submitOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: (qq2 && qq2.lastPrice) || 6.4, qty: qty || 100 });
log.push({ tag: 'submitSell', r: { accepted: r2.accepted, rc: r2.reasonCode, status: r2.status, notional: r2.notional, fee: r2.fee, fillPrice: r2.fillPrice } });
snap('after sell');
return log;
