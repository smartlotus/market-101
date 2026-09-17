// 探测：完整走通第一章，记录每步之后的章节态
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
    shellMode: c.shellMode,
    mode: c.mode,
    cash: st.cash,
    NAV: st.NAV,
    opened: st.accountOpened,
    funded: st.accountFunded,
    dayOpen: st.dayOpen,
    date: st.inGameDate,
    sel: st.selectedInstrumentId,
    reqs: (c.beatRequirements || []).map((r) => r.kind + ':' + r.id + '=' + r.satisfied),
    choice: c.pendingChoice ? { id: c.pendingChoice.id, ans: c.pendingChoice.answeredKey, opts: (c.pendingChoice.options || []).map((o) => o.key) } : null,
  });
};
snap('start');
try { b.chapterAck('1.0.start'); } catch (e) { log.push({ tag: 'ERR 1.0.start', err: String(e) }); }
snap('after 1.0.start');
try { b.chapterAck('1.1.openDeposit'); } catch (e) { log.push({ tag: 'ERR 1.1.open', err: String(e) }); }
snap('after 1.1.openDeposit');
try { b.chapterRead('panel.deposit', 1); } catch (e) { log.push({ tag: 'ERR read1', err: String(e) }); }
snap('after read 1');
try { b.chapterRead('panel.deposit', 1); } catch (e) { log.push({ tag: 'ERR read2', err: String(e) }); }
snap('after read 2');
try { b.chapterClosePanel('panel.deposit'); } catch (e) { log.push({ tag: 'ERR close', err: String(e) }); }
snap('after close deposit');
try { b.chapterAck('1.2.openAccount'); } catch (e) { log.push({ tag: 'ERR 1.2', err: String(e) }); }
snap('after 1.2');
try { b.chapterAck('1.3.fundInitial'); } catch (e) { log.push({ tag: 'ERR 1.3', err: String(e) }); }
snap('after 1.3');
try { b.chapterSelect('601398', { player: true }); } catch (e) { log.push({ tag: 'ERR sel', err: String(e) }); }
snap('after select 601398');
return log;
