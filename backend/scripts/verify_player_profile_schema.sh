#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='player_profiles'")"
test "$table_count" = "1"

user_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_profiles'::regclass AND contype='u' AND conname='uq_player_profiles_user_id'")"
test "$user_unique_count" = "1"

user_fk_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_profiles'::regclass AND contype='f' AND conname='fk_player_profiles_user_id_users' AND confdeltype='c'")"
test "$user_fk_count" = "1"

radius_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_profiles'::regclass AND contype='c' AND conname='ck_player_profiles_travel_radius_miles'")"
test "$radius_check_count" = "1"

format_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_profiles'::regclass AND contype='c' AND conname='ck_player_profiles_preferred_format'")"
test "$format_check_count" = "1"

postal_check_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_profiles'::regclass AND contype='c' AND conname='ck_player_profiles_postal_code_length'")"
test "$postal_check_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000020',
  'supabase-subject-player-profile',
  'player-profile@example.test',
  'active'
);

INSERT INTO user_roles (user_id, role)
VALUES ('00000000-0000-0000-0000-000000000020', 'player');

INSERT INTO player_profiles (
  id,
  user_id,
  bio,
  postal_code,
  travel_radius_miles,
  accessibility_notes_private
)
VALUES (
  '00000000-0000-0000-0000-000000000120',
  '00000000-0000-0000-0000-000000000020',
  'Friendly local Player looking for a recurring table.',
  '29501',
  25,
  'Needs a chair with back support.'
);
SQL

default_contract="$(psql_scalar "SELECT preferred_format || ':' || willing_to_learn_new_system::text || ':' || environment_preferences::text FROM player_profiles WHERE id='00000000-0000-0000-0000-000000000120'")"
test "$default_contract" = "any:true:[]"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
UPDATE player_profiles
SET environment_preferences = '["quieter_venue", "well_lit"]'::json
WHERE id = '00000000-0000-0000-0000-000000000120';
SQL

environment_contract="$(psql_scalar "SELECT environment_preferences::text FROM player_profiles WHERE id='00000000-0000-0000-0000-000000000120'")"
test "$environment_contract" = '["quieter_venue", "well_lit"]'

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO player_profiles (id, user_id, postal_code, travel_radius_miles)
VALUES (
  '00000000-0000-0000-0000-000000000121',
  '00000000-0000-0000-0000-000000000020',
  '29501',
  10
);
SQL
then
  echo "ERROR: a second PlayerProfile for the same user was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000021',
  'supabase-subject-player-radius',
  'player-radius@example.test',
  'active'
);
INSERT INTO player_profiles (id, user_id, postal_code, travel_radius_miles)
VALUES (
  '00000000-0000-0000-0000-000000000122',
  '00000000-0000-0000-0000-000000000021',
  '29501',
  0
);
SQL
then
  echo "ERROR: invalid Player travel radius was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000022',
  'supabase-subject-player-format',
  'player-format@example.test',
  'active'
);
INSERT INTO player_profiles (
  id,
  user_id,
  postal_code,
  travel_radius_miles,
  preferred_format
)
VALUES (
  '00000000-0000-0000-0000-000000000123',
  '00000000-0000-0000-0000-000000000022',
  '29501',
  25,
  'anything_goes_forever'
);
SQL
then
  echo "ERROR: invalid Player preferred format was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000023',
  'supabase-subject-player-postal',
  'player-postal@example.test',
  'active'
);
INSERT INTO player_profiles (id, user_id, postal_code, travel_radius_miles)
VALUES (
  '00000000-0000-0000-0000-000000000124',
  '00000000-0000-0000-0000-000000000023',
  '2950',
  25
);
SQL
then
  echo "ERROR: invalid Player postal code length was accepted" >&2
  exit 1
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM users
WHERE id = '00000000-0000-0000-0000-000000000020';
SQL

cascaded_profile_count="$(psql_scalar "SELECT COUNT(*) FROM player_profiles WHERE user_id='00000000-0000-0000-0000-000000000020'")"
test "$cascaded_profile_count" = "0"

echo "PlayerProfile schema verification passed."
