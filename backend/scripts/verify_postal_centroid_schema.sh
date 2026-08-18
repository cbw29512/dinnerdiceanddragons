#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='postal_code_centroids'")"
test "$table_count" = "1"

unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.postal_code_centroids'::regclass AND conname='uq_postal_code_centroids_country_postal'")"
test "$unique_count" = "1"

rls_enabled="$(psql_scalar "SELECT relrowsecurity::text FROM pg_class WHERE oid='public.postal_code_centroids'::regclass")"
test "$rls_enabled" = "true"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO postal_code_centroids (
  id, country_code, postal_code, latitude, longitude, provider, accuracy, accuracy_type
)
VALUES (
  '00000000-0000-0000-0000-000000001190',
  'US',
  '29501',
  34.1954,
  -79.7626,
  'contract-test',
  1.0,
  'place'
);
SQL

stored="$(psql_scalar "SELECT postal_code || ':' || accuracy_type FROM postal_code_centroids WHERE id='00000000-0000-0000-0000-000000001190'")"
test "$stored" = "29501:place"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO postal_code_centroids (id,country_code,postal_code,latitude,longitude,provider,accuracy,accuracy_type) VALUES ('00000000-0000-0000-0000-000000001191','US','29501',34.1,-79.7,'duplicate-test',1.0,'place')"; then
  echo "ERROR: duplicate postal centroid was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO postal_code_centroids (id,country_code,postal_code,latitude,longitude,provider,accuracy,accuracy_type) VALUES ('00000000-0000-0000-0000-000000001192','US','29502',34.1,-79.7,'accuracy-test',1.5,'place')"; then
  echo "ERROR: invalid postal centroid accuracy was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO postal_code_centroids (id,country_code,postal_code,latitude,longitude,provider,accuracy,accuracy_type) VALUES ('00000000-0000-0000-0000-000000001193','US','29503',91,-79.7,'latitude-test',1.0,'place')"; then
  echo "ERROR: invalid postal centroid latitude was accepted" >&2
  exit 1
fi

echo "Postal centroid schema verification passed."
