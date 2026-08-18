#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

alembic_head="$(psql_scalar "SELECT version_num FROM alembic_version")"
test "$alembic_head" = "0019_distributed_api_rate_limits"

rls_enabled="$(psql_scalar "SELECT relrowsecurity::text FROM pg_class WHERE oid='public.api_rate_limit_buckets'::regclass")"
test "$rls_enabled" = "true"

for constraint in pk_api_rate_limit_buckets ck_api_rate_limit_buckets_scope_length ck_api_rate_limit_buckets_tokens_nonnegative; do
  found="$(psql_scalar "SELECT count(*) FROM pg_constraint WHERE conrelid='public.api_rate_limit_buckets'::regclass AND conname='${constraint}'")"
  test "$found" = "1"
done

user_fk="$(psql_scalar "SELECT count(*) FROM pg_constraint WHERE conrelid='public.api_rate_limit_buckets'::regclass AND contype='f' AND confrelid='public.users'::regclass")"
test "$user_fk" = "1"

updated_index="$(psql_scalar "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='api_rate_limit_buckets' AND indexname='ix_api_rate_limit_buckets_updated_at'")"
test "$updated_index" = "1"

pk_columns="$(psql_scalar "SELECT string_agg(a.attname, ',' ORDER BY u.ordinality) FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum, ordinality) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=u.attnum WHERE c.conrelid='public.api_rate_limit_buckets'::regclass AND c.contype='p'")"
test "$pk_columns" = "user_id,scope"

echo "Distributed API rate-limit schema verification passed."
