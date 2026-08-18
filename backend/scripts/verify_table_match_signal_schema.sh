#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

for table in \
  player_demand_signals \
  gm_supply_signals \
  venue_table_windows \
  table_matches \
  table_match_players \
  match_explanations; do
  table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='${table}'")"
  test "$table_count" = "1"
done

player_profile_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_demand_signals'::regclass AND conname='fk_player_demand_profile' AND confdeltype='c'")"
test "$player_profile_fk" = "1"

player_system_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.player_demand_signals'::regclass AND conname='fk_player_demand_system' AND confdeltype='r'")"
test "$player_system_fk" = "1"

gm_profile_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_supply_signals'::regclass AND conname='fk_gm_supply_profile' AND confdeltype='c'")"
test "$gm_profile_fk" = "1"

gm_system_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.gm_supply_signals'::regclass AND conname='fk_gm_supply_system' AND confdeltype='r'")"
test "$gm_system_fk" = "1"

venue_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.venue_table_windows'::regclass AND conname='fk_venue_window_venue' AND confdeltype='c'")"
test "$venue_fk" = "1"

venue_rule_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.venue_table_windows'::regclass AND conname='fk_venue_window_rule' AND confdeltype='c'")"
test "$venue_rule_fk" = "1"

venue_rule_unique="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.venue_table_windows'::regclass AND conname='uq_venue_table_windows_recurring_rule_id'")"
test "$venue_rule_unique" = "1"

match_gm_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.table_matches'::regclass AND conname='fk_table_matches_gm_supply_signal' AND confdeltype='c'")"
test "$match_gm_fk" = "1"

match_venue_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.table_matches'::regclass AND conname='fk_table_matches_venue_table_window' AND confdeltype='c'")"
test "$match_venue_fk" = "1"

match_system_fk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.table_matches'::regclass AND conname='fk_table_matches_game_system' AND confdeltype='r'")"
test "$match_system_fk" = "1"

match_occurrence_unique="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.table_matches'::regclass AND conname='uq_table_matches_gm_venue_occurrence'")"
test "$match_occurrence_unique" = "1"

match_player_pk="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.table_match_players'::regclass AND conname='pk_table_match_players'")"
test "$match_player_pk" = "1"

match_explanation_unique="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.match_explanations'::regclass AND conname='uq_match_explanations_match_criterion'")"
test "$match_explanation_unique" = "1"

for table in table_matches table_match_players match_explanations; do
  rls_enabled="$(psql_scalar "SELECT relrowsecurity::text FROM pg_class WHERE oid='public.${table}'::regclass")"
  test "$rls_enabled" = "true"
done

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000090',
  'supabase-subject-table-match-signal',
  'table-match-signal@example.test',
  'active'
);

INSERT INTO player_profiles (id, user_id, postal_code, travel_radius_miles)
VALUES (
  '00000000-0000-0000-0000-000000000190',
  '00000000-0000-0000-0000-000000000090',
  '29501',
  25
);

INSERT INTO gm_profiles (id, user_id, postal_code, travel_radius_miles, gm_style)
VALUES (
  '00000000-0000-0000-0000-000000000290',
  '00000000-0000-0000-0000-000000000090',
  '29501',
  25,
  'Collaborative rules-forward table.'
);

INSERT INTO venues (
  id, name, slug, venue_type, address_line1, city, state_region, postal_code
)
VALUES (
  '00000000-0000-0000-0000-000000000390',
  'Table Match Test Cafe',
  'table-match-test-cafe',
  'cafe',
  '123 Table Way',
  'Florence',
  'SC',
  '29501'
);

INSERT INTO recurring_availability_rules (
  id, day_of_week, start_time, end_time, pattern_type, week_interval, timezone
)
VALUES (
  '00000000-0000-0000-0000-000000000890',
  'friday',
  '18:00',
  '22:00',
  'weekly_interval',
  1,
  'America/New_York'
);

INSERT INTO player_demand_signals (
  id, player_profile_id, game_system_id, preferred_format, preferred_cadence,
  minimum_age_preference, table_style_preferences, environment_preferences
)
VALUES (
  '00000000-0000-0000-0000-000000000590',
  '00000000-0000-0000-0000-000000000190',
  '10000000-0000-0000-0000-000000000003',
  'one_shot',
  'monthly',
  18,
  '["roleplay-forward"]'::json,
  '["quieter venue"]'::json
);

INSERT INTO gm_supply_signals (
  id, gm_profile_id, game_system_id, preferred_format, preferred_cadence,
  minimum_players, maximum_players, table_style
)
VALUES (
  '00000000-0000-0000-0000-000000000690',
  '00000000-0000-0000-0000-000000000290',
  '10000000-0000-0000-0000-000000000003',
  'one_shot',
  'monthly',
  3,
  5,
  'Collaborative'
);

INSERT INTO venue_table_windows (
  id, venue_id, recurring_rule_id, table_count, max_people_per_table,
  purchase_policy, approval_required
)
VALUES (
  '00000000-0000-0000-0000-000000000790',
  '00000000-0000-0000-0000-000000000390',
  '00000000-0000-0000-0000-000000000890',
  2,
  6,
  'One purchase per guest.',
  true
);

INSERT INTO table_matches (
  id, gm_supply_signal_id, venue_table_window_id, game_system_id,
  proposed_start, proposed_end, timezone, minimum_players, maximum_players,
  compatible_player_count, distance_summary, fit_score
)
VALUES (
  '00000000-0000-0000-0000-000000000990',
  '00000000-0000-0000-0000-000000000690',
  '00000000-0000-0000-0000-000000000790',
  '10000000-0000-0000-0000-000000000003',
  '2026-08-22T18:00:00-04:00',
  '2026-08-22T22:00:00-04:00',
  'America/New_York',
  3,
  5,
  1,
  '{"gm_miles":4.2,"furthest_player_miles":8.7}'::json,
  88.50
);

INSERT INTO table_match_players (
  table_match_id, player_demand_signal_id, fit_flags, distance_miles,
  availability_overlap
)
VALUES (
  '00000000-0000-0000-0000-000000000990',
  '00000000-0000-0000-0000-000000000590',
  '["system","schedule","distance"]'::json,
  8.70,
  '{"start":"2026-08-22T18:00:00-04:00","end":"2026-08-22T22:00:00-04:00"}'::json
);

INSERT INTO match_explanations (
  id, table_match_id, criterion, result, summary, weight
)
VALUES (
  '00000000-0000-0000-0000-000000001090',
  '00000000-0000-0000-0000-000000000990',
  'venue_capacity',
  'pass',
  'Venue seats the GM plus the maximum five Players.',
  1.0000
);
SQL

defaults="$(psql_scalar "SELECT (SELECT status FROM player_demand_signals WHERE id='00000000-0000-0000-0000-000000000590') || ':' || (SELECT status FROM gm_supply_signals WHERE id='00000000-0000-0000-0000-000000000690') || ':' || (SELECT active::text FROM venue_table_windows WHERE id='00000000-0000-0000-0000-000000000790') || ':' || (SELECT status FROM table_matches WHERE id='00000000-0000-0000-0000-000000000990') || ':' || (SELECT status FROM table_match_players WHERE table_match_id='00000000-0000-0000-0000-000000000990')")"
test "$defaults" = "active:active:true:potential:eligible"

match_facts="$(psql_scalar "SELECT compatible_player_count::text || ':' || fit_score::text || ':' || timezone FROM table_matches WHERE id='00000000-0000-0000-0000-000000000990'")"
test "$match_facts" = "1:88.50:America/New_York"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO gm_supply_signals (id,gm_profile_id,game_system_id,preferred_format,minimum_players,maximum_players) VALUES ('00000000-0000-0000-0000-000000000691','00000000-0000-0000-0000-000000000290','10000000-0000-0000-0000-000000000003','one_shot',5,3)"; then
  echo "ERROR: impossible GM player range was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO venue_table_windows (id,venue_id,recurring_rule_id,table_count,max_people_per_table,approval_required) VALUES ('00000000-0000-0000-0000-000000000791','00000000-0000-0000-0000-000000000390','00000000-0000-0000-0000-000000000890',1,4,false)"; then
  echo "ERROR: duplicate VenueTableWindow recurrence ownership was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO table_matches (id,gm_supply_signal_id,venue_table_window_id,game_system_id,proposed_start,proposed_end,timezone,minimum_players,maximum_players) VALUES ('00000000-0000-0000-0000-000000000991','00000000-0000-0000-0000-000000000690','00000000-0000-0000-0000-000000000790','10000000-0000-0000-0000-000000000003','2026-08-22T18:00:00-04:00','2026-08-22T22:00:00-04:00','America/New_York',3,5)"; then
  echo "ERROR: duplicate GM/Venue occurrence was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO table_match_players (table_match_id,player_demand_signal_id,distance_miles) VALUES ('00000000-0000-0000-0000-000000000990','00000000-0000-0000-0000-000000000590',-0.01)"; then
  echo "ERROR: negative Table Match Player distance was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "INSERT INTO match_explanations (id,table_match_id,criterion,result,summary) VALUES ('00000000-0000-0000-0000-000000001091','00000000-0000-0000-0000-000000000990','venue_capacity','pass','Duplicate capacity explanation.')"; then
  echo "ERROR: duplicate MatchExplanation criterion was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "DELETE FROM game_systems WHERE id='10000000-0000-0000-0000-000000000003'"; then
  echo "ERROR: referenced GameSystem deletion was accepted" >&2
  exit 1
fi

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM table_matches
WHERE id = '00000000-0000-0000-0000-000000000990';
SQL

match_player_count="$(psql_scalar "SELECT COUNT(*) FROM table_match_players WHERE table_match_id='00000000-0000-0000-0000-000000000990'")"
test "$match_player_count" = "0"

match_explanation_count="$(psql_scalar "SELECT COUNT(*) FROM match_explanations WHERE table_match_id='00000000-0000-0000-0000-000000000990'")"
test "$match_explanation_count" = "0"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM player_profiles
WHERE id = '00000000-0000-0000-0000-000000000190';
SQL

player_signal_count="$(psql_scalar "SELECT COUNT(*) FROM player_demand_signals WHERE id='00000000-0000-0000-0000-000000000590'")"
test "$player_signal_count" = "0"

echo "Table Match persistence schema verification passed."
