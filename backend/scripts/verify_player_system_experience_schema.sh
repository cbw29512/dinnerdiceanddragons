#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='player_system_experiences'")"
test "$table_count" = "1"

unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_system_experiences'::regclass AND contype='u' AND conname='uq_player_system_experiences_profile_system'")"
test "$unique_count" = "1"

profile_fk_delete="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conrelid='public.player_system_experiences'::regclass AND conname='fk_player_system_experiences_player_profile_id_player_profiles'")"
test "$profile_fk_delete" = "c"

system_fk_delete="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conrelid='public.player_system_experiences'::regclass AND conname='fk_player_system_experiences_game_system_id_game_systems'")"
test "$system_fk_delete" = "r"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000060',
  'supabase-subject-player-system-experience',
  'player-system-experience@example.test',
  'active'
);

INSERT INTO player_profiles (id, user_id, postal_code, travel_radius_miles)
VALUES (
  '00000000-0000-0000-0000-000000000160',
  '00000000-0000-0000-0000-000000000060',
  '29501',
  25
);

INSERT INTO game_systems (id, name, edition, slug)
VALUES (
  '00000000-0000-0000-0000-000000000560',
  'Pathfinder',
  '2e',
  'pathfinder-2e-player-experience'
);

INSERT INTO player_system_experiences (
  id,
  player_profile_id,
  game_system_id,
  years_playing,
  comfort_level,
  experience_notes
)
VALUES (
  '00000000-0000-0000-0000-000000000660',
  '00000000-0000-0000-0000-000000000160',
  '00000000-0000-0000-0000-000000000560',
  2.5,
  'comfortable',
  'Self-described Player experience; not platform reputation.'
);
SQL

round_trip="$(psql_scalar "SELECT years_playing::text || ':' || comfort_level FROM player_system_experiences WHERE id='00000000-0000-0000-0000-000000000660'")"
test "$round_trip" = "2.5:comfortable"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO player_system_experiences (
  id, player_profile_id, game_system_id, years_playing, comfort_level
)
VALUES (
  '00000000-0000-0000-0000-000000000661',
  '00000000-0000-0000-0000-000000000160',
  '00000000-0000-0000-0000-000000000560',
  3.0,
  'very_experienced'
);
SQL
then
  echo "ERROR: duplicate PlayerProfile/GameSystem experience was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000561',
  'Bad Years System',
  'bad-years-player-experience'
);
INSERT INTO player_system_experiences (
  id, player_profile_id, game_system_id, years_playing, comfort_level
)
VALUES (
  '00000000-0000-0000-0000-000000000662',
  '00000000-0000-0000-0000-000000000160',
  '00000000-0000-0000-0000-000000000561',
  80.1,
  'comfortable'
);
SQL
then
  echo "ERROR: PlayerSystemExperience years above 80 were accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000562',
  'Bad Comfort System',
  'bad-comfort-player-experience'
);
INSERT INTO player_system_experiences (
  id, player_profile_id, game_system_id, years_playing, comfort_level
)
VALUES (
  '00000000-0000-0000-0000-000000000663',
  '00000000-0000-0000-0000-000000000160',
  '00000000-0000-0000-0000-000000000562',
  1.0,
  'verified_expert'
);
SQL
then
  echo "ERROR: invalid Player comfort level was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM game_systems
WHERE id = '00000000-0000-0000-0000-000000000560';
SQL
then
  echo "ERROR: referenced GameSystem deletion was accepted" >&2
  exit 1
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM player_profiles
WHERE id = '00000000-0000-0000-0000-000000000160';
SQL

experience_count_after_profile_delete="$(psql_scalar "SELECT COUNT(*) FROM player_system_experiences WHERE id='00000000-0000-0000-0000-000000000660'")"
test "$experience_count_after_profile_delete" = "0"

system_count_after_profile_delete="$(psql_scalar "SELECT COUNT(*) FROM game_systems WHERE id='00000000-0000-0000-0000-000000000560'")"
test "$system_count_after_profile_delete" = "1"

echo "PlayerSystemExperience schema verification passed."
