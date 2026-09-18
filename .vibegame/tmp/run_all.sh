#!/usr/bin/env bash
# 全量回归：逐个跑 tests/test_*/test.sh，汇总结果。
export PATH="/usr/bin:/bin:/c/Windows/System32:$HOME/AppData/Roaming/npm:$PATH"
cd /c/Users/28389/Desktop/grokpet/games/market-101 || exit 1

PORT=8765
VB="$(uv tool dir --bin)/vibegame"
"$VB" play --port $PORT activate >/dev/null 2>&1

p=0; f=0; fl=""
: > .vibegame/tmp/suite.log
for d in tests/test_*/; do
  n=$(basename "$d")
  [ -f "$d/test.sh" ] || continue
  if PORT=$PORT bash "$d/test.sh" > ".vibegame/tmp/s_$n.log" 2>&1; then
    p=$((p+1)); echo "PASS  $n" | tee -a .vibegame/tmp/suite.log
  else
    f=$((f+1)); fl="$fl $n"; echo "FAIL  $n" | tee -a .vibegame/tmp/suite.log
  fi
done
echo "===============================" | tee -a .vibegame/tmp/suite.log
echo "TOTAL pass=$p fail=$f" | tee -a .vibegame/tmp/suite.log
echo "FAILED:$fl" | tee -a .vibegame/tmp/suite.log
