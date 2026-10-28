#!/usr/bin/env bash
# Smoke test for a deployed Escandaya: /api/health must answer {"status":"ok"}.
# Usage: scripts/smoke.sh [base-url]   (default: https://escandaya.fly.dev)
set -u

base_url="${1:-https://escandaya.fly.dev}"
base_url="${base_url%/}"
expected='{"status":"ok"}'
attempts=5
wait_seconds=5

for attempt in $(seq 1 "$attempts"); do
  body="$(curl -sS --max-time 20 -w '\n%{http_code}' "$base_url/api/health" 2>&1)"
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"

  if [ "$status" = "200" ] && [ "$body" = "$expected" ]; then
    echo "OK: $base_url/api/health returned $body"
    exit 0
  fi

  echo "Attempt $attempt/$attempts failed (status: $status, body: $body)" >&2
  [ "$attempt" -lt "$attempts" ] && sleep "$wait_seconds"
done

echo "FAIL: $base_url/api/health did not return $expected after $attempts attempts" >&2
exit 1
