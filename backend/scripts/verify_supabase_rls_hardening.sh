#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

rls_tables=(
  alembic_version
  users
  user_roles
  privileged_audit_events
  player_profiles
  gm_profiles
  venues
  venue_managers
  game_systems
  player_system_experiences
  gm_system_experiences
  gm_system_formats
  recurring_availability_rules
  player_availability_windows
  gm_availability_windows
  player_demand_signals
  gm_supply_signals
  venue_table_windows
  table_matches
  table_match_players
  match_explanations
  postal_code_centroids
  game_series
  events
  table_expectations
  registrations
  venue_booking_requests
)

for table in "${rls_tables[@]}"; do
  rls_enabled="$(psql_scalar "SELECT relrowsecurity::text FROM pg_class WHERE oid='public.${table}'::regclass")"
  test "$rls_enabled" = "true"
done

function_search_path="$(psql_scalar "SELECT COALESCE(array_to_string(p.proconfig, ','),'') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='deny_privileged_audit_event_mutation'")"
test "$function_search_path" = "search_path=pg_catalog"

alembic_head="$(psql_scalar "SELECT version_num FROM alembic_version")"
test "$alembic_head" = "0017_table_formation_lifecycle"

echo "Supabase RLS hardening verification passed through table formation persistence."
