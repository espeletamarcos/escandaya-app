#!/usr/bin/env bash
# Smoke test for a deployed Escandaya:
#   1. /api/health must answer {"status":"ok"} (retried while the app starts).
#   2. /api/session and POST /api/drafts without a token must answer 401, so the API
#      is not open.
# Usage: scripts/smoke.sh [base-url]   (default: https://escandaya.fly.dev)
set -u

base_url="${1:-https://escandaya.fly.dev}"
base_url="${base_url%/}"
expected='{"status":"ok"}'
attempts=5
wait_seconds=5

healthy=false
for attempt in $(seq 1 "$attempts"); do
  body="$(curl -sS --max-time 20 -w '\n%{http_code}' "$base_url/api/health" 2>&1)"
  status="${body##*$'\n'}"
  body="${body%$'\n'*}"

  if [ "$status" = "200" ] && [ "$body" = "$expected" ]; then
    echo "OK: $base_url/api/health returned $body"
    healthy=true
    break
  fi

  echo "Attempt $attempt/$attempts failed (status: $status, body: $body)" >&2
  [ "$attempt" -lt "$attempts" ] && sleep "$wait_seconds"
done

if [ "$healthy" != true ]; then
  echo "FAIL: $base_url/api/health did not return $expected after $attempts attempts" >&2
  exit 1
fi

# The app is up, so one try per endpoint is enough. No Authorization header on purpose.
# Usage: needs_token METHOD PATH [JSON-BODY]
needs_token() {
  local method="$1" path="$2" status
  if [ $# -ge 3 ]; then
    status="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -X "$method" \
      -H 'Content-Type: application/json' --data "$3" "$base_url$path" 2>&1)"
  else
    status="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -X "$method" \
      "$base_url$path" 2>&1)"
  fi
  if [ "$status" != "401" ]; then
    echo "FAIL: $method $base_url$path without a token returned $status, expected 401" >&2
    exit 1
  fi
  echo "OK: $method $base_url$path without a token returned 401"
}

needs_token GET /api/session
# Empty text: if the token check were ever missing, the backend would answer 422 for the
# text and fail this check, without calling (and paying for) the model.
needs_token POST /api/drafts '{"text": ""}'
