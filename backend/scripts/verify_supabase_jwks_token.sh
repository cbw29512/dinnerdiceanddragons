#!/usr/bin/env bash
set -euo pipefail

# Prove that the production verifier and `/api/v1/me` accept a real confirmed
# Supabase user token by fetching the local Auth server's asymmetric JWKS. No
# signing secret is supplied to the application verifier.

eval "$(npx --yes supabase@2.110.0 status -o env)"

test -n "${ANON_KEY:-}"
test -n "${SERVICE_ROLE_KEY:-}"

email="verified-jwks-$(date +%s)-${RANDOM}@example.com"
password="DDD-jwks-test-${RANDOM}-Aa1!"
create_body="$(mktemp)"
signin_body="$(mktemp)"
token_file="$(mktemp)"
subject_file="$(mktemp)"
me_body="$(mktemp)"
api_log="$(mktemp)"
api_pid=""

cleanup() {
  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  rm -f "$create_body" "$signin_body" "$token_file" "$subject_file" "$me_body" "$api_log"
}
trap cleanup EXIT

create_status="$(
  curl --silent --show-error \
    --output "$create_body" \
    --write-out '%{http_code}' \
    --request POST \
    --header "apikey: ${SERVICE_ROLE_KEY}" \
    --header "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    --header "Content-Type: application/json" \
    --data "{\"email\":\"${email}\",\"password\":\"${password}\",\"email_confirm\":true}" \
    http://127.0.0.1:54321/auth/v1/admin/users
)"

test "$create_status" = "200"

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

test "$signin_status" = "200"

python - "$signin_body" "$token_file" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
token = payload.get("access_token")
assert isinstance(token, str) and token, payload
Path(sys.argv[2]).write_text(token)
print("Confirmed Supabase user received an access token.")
PY

SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_JWT_AUDIENCE="authenticated" \
TOKEN_FILE="$token_file" \
EXPECTED_EMAIL="$email" \
SUBJECT_FILE="$subject_file" \
python - <<'PY'
import os
from pathlib import Path

from app.auth.supabase_jwt import SupabaseJWTVerifier

token = Path(os.environ["TOKEN_FILE"]).read_text()
claims = SupabaseJWTVerifier().verify(token)

assert claims["email"] == os.environ["EXPECTED_EMAIL"], claims
assert claims["aud"] == "authenticated", claims
assert claims["role"] == "authenticated", claims
assert claims["sub"], claims
Path(os.environ["SUBJECT_FILE"]).write_text(str(claims["sub"]))
print("DDD verified a real Supabase user token through the live JWKS endpoint.")
PY

# Exercise the actual ASGI application through a real local HTTP server using
# only production dependencies. This avoids making the production smoke test
# depend on Starlette's in-process TestClient package requirements.
SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_JWT_AUDIENCE="authenticated" \
uvicorn app.main:app --host 127.0.0.1 --port 8011 >"$api_log" 2>&1 &
api_pid=$!

for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:8011/api/v1/health >/dev/null; then
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "DDD API exited before becoming ready." >&2
    cat "$api_log" >&2
    exit 1
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "DDD API did not become ready for the Auth smoke test." >&2
    cat "$api_log" >&2
    exit 1
  fi
  sleep 0.25
done

token="$(cat "$token_file")"
me_status="$(
  curl --silent --show-error \
    --output "$me_body" \
    --write-out '%{http_code}' \
    --header "Authorization: Bearer ${token}" \
    http://127.0.0.1:8011/api/v1/me
)"

test "$me_status" = "200"

EXPECTED_EMAIL="$email" \
SUBJECT_FILE="$subject_file" \
ME_BODY="$me_body" \
python - <<'PY'
import json
import os
from pathlib import Path

principal = json.loads(Path(os.environ["ME_BODY"]).read_text())
expected_subject = Path(os.environ["SUBJECT_FILE"]).read_text()
assert principal == {
    "auth_provider": "supabase",
    "auth_provider_user_id": expected_subject,
    "email": os.environ["EXPECTED_EMAIL"],
}, principal
print("DDD /api/v1/me accepted the real verified Supabase user token over HTTP.")
PY
