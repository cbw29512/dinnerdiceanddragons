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
  uq_game_series_recurring_rule_id \
  ck_game_series_expected_sessions \
  uq_events_slug \
  uq_events_table_match_id \
  ck_events_status \
  ck_events_time_order \
  ck_events_player_range \
  uq_table_expectations_event_id \
  uq_registrations_event_player \
  ck_registrations_status \
  uq_venue_booking_requests_table_match_id \
  uq_venue_booking_requests_event_id \
  ck_venue_booking_requests_status \
  ck_venue_booking_requests_time_order; do
  constraint_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conname='${constraint}'")"
  test "$constraint_count" = "1"
done

registration_event_fk="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conname='fk_registrations_event'")"
test "$registration_event_fk" = "c"

expectations_event_fk="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conname='fk_table_expectations_event'")"
test "$expectations_event_fk" = "c"

event_match_fk="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conname='fk_events_table_match'")"
test "$event_match_fk" = "n"

booking_event_fk="$(psql_scalar "SELECT confdeltype FROM pg_constraint WHERE conname='fk_venue_booking_requests_event'")"
test "$booking_event_fk" = "n"

registration_default="$(psql_scalar "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='registrations' AND column_name='status'")"
test "$registration_default" = "'requested'::character varying"

booking_default="$(psql_scalar "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='venue_booking_requests' AND column_name='status'")"
test "$booking_default" = "'requested'::character varying"

event_default="$(psql_scalar "SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='status'")"
test "$event_default" = "'draft'::character varying"

echo "Table formation PostgreSQL schema verification passed."
