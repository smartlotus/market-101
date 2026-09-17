const st = sceneTree.nodes.get('broker').runtimeState();
return { keys: Object.keys(st), chapter: st.chapter, cash: st.cash, sel: st.selectedInstrumentId };
