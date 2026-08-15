#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='privileged_audit_events'")"
test "$table_count" = "1"

trigger_count="$(psql_scalar "SELECT COUNT(*) FROM pg_trigger WHERE tgrelid='public.privileged_audit_events'::regclass AND tgname='privileged_audit_events_append_only' AND NOT tgisinternal")"
test "$trigger_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (
  id,
  auth_provider_user_id,
  email,
  status
)
VALUES (
  '00000000-0000-0000-0000-000000000006',
  'supabase-subject-audit-admin',
  'audit-admin@example.test',
  'active'
);

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000006', 'admin');

INSERT INTO privileged_audit_events (
  id,
  actor_user_id,
  actor_role,
  action,
  target_type,
  target_id,
  outcome,
  reason_code
)
VALUES (
  '00000000-0000-0000-0000-000000000106',
  '00000000-0000-0000-0000-000000000006',
  'admin',
  'account.status.change',
  'user',
  'target-user-id',
  'success',
  'policy_violation'
);
SQL

row_count="$(psql_scalar "SELECT COUNT(*) FROM privileged_audit_events WHERE id='00000000-0000-0000-0000-000000000106'")"
test "$row_count" = "1"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
UPDATE privileged_audit_events
SET outcome = 'error'
WHERE id = '00000000-0000-0000-0000-000000000106';
SQL
then
  echo "ERROR: privileged audit event UPDATE was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM privileged_audit_events
WHERE id = '00000000-0000-0000-0000-000000000106';
SQL
then
  echo "ERROR: privileged audit event DELETE was accepted" >&2
  exit 1
fi

unchanged="$(psql_scalar "SELECT COUNT(*) FROM privileged_audit_events WHERE id='00000000-0000-0000-0000-000000000106' AND outcome='success' AND reason_code='policy_violation'")"
test "$unchanged" = "1"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM users
WHERE id = '00000000-0000-0000-0000-000000000006';
SQL
then
  echo "ERROR: privileged audit actor deletion was accepted" >&2
  exit 1
fi

echo "Privileged audit schema verification passed."
