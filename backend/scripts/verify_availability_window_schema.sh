#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

for table in player_availability_windows gm_availability_windows; do
  table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'")"
  test "$table_count" = "1"
done

player_profile_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_availability_windows'::regclass AND conname='fk_player_avail_profile' AND confdeltype='c'")"
test "$player_profile_fk" = "1"

player_rule_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_availability_windows'::regclass AND conname='fk_player_avail_rule' AND confdeltype='c'")"
test "$player_rule_fk" = "1"

gm_profile_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_availability_windows'::regclass AND conname='fk_gm_avail_profile' AND confdeltype='c'")"
test "$gm_profile_fk" = "1"

gm_rule_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_availability_windows'::regclass AND conname='fk_gm_avail_rule' AND confdeltype='c'")"
test "$gm_rule_fk" = "1"

player_rule_unique="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_availability_windows'::regclass AND conname='uq_player_availability_windows_recurring_rule_id'")"
test "$player_rule_unique" = "1"

gm_rule_unique="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_availability_windows'::regclass AND conname='uq_gm_availability_windows_recurring_rule_id'")"
test "$gm_rule_unique" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000050',
  'supabase-subject-availability-window',
  'availability-window@example.test',
  'active'
);

INSERT INTO player_profiles (id, user_id, postal_code, travel_radius_miles)
VALUES (
  '00000000-0000-0000-0000-000000000150',
  '00000000-0000-0000-0000-000000000050',
  '29501',
  25
);

INSERT INTO gm_profiles (id, user_id, postal_code, travel_radius_miles, gm_style)
VALUES (
  '00000000-0000-0000-0000-000000000250',
  '00000000-0000-0000-0000-000000000050',
  '29501',
  35,
  'Collaborative recurring games.'
);

INSERT INTO recurring_availability_rules (
  id, day_of_week, start_time, end_time, pattern_type, week_interval, timezone
)
VALUES
  ('00000000-0000-0000-0000-000000000850', 'friday', '18:00', '21:00', 'weekly_interval', 1, 'America/New_York'),
  ('00000000-0000-0000-0000-000000000851', 'saturday', '17:00', '20:00', 'weekly_interval', 1, 'America/New_York');

INSERT INTO player_availability_windows (id, player_profile_id, recurring_rule_id)
VALUES (
  '00000000-0000-0000-0000-000000000550',
  '00000000-0000-0000-0000-000000000150',
  '00000000-0000-0000-0000-000000000850'
);

INSERT INTO gm_availability_windows (id, gm_profile_id, recurring_rule_id)
VALUES (
  '00000000-0000-0000-0000-000000000650',
  '00000000-0000-0000-0000-000000000250',
  '00000000-0000-0000-0000-000000000851'
);
SQL

defaults="$(psql_scalar "SELECT (SELECT active::text FROM player_availability_windows WHERE id='00000000-0000-0000-0000-000000000550') || ':' || (SELECT active::text FROM gm_availability_windows WHERE id='00000000-0000-0000-0000-000000000650')")"
test "$defaults" = "true:true"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO player_availability_windows (id,player_profile_id,recurring_rule_id) VALUES ('00000000-0000-0000-0000-000000000551','00000000-0000-0000-0000-000000000150','00000000-0000-0000-0000-000000000850')"; then
  echo "ERROR: duplicate Player recurring rule was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO gm_availability_windows (id,gm_profile_id,recurring_rule_id) VALUES ('00000000-0000-0000-0000-000000000651','00000000-0000-0000-0000-000000009999','00000000-0000-0000-0000-000000000851')"; then
  echo "ERROR: GM window with missing profile was accepted" >&2
  exit 1
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM player_profiles
WHERE id = '00000000-0000-0000-0000-000000000150';
SQL

player_window_count="$(psql_scalar "SELECT COUNT(*) FROM player_availability_windows WHERE id='00000000-0000-0000-0000-000000000550'")"
test "$player_window_count" = "0"

player_rule_count="$(psql_scalar "SELECT COUNT(*) FROM recurring_availability_rules WHERE id='00000000-0000-0000-0000-000000000850'")"
test "$player_rule_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM recurring_availability_rules
WHERE id = '00000000-0000-0000-0000-000000000851';
SQL

gm_window_count="$(psql_scalar "SELECT COUNT(*) FROM gm_availability_windows WHERE id='00000000-0000-0000-0000-000000000650'")"
test "$gm_window_count" = "0"

echo "Profile availability-window schema verification passed."
