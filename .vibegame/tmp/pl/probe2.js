const b = sceneTree.nodes.get('broker');
const st = b.runtimeState();
return { beatId: st.chapter.beatId, mode: st.chapter.mode, shellMode: st.chapter.shellMode, cash: st.cash, opened: st.accountOpened, funded: st.accountFunded, dayOpen: st.dayOpen, dayIndex: st.dayIndex, date: st.inGameDate, sel: st.selectedInstrumentId, reqs: st.chapter.beatRequirements, save: st.chapter.save, panelId: st.chapter.panelId, mentor: st.chapter.mentor };
