#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

for table in game_series events table_expectations registrations venue_booking_requests; do
  table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'")"
  test "$table_count" = "1"
  rls_enabled="$(psql_scalar "SELECT relrowsecurity::text FROM pg_class WHERE oid='public.${table}'::regclass")"
  test "$rls_enabled" = "true"
done

for constraint in \
  uq_game_series_table_match_id \
  uq_events_slug \
  uq_events_table_match_id \
  uq_table_expectations_event_id \
  uq_registrations_event_player \
  uq_venue_booking_requests_table_match_id \
  uq_venue_booking_requests_event_id; do
  count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conname='${constraint}'")"
  test "$count" = "1"
done

for constraint in \
  ck_events_time_order \
  ck_events_player_range \
  ck_events_status \
  ck_registrations_status \
  ck_venue_booking_requests_time_order \
  ck_venue_booking_requests_status; do
  count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conname='${constraint}'")"
  test "$count" = "1"
done

registration_event_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.registrations'::regclass AND contype='f' AND confrelid='public.events'::regclass AND confdeltype='c'")"
test "$registration_event_fk" = "1"

expectations_event_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.table_expectations'::regclass AND contype='f' AND confrelid='public.events'::regclass AND confdeltype='c'")"
test "$expectations_event_fk" = "1"

echo "Table formation PostgreSQL schema verification passed."
