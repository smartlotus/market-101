const b = sceneTree.nodes.get('broker');
const S = () => b.runtimeState();
const C = () => S().chapter;
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(8);
b.chapterRead('panel.chain', 10); b.chapterClosePanel('panel.chain');
b.chapterAnswer('8.1.atm', 'same');
b.chapterRead('panel.leverage', 4); b.chapterClosePanel('panel.leverage');
// 8.3
let otm = S().options.series[0].contracts.filter((c) => c.type === 'CALL' && c.moneyStatus === '虚值').sort((a,z)=>z.strike-a.strike)[0];
const r3 = b.chapterBuyOption(otm.id, 1);
b.chapterAck('8.3.advance');
b.chapterRead('panel.decayWatch', 3); b.chapterClosePanel('panel.decayWatch');
// 8.4
b.chapterAck('8.4.advance');
for (let i = 0; i < 32; i += 1) b.devAdvanceDay();
b.chapterRead('panel.zero', 4); b.chapterClosePanel('panel.zero');
b.chapterAnswer('8.5.tenLots', 'regret');
// 8.6
const near = S().options.series[0];
const cand = near.contracts.filter((c) => c.type === 'CALL' && c.moneyStatus === '实值').sort((a,z)=>z.strike-a.strike);
const itm = cand[0];
const r6 = b.chapterBuyOption(itm.id, 1);
return JSON.stringify({
  beat: C().beatId,
  cash: S().cash,
  candCount: cand.length,
  pick: itm ? { id: itm.id, K: itm.strike, prem: itm.premiumTotal, money: itm.moneyStatus } : null,
  r6_typeof: typeof r6,
  r6_keys: r6 ? Object.keys(r6) : null,
  r6: r6,
  reqs: C().beatRequirements,
}, null, 1);
