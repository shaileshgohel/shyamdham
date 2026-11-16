#!/usr/bin/env bash
# Builds the app and runs both end-to-end suites, each on a freshly reset test database.
# The server is restarted after every reset because dropping the database closes its connections.
set -uo pipefail
set -m
cd "$(dirname "$0")/.."
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://shyamdham:shyamdham@localhost:5432/shyamdham_test}"
PORT=3100
npm run build >/dev/null || { echo "build failed"; exit 1; }
status=0
for suite in tests/smoke.mjs tests/smoke-phase2.mjs; do
  ./tests/reset-test-db.sh >/dev/null 2>&1
  # Own process group, so stopping it also stops the Node server that `next start` launches.
  # Job control (set -m) does this on both Linux and macOS; `setsid` does not exist on macOS.
  DATABASE_URL="$TEST_DATABASE_URL" node_modules/.bin/next start -p $PORT >/tmp/shyamdham-test-server.log 2>&1 &
  pid=$!
  for _ in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/login" && break; sleep 1; done
  BASE_URL="http://localhost:$PORT" node "$suite" || status=1
  kill -- -$pid 2>/dev/null; wait $pid 2>/dev/null
  for _ in $(seq 1 20); do curl -s -o /dev/null "http://localhost:$PORT/login" || break; sleep 0.5; done
done
exit $status
