#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='gm_profiles'")"
test "$table_count" = "1"

user_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_profiles'::regclass AND contype='u' AND conname='uq_gm_profiles_user_id'")"
test "$user_unique_count" = "1"

user_fk_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_profiles'::regclass AND contype='f' AND conname='fk_gm_profiles_user_id_users' AND confdeltype='c'")"
test "$user_fk_count" = "1"

radius_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_profiles'::regclass AND contype='c' AND conname='ck_gm_profiles_travel_radius_miles'")"
test "$radius_check_count" = "1"

postal_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_profiles'::regclass AND contype='c' AND conname='ck_gm_profiles_postal_code_length'")"
test "$postal_check_count" = "1"

style_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_profiles'::regclass AND contype='c' AND conname='ck_gm_profiles_gm_style_length'")"
test "$style_check_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  'supabase-subject-gm-profile',
  'gm-profile@example.test',
  'active'
);

INSERT INTO user_roles (user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000030', 'player'),
  ('00000000-0000-0000-0000-000000000030', 'gm');

INSERT INTO player_profiles (
  id,
  user_id,
  postal_code,
  travel_radius_miles
)
VALUES (
  '00000000-0000-0000-0000-000000000130',
  '00000000-0000-0000-0000-000000000030',
  '29501',
  25
);

INSERT INTO gm_profiles (
  id,
  user_id,
  bio,
  postal_code,
  travel_radius_miles,
  gm_style
)
VALUES (
  '00000000-0000-0000-0000-000000000131',
  '00000000-0000-0000-0000-000000000030',
  'Local DM building recurring public tables.',
  '29501',
  50,
  'Roleplay-forward with tactical combat and clear expectations.'
);
SQL

profile_count="$(psql_scalar "SELECT (SELECT COUNT(*) FROM player_profiles WHERE user_id='00000000-0000-0000-0000-000000000030') + (SELECT COUNT(*) FROM gm_profiles WHERE user_id='00000000-0000-0000-0000-000000000030')")"
test "$profile_count" = "2"

gm_contract="$(psql_scalar "SELECT postal_code || ':' || travel_radius_miles::text || ':' || beginner_friendly::text FROM gm_profiles WHERE id='00000000-0000-0000-0000-000000000131'")"
test "$gm_contract" = "29501:50:false"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO gm_profiles (id, user_id, postal_code, travel_radius_miles, gm_style)
VALUES (
  '00000000-0000-0000-0000-000000000132',
  '00000000-0000-0000-0000-000000000030',
  '29501',
  10,
  'Another style.'
);
SQL
then
  echo "ERROR: a second GMProfile for the same user was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000031',
  'supabase-subject-gm-radius',
  'gm-radius@example.test',
  'active'
);
INSERT INTO gm_profiles (id, user_id, postal_code, travel_radius_miles, gm_style)
VALUES (
  '00000000-0000-0000-0000-000000000133',
  '00000000-0000-0000-0000-000000000031',
  '29501',
  101,
  'Balanced table.'
);
SQL
then
  echo "ERROR: invalid GM travel radius was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000032',
  'supabase-subject-gm-postal',
  'gm-postal@example.test',
  'active'
);
INSERT INTO gm_profiles (id, user_id, postal_code, travel_radius_miles, gm_style)
VALUES (
  '00000000-0000-0000-0000-000000000134',
  '00000000-0000-0000-0000-000000000032',
  '2950',
  25,
  'Balanced table.'
);
SQL
then
  echo "ERROR: invalid GM postal code length was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000033',
  'supabase-subject-gm-style',
  'gm-style@example.test',
  'active'
);
INSERT INTO gm_profiles (id, user_id, postal_code, travel_radius_miles, gm_style)
VALUES (
  '00000000-0000-0000-0000-000000000135',
  '00000000-0000-0000-0000-000000000033',
  '29501',
  25,
  '   '
);
SQL
then
  echo "ERROR: blank GM style was accepted" >&2
  exit 1
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM users
WHERE id = '00000000-0000-0000-0000-000000000030';
SQL

cascaded_gm_count="$(psql_scalar "SELECT COUNT(*) FROM gm_profiles WHERE user_id='00000000-0000-0000-0000-000000000030'")"
test "$cascaded_gm_count" = "0"

cascaded_player_count="$(psql_scalar "SELECT COUNT(*) FROM player_profiles WHERE user_id='00000000-0000-0000-0000-000000000030'")"
test "$cascaded_player_count" = "0"

echo "GMProfile schema verification passed."
