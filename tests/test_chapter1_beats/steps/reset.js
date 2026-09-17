// 清空节拍级存档，回到「首次进入游戏」的状态（product 的开局）。
try { window.localStorage.removeItem('market-101.save.v1'); } catch (e) {}
return { cleared: true };
