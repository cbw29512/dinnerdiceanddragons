#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('gm_system_experiences','gm_system_formats')")"
test "$table_count" = "2"

unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_system_experiences'::regclass AND contype='u' AND conname='uq_gm_system_experiences_profile_system'")"
test "$unique_count" = "1"

format_pk_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_system_formats'::regclass AND contype='p' AND conname='pk_gm_system_formats'")"
test "$format_pk_count" = "1"

profile_fk_delete="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conrelid='public.gm_system_experiences'::regclass AND conname='fk_gm_system_experiences_gm_profile_id_gm_profiles'")"
test "$profile_fk_delete" = "c"

system_fk_delete="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conrelid='public.gm_system_experiences'::regclass AND conname='fk_gm_system_experiences_game_system_id_game_systems'")"
test "$system_fk_delete" = "r"

format_fk_delete="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conrelid='public.gm_system_formats'::regclass AND conname='fk_gm_system_formats_experience_id'")"
test "$format_fk_delete" = "c"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000070',
  'supabase-subject-gm-system-experience',
  'gm-system-experience@example.test',
  'active'
);

INSERT INTO gm_profiles (
  id, user_id, postal_code, travel_radius_miles, beginner_friendly, gm_style
)
VALUES (
  '00000000-0000-0000-0000-000000000170',
  '00000000-0000-0000-0000-000000000070',
  '29501',
  25,
  true,
  'Roleplay-forward with tactical combat.'
);

INSERT INTO game_systems (id, name, edition, slug)
VALUES (
  '00000000-0000-0000-0000-000000000570',
  'Call of Cthulhu',
  '7e',
  'call-of-cthulhu-7e-gm-experience'
);

INSERT INTO gm_system_experiences (
  id,
  gm_profile_id,
  game_system_id,
  years_playing,
  years_gming,
  comfort_level,
  preferred_player_experience,
  experience_notes
)
VALUES (
  '00000000-0000-0000-0000-000000000670',
  '00000000-0000-0000-0000-000000000170',
  '00000000-0000-0000-0000-000000000570',
  8.5,
  5.0,
  'very_comfortable',
  'any',
  'Self-described GM experience; not platform reputation.'
);

INSERT INTO gm_system_formats (gm_system_experience_id, format)
VALUES
  ('00000000-0000-0000-0000-000000000670', 'one_shot'),
  ('00000000-0000-0000-0000-000000000670', 'short_campaign'),
  ('00000000-0000-0000-0000-000000000670', 'long_campaign');
SQL

round_trip="$(psql_scalar "SELECT years_playing::text || ':' || years_gming::text || ':' || comfort_level || ':' || preferred_player_experience FROM gm_system_experiences WHERE id='00000000-0000-0000-0000-000000000670'")"
test "$round_trip" = "8.5:5.0:very_comfortable:any"

format_count="$(psql_scalar "SELECT COUNT(*) FROM gm_system_formats WHERE gm_system_experience_id='00000000-0000-0000-0000-000000000670'")"
test "$format_count" = "3"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO gm_system_experiences (
  id, gm_profile_id, game_system_id, years_playing, years_gming,
  comfort_level, preferred_player_experience
)
VALUES (
  '00000000-0000-0000-0000-000000000671',
  '00000000-0000-0000-0000-000000000170',
  '00000000-0000-0000-0000-000000000570',
  10.0,
  7.0,
  'expert',
  'experienced'
);
SQL
then
  echo "ERROR: duplicate GMProfile/GameSystem experience was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000571',
  'Bad GM Years System',
  'bad-gm-years-system'
);
INSERT INTO gm_system_experiences (
  id, gm_profile_id, game_system_id, years_playing, years_gming,
  comfort_level, preferred_player_experience
)
VALUES (
  '00000000-0000-0000-0000-000000000672',
  '00000000-0000-0000-0000-000000000170',
  '00000000-0000-0000-0000-000000000571',
  10.0,
  80.1,
  'comfortable',
  'any'
);
SQL
then
  echo "ERROR: GM years above 80 were accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000572',
  'Bad GM Preference System',
  'bad-gm-preference-system'
);
INSERT INTO gm_system_experiences (
  id, gm_profile_id, game_system_id, years_playing, years_gming,
  comfort_level, preferred_player_experience
)
VALUES (
  '00000000-0000-0000-0000-000000000673',
  '00000000-0000-0000-0000-000000000170',
  '00000000-0000-0000-0000-000000000572',
  10.0,
  4.0,
  'expert',
  'verified_only'
);
SQL
then
  echo "ERROR: invalid GM preferred Player experience was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO gm_system_formats (gm_system_experience_id, format)
VALUES ('00000000-0000-0000-0000-000000000670', 'any_format');
SQL
then
  echo "ERROR: noncanonical GM format was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO gm_system_formats (gm_system_experience_id, format)
VALUES ('00000000-0000-0000-0000-000000000670', 'one_shot');
SQL
then
  echo "ERROR: duplicate GM format was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM game_systems
WHERE id = '00000000-0000-0000-0000-000000000570';
SQL
then
  echo "ERROR: referenced GM GameSystem deletion was accepted" >&2
  exit 1
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM gm_profiles
WHERE id = '00000000-0000-0000-0000-000000000170';
SQL

experience_count_after_profile_delete="$(psql_scalar "SELECT COUNT(*) FROM gm_system_experiences WHERE id='00000000-0000-0000-0000-000000000670'")"
test "$experience_count_after_profile_delete" = "0"

format_count_after_profile_delete="$(psql_scalar "SELECT COUNT(*) FROM gm_system_formats WHERE gm_system_experience_id='00000000-0000-0000-0000-000000000670'")"
test "$format_count_after_profile_delete" = "0"

system_count_after_profile_delete="$(psql_scalar "SELECT COUNT(*) FROM game_systems WHERE id='00000000-0000-0000-0000-000000000570'")"
test "$system_count_after_profile_delete" = "1"

echo "GMSystemExperience/GMSystemFormat schema verification passed."
