#!/usr/bin/env bash
set -euo pipefail

# End-to-end Step 1 proof: two confirmed Supabase identities become two distinct
# durable DDD users, receive different database roles, and cannot cross each
# other's server-side authorization boundaries.

eval "$(npx --yes supabase@2.110.0 status -o env)"

test -n "${ANON_KEY:-}"
test -n "${SERVICE_ROLE_KEY:-}"

database_url="postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres"
email_a="step1-alice-$(date +%s)-${RANDOM}@example.com"
email_b="step1-bob-$(date +%s)-${RANDOM}@example.com"
password_a="DDD-Alice-${RANDOM}-Aa1!"
password_b="DDD-Bob-${RANDOM}-Bb2!"
token_a="$(mktemp)"
token_b="$(mktemp)"
me_a="$(mktemp)"
me_b="$(mktemp)"
api_log="$(mktemp)"
api_pid=""

cleanup() {
  if [[ -n "$api_pid" ]] && kill -0 "$api_pid" 2>/dev/null; then
    kill "$api_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
  fi
  rm -f "$token_a" "$token_b" "$me_a" "$me_b" "$api_log"
}
trap cleanup EXIT

create_confirmed_user() {
  local email="$1"
  local password="$2"
  local body
  body="$(mktemp)"
  local status
  status="$(
    curl --silent --show-error \
      --output "$body" \
      --write-out '%{http_code}' \
      --request POST \
      --header "apikey: ${SERVICE_ROLE_KEY}" \
      --header "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
      --header "Content-Type: application/json" \
      --data "{\"email\":\"${email}\",\"password\":\"${password}\",\"email_confirm\":true}" \
      http://127.0.0.1:54321/auth/v1/admin/users
  )"
  rm -f "$body"
  test "$status" = "200"
}

sign_in_to_file() {
  local email="$1"
  local password="$2"
  local destination="$3"
  local body
  body="$(mktemp)"
  local status
  status="$(
    curl --silent --show-error \
      --output "$body" \
      --write-out '%{http_code}' \
      --request POST \
      --header "apikey: ${ANON_KEY}" \
      --header "Content-Type: application/json" \
      --data "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
      "http://127.0.0.1:54321/auth/v1/token?grant_type=password"
  )"
  test "$status" = "200"
  python - "$body" "$destination" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
token = payload.get("access_token")
assert isinstance(token, str) and token, payload
Path(sys.argv[2]).write_text(token)
PY
  rm -f "$body"
}

create_confirmed_user "$email_a" "$password_a"
create_confirmed_user "$email_b" "$password_b"
sign_in_to_file "$email_a" "$password_a" "$token_a"
sign_in_to_file "$email_b" "$password_b" "$token_b"

DATABASE_URL="$database_url" alembic -c backend/alembic.ini upgrade head

SUPABASE_URL="http://127.0.0.1:54321" \
SUPABASE_JWT_AUDIENCE="authenticated" \
DATABASE_URL="$database_url" \
uvicorn app.main:app --host 127.0.0.1 --port 8012 >"$api_log" 2>&1 &
api_pid=$!

for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:8012/api/v1/health >/dev/null; then
    break
  fi
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "DDD API exited before two-user authorization verification." >&2
    cat "$api_log" >&2
    exit 1
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "DDD API did not become ready for two-user authorization verification." >&2
    cat "$api_log" >&2
    exit 1
  fi
  sleep 0.25
done

call_me() {
  local token_file="$1"
  local output_file="$2"
  local token
  token="$(cat "$token_file")"
  local status
  status="$(
    curl --silent --show-error \
      --output "$output_file" \
      --write-out '%{http_code}' \
      --header "Authorization: Bearer ${token}" \
      http://127.0.0.1:8012/api/v1/me
  )"
  test "$status" = "200"
}

call_me "$token_a" "$me_a"
call_me "$token_b" "$me_b"

ME_A="$me_a" ME_B="$me_b" EMAIL_A="$email_a" EMAIL_B="$email_b" python - <<'PY'
import json
import os
from pathlib import Path
from uuid import UUID

alice = json.loads(Path(os.environ["ME_A"]).read_text())
bob = json.loads(Path(os.environ["ME_B"]).read_text())
UUID(alice["ddd_user_id"])
UUID(bob["ddd_user_id"])
assert alice["ddd_user_id"] != bob["ddd_user_id"], (alice, bob)
assert alice["auth_provider_user_id"] != bob["auth_provider_user_id"], (alice, bob)
assert alice["email"] == os.environ["EMAIL_A"], alice
assert bob["email"] == os.environ["EMAIL_B"], bob
assert alice["status"] == "active", alice
assert bob["status"] == "active", bob
print("Two real Supabase identities mapped to two distinct active DDD users.")
PY

DATABASE_URL="$database_url" \
ME_A="$me_a" \
ME_B="$me_b" \
python - <<'PY'
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.dependencies.ownership import (
    require_game_owner,
    require_message_sender,
    require_profile_owner,
    require_registration_owner,
    require_venue_manager_identity,
)
from app.api.dependencies.roles import require_dm, require_player, require_venue_manager
from app.api.dependencies.venue_access import (
    VenueManagerRelationship,
    require_verified_venue_relationship,
)
from app.models.user import User
from app.models.user_role import UserRole, UserRoleType

alice_id = UUID(json.loads(Path(os.environ["ME_A"]).read_text())["ddd_user_id"])
bob_id = UUID(json.loads(Path(os.environ["ME_B"]).read_text())["ddd_user_id"])
engine = create_engine(os.environ["DATABASE_URL"])


def forbidden(callable_) -> None:
    try:
        callable_()
    except HTTPException as exc:
        assert exc.status_code == 403, exc
    else:
        raise AssertionError("Cross-user authorization unexpectedly succeeded")


try:
    with Session(engine) as session:
        alice = session.scalar(select(User).where(User.id == alice_id))
        bob = session.scalar(select(User).where(User.id == bob_id))
        assert alice is not None and bob is not None

        session.add_all(
            [
                UserRole(user_id=alice.id, role=UserRoleType.PLAYER.value),
                UserRole(user_id=alice.id, role=UserRoleType.GM.value),
                UserRole(user_id=bob.id, role=UserRoleType.VENUE_MANAGER.value),
            ]
        )
        session.flush()

        assert require_player(alice, session) is alice
        assert require_dm(alice, session) is alice
        assert require_venue_manager(bob, session) is bob
        forbidden(lambda: require_venue_manager(alice, session))
        forbidden(lambda: require_dm(bob, session))
        forbidden(lambda: require_player(bob, session))

        ownership_helpers = (
            require_profile_owner,
            require_game_owner,
            require_registration_owner,
            require_venue_manager_identity,
            require_message_sender,
        )
        for helper in ownership_helpers:
            forbidden(lambda helper=helper: helper(alice, bob.id))
            forbidden(lambda helper=helper: helper(bob, alice.id))

        venue_id = uuid4()
        bob_relationship = VenueManagerRelationship(
            venue_id=venue_id,
            user_id=bob.id,
            verified_at=datetime.now(UTC),
        )
        assert require_verified_venue_relationship(bob, bob_relationship, venue_id) is bob
        forbidden(
            lambda: require_verified_venue_relationship(
                alice,
                bob_relationship,
                venue_id,
            )
        )

        session.rollback()
        print(
            "Two authenticated DDD users held distinct/multiple roles and were "
            "blocked from each other's protected boundaries."
        )
finally:
    engine.dispose()
PY
