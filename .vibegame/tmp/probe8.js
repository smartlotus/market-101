const b = sceneTree.nodes.get('broker');
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
b.resetChapterProgress(); b.sim.reset();
b.sim.openAccount(); b.sim.fundInitial(); b.sim.beginFirstDay();
b.devGotoChapter(8);
const sim = b.sim;
const o = sim.options;
const c = o.contractList().filter((x) => x.type === 'CALL' && x.moneyStatus === '虚值').sort((a,z)=>z.strike-a.strike)[0];
const raw = sim.buyOption({ contractId: c.id, lots: 1 });
return JSON.stringify({
  unlocked: [...sim.unlockedMarkets],
  isUnlockedOption: sim.isUnlocked('OPTION'),
  openOption: sim.calendar.isOpenFor('OPTION'),
  cash: sim.account.cash,
  contract: { id: c.id, K: c.strike, prem: c.premiumTotal, money: c.moneyStatus },
  rawResult: raw,
  positionsAfter: o.positions.length,
}, null, 1);
