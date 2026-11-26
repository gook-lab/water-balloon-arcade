#!/usr/bin/env bash
# QA 회귀 일괄 실행 — 같은 명령으로 1단계 기준선과 2단계 결과를 비교한다.
# 사용: bash docs/upgrade/qa/run-all.sh <URL> <label> [--memory]
#   예) bash docs/upgrade/qa/run-all.sh http://127.0.0.1:5310 local
#       bash docs/upgrade/qa/run-all.sh https://water-balloon-arcade-ebon.vercel.app live
# 결과: docs/upgrade/qa/out/<점검>/<label>/*.json · *.png → node docs/upgrade/qa/summary.mjs --label <label> --base <기준 label>
# --memory 를 주면 5.5분 긴 판 메모리까지 잰다(약 6분 추가).
set -u
URL=${1:?URL 필요}
LABEL=${2:?label 필요}
DIR=$(cd "$(dirname "$0")" && pwd)
LOG="$DIR/out/logs-$LABEL"
mkdir -p "$LOG"
run() { # name timeout cmd...
  local name=$1 t=$2; shift 2
  echo "== $name"
  timeout "$t" "$@" > "$LOG/$name.log" 2>&1
  local rc=$?
  tail -4 "$LOG/$name.log"
  echo "   (rc=$rc, log: $LOG/$name.log)"
}
run smoke 300 node "$DIR/smoke.mjs" --url "$URL" --label "$LABEL"
run play 420 node "$DIR/play.mjs" --url "$URL" --label "$LABEL"
run a11y 200 node "$DIR/a11y.mjs" --url "$URL" --label "$LABEL"
run perf 400 node "$DIR/perf.mjs" --url "$URL" --label "$LABEL" --only fps,load,restart
run mobile 560 node "$DIR/mobile.mjs" --url "$URL" --label "$LABEL"
if [ "${3:-}" = "--memory" ]; then
  run memory 590 node "$DIR/perf.mjs" --url "$URL" --label "$LABEL-memory" --only memory --minutes 5.5
fi
node "$DIR/summary.mjs" --label "$LABEL"
