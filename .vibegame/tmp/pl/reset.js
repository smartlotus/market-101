try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
return { cleared: true, keys: Object.keys(window.localStorage) };
