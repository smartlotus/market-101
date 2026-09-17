/**
 * test_save_restore 共享驱动库 —— 走完第一章进第二章，并提供「世界指纹」。
 *
 * 全部经宿主对外方法（`chapterAck` / `chapterRead` / `chapterSelect` / `chapterClosePanel` /
 * `chapterAnswer` / `submitOrder` / `advanceDay`）驱动 —— 与 DOM 点击同一条回调路径。
 */
const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
const q = (sel) => document.querySelector(sel);
const reqDone = (s, id) => ((s.beatRequirements || []).find((r) => r.id === id) || {}).satisfied === true;

function dispatch(r, beat, s) {
  if (r.kind === 'interact' || r.kind === 'advanceDay') return b.chapterAck(r.id);
  if (r.kind === 'read') {
    if (s.panelId !== r.panelId) b.chapterOpenPanel(r.panelId);
    b.chapterRead(r.panelId, Number(r.count || 1));
    if (r.mustClose) b.chapterClosePanel(r.panelId);
    return { ok: true };
  }
  if (r.kind === 'select') return b.selectInstrument(b.sim.selectCheapestAffordable());
  if (r.kind === 'choice') {
    let pc = C().pendingChoice;
    if (!pc) { const p = (beat.panels || [])[0]; if (p) b.chapterOpenPanel(p); pc = C().pendingChoice; }
    if (!pc) return { ok: false, reason: 'no_choice' };
    return b.chapterAnswer(pc.id, pc.correctKey || (pc.options[0] && pc.options[0].key));
  }
  if (r.kind === 'submit') {
    const expect = r.expect || {};
    const st = S();
    if (expect.side === 'sell') {
      const pos = (st.positions || []).find((p) => p.qty - (p.lockedQty || 0) >= 100) || (st.positions || [])[0];
      return b.submitOrder({ side: 'sell', instrumentId: pos ? pos.instrumentId : st.selectedInstrumentId, type: 'market', qty: pos ? Math.min(pos.qty, 100) : 100 });
    }
    if (expect.reasonCode === 'REJECT_1') {
      return b.submitOrder({ side: 'buy', instrumentId: '600519', type: 'limit', qty: 100, price: px('600519') });
    }
    if (expect.reasonCode === 'REJECT_2') {
      return b.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', qty: 100, price: Number(st.quotes['601398'].limitUp) + 0.01 });
    }
    if (expect.reasonCode === 'REJECT_4') {
      // 「当天买入后当天卖出」：先确保有持仓（2.3 起点无持仓时先引导买 1 手），再当日卖
      const st0 = S();
      if (!(st0.positions || []).some((p) => p.qty >= 100)) {
        b.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', qty: 100, price: px('601398') });
      }
      return b.submitOrder({ side: 'sell', instrumentId: '601398', type: 'limit', qty: 100, price: px('601398') });
    }
    if (expect.reasonCode === 'REJECT_3') {
      let guard = 0;
      while (S().isMarketOpen && guard < 12) { b.advanceDay(); guard += 1; }
      return b.submitOrder({ side: 'buy', instrumentId: '601398', type: 'limit', qty: 100, price: px('601398') });
    }
    const type = expect.type === 'market' ? 'market' : 'limit';
    const id = st.selectedInstrumentId;
    return b.submitOrder({ side: 'buy', instrumentId: id, type, qty: 100, price: type === 'limit' ? px(id) : null });
  }
  return { ok: false, reason: 'unknown:' + r.kind };
}

/** 走完当前章直到停在 `beatId`（含）。 */
function walkTo(chapterId, beatId) {
  let guard = 0;
  while (Number(C().chapterId) === chapterId && C().beatId !== beatId && guard < 300) {
    guard += 1;
    const s = C();
    const beat = s.beat || {};
    const todo = (beat.require || []).filter((r) => !reqDone(s, r.id));
    if (!todo.length) break;
    dispatch(todo[0], beat, s);
  }
  return { chapterId: C().chapterId, beatId: C().beatId, steps: guard };
}

function toCh2() {
  b.reset();
  b.resetChapterProgress();
  b.refresh();
  walkTo(1, '1.9');
  b.chapterAnswer('1.9.confirm', 't1');
  b.chapterConfirm();
  return { chapterId: C().chapterId, beatId: C().beatId };
}

/** 世界指纹：刷新前后必须逐字节相同（§3.1 存档恢复到「最后完成节拍之后」）。 */
function fingerprint() {
  const s = S();
  const c = C();
  return {
    chapterId: c.chapterId, beatId: c.beatId, beatIndex: c.beatIndex, mode: c.mode,
    cash: s.cash, NAV: s.NAV, frozenCash: s.frozenCash, realizedPnL: s.realizedPnL,
    dayIndex: s.dayIndex, inGameDate: s.inGameDate, isMarketOpen: s.isMarketOpen,
    quotes: JSON.stringify(s.quotes), eventDeck: JSON.stringify(s.eventDeck),
    currentEvent: JSON.stringify(s.currentEvent),
    positions: JSON.stringify(s.positions), pendingOrders: JSON.stringify(s.pendingOrders),
    navHistory: JSON.stringify(s.navHistory), tradedNotional: s.tradedNotional, feesPaid: s.feesPaid,
    conceptsIntroduced: JSON.stringify(c.conceptsIntroduced),
    ruleCardsSeen: JSON.stringify(c.ruleCardsSeen),
    completedBeats: JSON.stringify(c.completedBeats),
    selectedInstrumentId: s.selectedInstrumentId,
    save: JSON.stringify(c.save),
  };
}
