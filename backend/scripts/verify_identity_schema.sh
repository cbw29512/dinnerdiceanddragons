#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

revision="$(psql_scalar 'SELECT version_num FROM alembic_version')"
test "$revision" = "0001_create_users"

id_type="$(psql_scalar "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id'")"
test "$id_type" = "uuid"

primary_key_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='p'")"
test "$primary_key_count" = "1"

auth_subject_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='u' AND conname='uq_users_auth_provider_user_id'")"
test "$auth_subject_unique_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'supabase-subject-001',
  'identity-one@example.test'
);
SQL

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'supabase-subject-001',
  'identity-two@example.test'
);
SQL
then
  echo "ERROR: duplicate auth_provider_user_id was accepted" >&2
  exit 1
fi

auth_subject_rows="$(psql_scalar "SELECT COUNT(*) FROM users WHERE auth_provider_user_id='supabase-subject-001'")"
test "$auth_subject_rows" = "1"

echo "Identity schema verification passed."
