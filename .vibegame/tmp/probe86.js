const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(8);
const sim = b.sim;
const pick = (money) => sim.options.contractList()
  .filter((x) => x.type === 'CALL' && x.moneyStatus === money)
  .sort((a, z) => a.strike - z.strike)[0];
const itm0 = pick('实值');
const raw = sim.buyOption({ contractId: itm0.id, lots: 1 });
return JSON.stringify({
  spot: sim.options.spot,
  cash: sim.account.cash,
  itm: { id: itm0.id, K: itm0.strike, prem: itm0.premiumTotal, series: itm0.seriesName, D: itm0.daysLeft },
  raw,
  positions: sim.options.positions.length,
}, null, 1);
