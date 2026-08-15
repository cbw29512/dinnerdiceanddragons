#!/usr/bin/env bash
set -euo pipefail

# Prove that the production verifier and `/api/v1/me` accept a real confirmed
# Supabase user token, then safely create/reuse one durable DDD User in real
# PostgreSQL. No signing secret is supplied to the application verifier.

eval "$(npx --yes supabase@2.110.0 status -o env)"

test -n "${ANON_KEY:-}"
test -n "${SERVICE_ROLE_KEY:-}"

email="verified-jwks-$(date +%s)-${RANDOM}@example.com"
password="DDD-jwks-test-${RANDOM}-Aa1!"
database_url="postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres"
create_body="$(mktemp)"
signin_body="$(mktemp)"
token_file="$(mktemp)"
subject_file="$(mktemp)"
me_body="$(mktemp)"
second_me_body="$(mktemp)"
ddd_user_id_file="$(mktemp)"
api_log="$(mktemp)"
api_pid=""

cleanup() {
  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  rm -f \
    "$create_body" \
    "$signin_body" \
    "$token_file" \
    "$subject_file" \
    "$me_body" \
    "$second_me_body" \
    "$ddd_user_id_file" \
    "$api_log"
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

# Use the local Supabase PostgreSQL instance as the managed-Postgres analogue
# for this identity integration test, then apply the portable DDD migrations.
DATABASE_URL="$database_url" alembic -c backend/alembic.ini upgrade head

SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_JWT_AUDIENCE="authenticated" \
DATABASE_URL="$database_url" \
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
DDD_USER_ID_FILE="$ddd_user_id_file" \
python - <<'PY'
import json
import os
from pathlib import Path
from uuid import UUID

principal = json.loads(Path(os.environ["ME_BODY"]).read_text())
expected_subject = Path(os.environ["SUBJECT_FILE"]).read_text()
ddd_user_id = principal.get("ddd_user_id")
UUID(ddd_user_id)
assert principal == {
    "ddd_user_id": ddd_user_id,
    "auth_provider": "supabase",
    "auth_provider_user_id": expected_subject,
    "email": os.environ["EXPECTED_EMAIL"],
    "display_name": None,
    "status": "active",
}, principal
Path(os.environ["DDD_USER_ID_FILE"]).write_text(ddd_user_id)
print("First /api/v1/me request created or linked the durable DDD user.")
PY

second_me_status="$(
  curl --silent --show-error \
    --output "$second_me_body" \
    --write-out '%{http_code}' \
    --header "Authorization: Bearer ${token}" \
    http://127.0.0.1:8011/api/v1/me
)"

test "$second_me_status" = "200"

ME_BODY="$me_body" SECOND_ME_BODY="$second_me_body" python - <<'PY'
import json
import os
from pathlib import Path

first = json.loads(Path(os.environ["ME_BODY"]).read_text())
second = json.loads(Path(os.environ["SECOND_ME_BODY"]).read_text())
assert second["ddd_user_id"] == first["ddd_user_id"], (first, second)
assert second["email"] == first["email"], (first, second)
print("Repeated /api/v1/me request reused the same durable DDD user.")
PY

DATABASE_URL="$database_url" \
SUBJECT_FILE="$subject_file" \
DDD_USER_ID_FILE="$ddd_user_id_file" \
EXPECTED_EMAIL="$email" \
python - <<'PY'
import os
from pathlib import Path
from uuid import UUID

from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.models.user import User

engine = create_engine(os.environ["DATABASE_URL"])
try:
    with Session(engine) as session:
        expected_subject = Path(os.environ["SUBJECT_FILE"]).read_text()
        expected_id = UUID(Path(os.environ["DDD_USER_ID_FILE"]).read_text())
        user = session.scalar(
            select(User).where(User.auth_provider_user_id == expected_subject)
        )
        assert user is not None
        assert user.id == expected_id
        assert user.email == os.environ["EXPECTED_EMAIL"]
        assert user.status == "active"
        assert user.email_verified_at is not None
        assert user.last_login_at is not None
        count = session.scalar(
            select(func.count()).select_from(User).where(
                User.auth_provider_user_id == expected_subject
            )
        )
        assert count == 1, count
        print("PostgreSQL contains exactly one durable DDD user for the Supabase subject.")
finally:
    engine.dispose()
PY
