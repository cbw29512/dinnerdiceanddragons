#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

alembic_head="$(psql_scalar "SELECT version_num FROM alembic_version")"
test "$alembic_head" = "0018_game_hub_messages"

rls_enabled="$(psql_scalar "SELECT relrowsecurity::text FROM pg_class WHERE oid='public.messages'::regclass")"
test "$rls_enabled" = "true"

for constraint in pk_messages ck_messages_channel_type ck_messages_moderation_status ck_messages_body_length ck_messages_category ck_messages_player_venue_fields ck_messages_gm_venue_fields ck_messages_player_gm_fields; do
  found="$(psql_scalar "SELECT count(*) FROM pg_constraint WHERE conrelid='public.messages'::regclass AND conname='${constraint}'")"
  test "$found" = "1"
done

for index in ix_messages_event_id ix_messages_sender_user_id ix_messages_channel_type ix_messages_recipient_user_id ix_messages_venue_id ix_messages_created_at ix_messages_moderation_status ix_messages_event_channel_created; do
  found="$(psql_scalar "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND tablename='messages' AND indexname='${index}'")"
  test "$found" = "1"
done

event_fk="$(psql_scalar "SELECT count(*) FROM pg_constraint WHERE conrelid='public.messages'::regclass AND contype='f' AND confrelid='public.events'::regclass")"
user_fks="$(psql_scalar "SELECT count(*) FROM pg_constraint WHERE conrelid='public.messages'::regclass AND contype='f' AND confrelid='public.users'::regclass")"
venue_fk="$(psql_scalar "SELECT count(*) FROM pg_constraint WHERE conrelid='public.messages'::regclass AND contype='f' AND confrelid='public.venues'::regclass")"
test "$event_fk" = "1"
test "$user_fks" = "2"
test "$venue_fk" = "1"

echo "Live Game Hub message persistence verification passed."
