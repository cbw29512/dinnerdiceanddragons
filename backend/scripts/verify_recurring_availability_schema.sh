#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='recurring_availability_rules'")"
test "$table_count" = "1"

pattern_constraint="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.recurring_availability_rules'::regclass AND conname='ck_recurring_availability_rules_pattern_fields'")"
test "$pattern_constraint" = "1"

owner_type_index="$(psql_scalar "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND tablename='recurring_availability_rules' AND indexname='ix_recurring_availability_rules_owner_type'")"
test "$owner_type_index" = "1"

owner_id_index="$(psql_scalar "SELECT COUNT(*) FROM pg_indexes WHERE schemaname='public' AND tablename='recurring_availability_rules' AND indexname='ix_recurring_availability_rules_owner_id'")"
test "$owner_id_index" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO recurring_availability_rules (
  id, owner_type, owner_id, day_of_week, start_time, end_time,
  pattern_type, week_interval, timezone, starts_on
)
VALUES (
  '00000000-0000-0000-0000-000000000810',
  'player',
  '00000000-0000-0000-0000-000000000910',
  'saturday',
  '18:00',
  '22:00',
  'weekly_interval',
  1,
  'America/New_York',
  '2026-08-15'
);

INSERT INTO recurring_availability_rules (
  id, owner_type, owner_id, day_of_week, start_time, end_time,
  pattern_type, monthly_ordinal, month_interval, anchor_date, timezone
)
VALUES (
  '00000000-0000-0000-0000-000000000811',
  'venue',
  '00000000-0000-0000-0000-000000000911',
  'wednesday',
  '17:30',
  '21:30',
  'monthly_ordinal_weekday',
  'last',
  2,
  '2026-08-01',
  'America/New_York'
);
SQL

rule_count="$(psql_scalar "SELECT COUNT(*) FROM recurring_availability_rules WHERE id IN ('00000000-0000-0000-0000-000000000810','00000000-0000-0000-0000-000000000811')")"
test "$rule_count" = "2"

assert_rejected() {
  local description="$1"
  local sql="$2"
  if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd -c "$sql"; then
    echo "ERROR: ${description} was accepted" >&2
    exit 1
  fi
}

assert_rejected \
  "weekly rule without week_interval" \
  "INSERT INTO recurring_availability_rules (id,owner_type,owner_id,day_of_week,start_time,end_time,pattern_type,timezone) VALUES ('00000000-0000-0000-0000-000000000812','gm','00000000-0000-0000-0000-000000000912','friday','18:00','22:00','weekly_interval','America/New_York')"

assert_rejected \
  "alternating weekly rule without anchor_date" \
  "INSERT INTO recurring_availability_rules (id,owner_type,owner_id,day_of_week,start_time,end_time,pattern_type,week_interval,timezone) VALUES ('00000000-0000-0000-0000-000000000813','gm','00000000-0000-0000-0000-000000000913','friday','18:00','22:00','weekly_interval',2,'America/New_York')"

assert_rejected \
  "monthly rule without ordinal" \
  "INSERT INTO recurring_availability_rules (id,owner_type,owner_id,day_of_week,start_time,end_time,pattern_type,month_interval,timezone) VALUES ('00000000-0000-0000-0000-000000000814','venue','00000000-0000-0000-0000-000000000914','monday','18:00','21:00','monthly_ordinal_weekday',1,'America/New_York')"

assert_rejected \
  "blank timezone" \
  "INSERT INTO recurring_availability_rules (id,owner_type,owner_id,day_of_week,start_time,end_time,pattern_type,week_interval,timezone) VALUES ('00000000-0000-0000-0000-000000000815','player','00000000-0000-0000-0000-000000000915','sunday','18:00','21:00','weekly_interval',1,'   ')"

assert_rejected \
  "end time before start time" \
  "INSERT INTO recurring_availability_rules (id,owner_type,owner_id,day_of_week,start_time,end_time,pattern_type,week_interval,timezone) VALUES ('00000000-0000-0000-0000-000000000816','player','00000000-0000-0000-0000-000000000916','sunday','22:00','18:00','weekly_interval',1,'America/New_York')"

echo "RecurringAvailabilityRule schema verification passed."
