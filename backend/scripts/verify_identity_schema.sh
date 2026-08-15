#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

revision="$(psql_scalar 'SELECT version_num FROM alembic_version')"
test "$revision" = "0002_create_user_roles"

id_type="$(psql_scalar "SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='id'")"
test "$id_type" = "uuid"

primary_key_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='p'")"
test "$primary_key_count" = "1"

auth_subject_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='u' AND conname='uq_users_auth_provider_user_id'")"
test "$auth_subject_unique_count" = "1"

email_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='u' AND conname='uq_users_email'")"
test "$email_unique_count" = "1"

display_name_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='u' AND conname='uq_users_display_name_normalized'")"
test "$display_name_unique_count" = "1"

users_status_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.users'::regclass AND contype='c' AND conname='ck_users_status'")"
test "$users_status_check_count" = "1"

status_default_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='status' AND column_default LIKE '%pending_verification%'")"
test "$status_default_count" = "1"

created_at_contract="$(psql_scalar "SELECT data_type || ':' || is_nullable || ':' || CASE WHEN column_default IS NULL THEN 'no-default' ELSE 'default' END FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='created_at'")"
test "$created_at_contract" = "timestampwithtimezone:NO:default"

updated_at_contract="$(psql_scalar "SELECT data_type || ':' || is_nullable || ':' || CASE WHEN column_default IS NULL THEN 'no-default' ELSE 'default' END FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='updated_at'")"
test "$updated_at_contract" = "timestampwithtimezone:NO:default"

last_login_at_contract="$(psql_scalar "SELECT data_type || ':' || is_nullable || ':' || CASE WHEN column_default IS NULL THEN 'no-default' ELSE 'default' END FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='last_login_at'")"
test "$last_login_at_contract" = "timestampwithtimezone:YES:no-default"

user_roles_primary_key_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND contype='p' AND conname='pk_user_roles'")"
test "$user_roles_primary_key_count" = "1"

user_roles_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND contype='c' AND conname='ck_user_roles_role'")"
test "$user_roles_check_count" = "1"

user_roles_fk_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.user_roles'::regclass AND contype='f' AND conname='fk_user_roles_user_id_users' AND confdeltype='c'")"
test "$user_roles_fk_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'supabase-subject-001',
  'identity-one@example.test'
);
SQL

initial_status="$(psql_scalar "SELECT status FROM users WHERE id='00000000-0000-0000-0000-000000000001'")"
test "$initial_status" = "pending_verification"

created_at_present="$(psql_scalar "SELECT COUNT(*) FROM users WHERE id='00000000-0000-0000-0000-000000000001' AND created_at IS NOT NULL")"
test "$created_at_present" = "1"

updated_at_present="$(psql_scalar "SELECT COUNT(*) FROM users WHERE id='00000000-0000-0000-0000-000000000001' AND updated_at IS NOT NULL")"
test "$updated_at_present" = "1"

last_login_initially_null="$(psql_scalar "SELECT COUNT(*) FROM users WHERE id='00000000-0000-0000-0000-000000000001' AND last_login_at IS NULL")"
test "$last_login_initially_null" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
UPDATE users SET last_login_at = CURRENT_TIMESTAMP
WHERE id = '00000000-0000-0000-0000-000000000001';
SQL

last_login_present="$(psql_scalar "SELECT COUNT(*) FROM users WHERE id='00000000-0000-0000-0000-000000000001' AND last_login_at IS NOT NULL")"
test "$last_login_present" = "1"

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

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email)
VALUES (
  '00000000-0000-0000-0000-000000000005',
  'supabase-subject-005',
  'identity-one@example.test'
);
SQL
then
  echo "ERROR: duplicate email was accepted" >&2
  exit 1
fi

email_rows="$(psql_scalar "SELECT COUNT(*) FROM users WHERE email='identity-one@example.test'")"
test "$email_rows" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (
  id,
  auth_provider_user_id,
  email,
  display_name,
  display_name_normalized
)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  'supabase-subject-003',
  'display-one@example.test',
  'Chris',
  'chris'
);
SQL

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (
  id,
  auth_provider_user_id,
  email,
  display_name,
  display_name_normalized
)
VALUES (
  '00000000-0000-0000-0000-000000000004',
  'supabase-subject-004',
  'display-two@example.test',
  'cHrIs',
  'chris'
);
SQL
then
  echo "ERROR: duplicate display_name_normalized was accepted" >&2
  exit 1
fi

display_name_rows="$(psql_scalar "SELECT COUNT(*) FROM users WHERE display_name_normalized='chris'")"
test "$display_name_rows" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO user_roles (user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'player'),
  ('00000000-0000-0000-0000-000000000001', 'gm'),
  ('00000000-0000-0000-0000-000000000001', 'venue_manager');
SQL

multi_role_count="$(psql_scalar "SELECT COUNT(*) FROM user_roles WHERE user_id='00000000-0000-0000-0000-000000000001'")"
test "$multi_role_count" = "3"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'player');
SQL
then
  echo "ERROR: duplicate user role was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'superuser');
SQL
then
  echo "ERROR: invalid user role was accepted" >&2
  exit 1
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
UPDATE users SET status = 'active'
WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE users SET status = 'restricted'
WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE users SET status = 'suspended'
WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE users SET status = 'banned'
WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE users SET status = 'pending_verification'
WHERE id = '00000000-0000-0000-0000-000000000001';
SQL

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
UPDATE users SET status = 'disabled'
WHERE id = '00000000-0000-0000-0000-000000000001';
SQL
then
  echo "ERROR: invalid account status was accepted" >&2
  exit 1
fi

final_status="$(psql_scalar "SELECT status FROM users WHERE id='00000000-0000-0000-0000-000000000001'")"
test "$final_status" = "pending_verification"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM users
WHERE id = '00000000-0000-0000-0000-000000000001';
SQL

cascaded_roles="$(psql_scalar "SELECT COUNT(*) FROM user_roles WHERE user_id='00000000-0000-0000-0000-000000000001'")"
test "$cascaded_roles" = "0"

echo "Identity schema verification passed."
