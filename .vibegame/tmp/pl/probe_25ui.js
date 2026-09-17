const b = sceneTree.nodes.get('broker');
const out = {};
const S = () => b.runtimeState();
const C = () => S().chapter;
const px = (id) => Number(S().quotes[id].lastPrice);
// 走到 2.5
b.chapterAck('1.0.start');
b.chapterAck('1.1.openDeposit'); b.chapterRead('panel.deposit', 2); b.chapterClosePanel('panel.deposit');
b.chapterAck('1.2.openAccount'); b.chapterAck('1.3.fundInitial');
b.chapterSelect('601398', { player: true });
b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
b.chapterRead('panel.conceptCards', 3); b.chapterClosePanel('panel.conceptCards');
b.advanceDay();
b.submitOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
b.chapterRead('panel.review', 5); b.chapterClosePanel('panel.review');
b.chapterAnswer('1.9.confirm', 't1'); b.chapterConfirm();
b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '600519', price: px('600519'), qty: 100 });
const q = S().quotes['601398'];
b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: q.limitUp + 0.01, qty: 100 });
b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
b.submitOrder({ side: 'sell', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });
let g = 0; while (S().isMarketOpen && g < 12) { b.advanceDay(); g += 1; }
b.submitOrder({ side: 'buy', type: 'limit', instrumentId: '601398', price: px('601398'), qty: 100 });

out.at25entered = { beatId: C().beatId, panelId: C().panelId, pendingChoice: C().pendingChoice, reqs: C().beatRequirements };
const el = document.querySelector('#game-container [id="vg-menu-panel.ruleCards-outer"]');
out.ruleCardsPanel = {
  exists: !!el,
  open: el ? el.classList.contains('ch-open') : null,
  dataUnresolved: el ? Array.from(el.querySelectorAll('[data-ch-unresolved]')).map((e) => e.getAttribute('data-ch-unresolved')) : null,
  choiceButtons: el ? Array.from(el.querySelectorAll('[data-choice-id]')).map((e) => e.getAttribute('data-choice-id')) : null,
  buttons: el ? Array.from(el.querySelectorAll('button')).map((e) => (e.textContent || '').trim().slice(0, 30)) : null,
  text: el ? el.innerText : null,
};
// 对话层是否有选择控件
out.dialogueChoiceButtons = Array.from(document.querySelectorAll('#chapter-root [data-choice-id]')).map((e) => e.getAttribute('data-choice-id'));
out.dialogueText = (document.querySelector('#chapter-root .ch-dialogue') || {}).innerText || null;
// UI 路径尝试：读满 4 张 + 关闭面板
b.chapterRead('panel.ruleCards', 4);
b.chapterClosePanel('panel.ruleCards');
out.afterClose = { beatId: C().beatId, reqs: C().beatRequirements.map((r) => r.id + '=' + r.satisfied), ruleCards: C().ruleCardsSeen, pendingChoice: C().pendingChoice };
// 尝试所有其它 UI 路径
b.chapterAck('2.5.choice');
b.chapterEndPhase();
b.chapterExtraStep();
out.afterOtherHooks = { beatId: C().beatId, reqs: C().beatRequirements.map((r) => r.id + '=' + r.satisfied) };
// 唯一的推进方式：eval-only 的 chapterAnswer
out.answerResult = b.chapterAnswer('2.5.fourRules', 'restrict');
out.afterAnswer = { beatId: C().beatId, reqs: C().beatRequirements.map((r) => r.id + '=' + r.satisfied) };
return out;
