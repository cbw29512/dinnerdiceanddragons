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
trap 'rm -f "$create_body" "$signin_body" "$token_file"' EXIT

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
python - <<'PY'
import os
from pathlib import Path

from fastapi.testclient import TestClient

from app.auth.supabase_jwt import SupabaseJWTVerifier
from app.main import create_app

token = Path(os.environ["TOKEN_FILE"]).read_text()
claims = SupabaseJWTVerifier().verify(token)

assert claims["email"] == os.environ["EXPECTED_EMAIL"], claims
assert claims["aud"] == "authenticated", claims
assert claims["role"] == "authenticated", claims
assert claims["sub"], claims
print("DDD verified a real Supabase user token through the live JWKS endpoint.")

response = TestClient(create_app()).get(
    "/api/v1/me",
    headers={"Authorization": f"Bearer {token}"},
)
assert response.status_code == 200, response.text
principal = response.json()
assert principal == {
    "auth_provider": "supabase",
    "auth_provider_user_id": claims["sub"],
    "email": os.environ["EXPECTED_EMAIL"],
}, principal
print("DDD /api/v1/me accepted the real verified Supabase user token.")
PY
