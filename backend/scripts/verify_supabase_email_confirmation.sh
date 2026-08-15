#!/usr/bin/env bash
set -euo pipefail

# Supabase Auth is the identity provider, but DDD requires verified email before
# a user can receive an authenticated session and participate in protected flows.
# This script proves that policy against the local Supabase Auth stack.

eval "$(npx --yes supabase@2.110.0 status -o env)"

test -n "${ANON_KEY:-}"

email="unverified-$(date +%s)-${RANDOM}@example.com"
password="DDD-local-test-${RANDOM}-Aa1!"
signup_body="$(mktemp)"
signin_body="$(mktemp)"
trap 'rm -f "$signup_body" "$signin_body"' EXIT

signup_status="$(
  curl --silent --show-error \
    --output "$signup_body" \
    --write-out '%{http_code}' \
    --request POST \
    --header "apikey: ${ANON_KEY}" \
    --header "Content-Type: application/json" \
    --data "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
    http://127.0.0.1:54321/auth/v1/signup
)"

test "$signup_status" = "200"

python - "$signup_body" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
assert payload.get("user", {}).get("email"), payload
assert payload.get("access_token") in (None, ""), payload
assert payload.get("session") in (None, {}), payload
print("Unverified signup returned no authenticated session.")
PY

signin_status="$(
  curl --silent --show-error \
    --output "$signin_body" \
    --write-out '%{http_code}' \
    --request POST \
    --header "apikey: ${ANON_KEY}" \
    --header "Content-Type: application/json" \
    --data "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
    "http://127.0.0.1:54321/auth/v1/token?grant_type=password"
)"

if [[ "$signin_status" -ge 200 && "$signin_status" -lt 300 ]]; then
  echo "Expected unverified email sign-in to fail, but it returned HTTP ${signin_status}." >&2
  cat "$signin_body" >&2
  exit 1
fi

python - "$signin_body" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
message = " ".join(
    str(payload.get(key, ""))
    for key in ("error", "error_description", "msg", "message", "error_code")
).lower()
assert "confirm" in message or "verified" in message, payload
print("Unverified email sign-in was correctly rejected.")
PY
