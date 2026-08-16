#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='game_systems'")"
test "$table_count" = "1"

slug_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.game_systems'::regclass AND contype='u' AND conname='uq_game_systems_slug'")"
test "$slug_unique_count" = "1"

seed_count="$(psql_scalar "SELECT COUNT(*) FROM game_systems WHERE id IN ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007')")"
test "$seed_count" = "7"

seed_contract="$(psql_scalar "SELECT COUNT(*) FROM game_systems WHERE (id,name,edition,slug) IN (('10000000-0000-0000-0000-000000000001','Dungeons & Dragons','5e (2014)','dnd-5e-2014'),('10000000-0000-0000-0000-000000000002','Dungeons & Dragons','5e (2024)','dnd-5e-2024'),('10000000-0000-0000-0000-000000000003','Pathfinder','2e','pathfinder-2e')) OR (id='10000000-0000-0000-0000-000000000004' AND name='Call of Cthulhu' AND edition IS NULL AND slug='call-of-cthulhu') OR (id='10000000-0000-0000-0000-000000000005' AND name='Cyberpunk RED' AND edition IS NULL AND slug='cyberpunk-red') OR (id='10000000-0000-0000-0000-000000000006' AND name='Shadowrun' AND edition IS NULL AND slug='shadowrun') OR (id='10000000-0000-0000-0000-000000000007' AND name='Other RPG' AND edition IS NULL AND slug='other-rpg')")"
test "$seed_contract" = "7"

active_seed_count="$(psql_scalar "SELECT COUNT(*) FROM game_systems WHERE id::text LIKE '10000000-0000-0000-0000-00000000000%' AND active = true")"
test "$active_seed_count" = "7"

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

echo "GameSystem schema and seed verification passed."
