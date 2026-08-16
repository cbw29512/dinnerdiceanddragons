#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='game_systems'")"
test "$table_count" = "1"

slug_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.game_systems'::regclass AND contype='u' AND conname='uq_game_systems_slug'")"
test "$slug_unique_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, edition, slug, publisher_name)
VALUES
  (
    '00000000-0000-0000-0000-000000000500',
    'Dungeons & Dragons',
    '5e (2014)',
    'dnd-5e-2014',
    'Wizards of the Coast'
  ),
  (
    '00000000-0000-0000-0000-000000000501',
    'Dungeons & Dragons',
    '5e (2024)',
    'dnd-5e-2024',
    'Wizards of the Coast'
  ),
  (
    '00000000-0000-0000-0000-000000000502',
    'Other RPG',
    NULL,
    'other-rpg',
    NULL
  );
SQL

active_count="$(psql_scalar "SELECT COUNT(*) FROM game_systems WHERE active = true")"
test "$active_count" = "3"

edition_null_count="$(psql_scalar "SELECT COUNT(*) FROM game_systems WHERE slug='other-rpg' AND edition IS NULL")"
test "$edition_null_count" = "1"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000503',
  'Duplicate Slug',
  'dnd-5e-2024'
);
SQL
then
  echo "ERROR: duplicate GameSystem slug was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, slug)
VALUES (
  '00000000-0000-0000-0000-000000000504',
  'Uppercase Slug',
  'DND-UPPERCASE'
);
SQL
then
  echo "ERROR: uppercase GameSystem slug was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO game_systems (id, name, edition, slug)
VALUES (
  '00000000-0000-0000-0000-000000000505',
  'Blank Edition',
  '',
  'blank-edition'
);
SQL
then
  echo "ERROR: blank GameSystem edition was accepted" >&2
  exit 1
fi

echo "GameSystem schema verification passed."
