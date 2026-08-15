#!/usr/bin/env bash
set -euo pipefail

psql_scalar() {
  docker compose exec -T db psql -U ddd -d ddd -tAc "$1" | tr -d '[:space:]'
}

venues_table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='venues'")"
test "$venues_table_count" = "1"

managers_table_count="$(psql_scalar "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='venue_managers'")"
test "$managers_table_count" = "1"

slug_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.venues'::regclass AND contype='u' AND conname='uq_venues_slug'")"
test "$slug_unique_count" = "1"

manager_unique_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.venue_managers'::regclass AND contype='u' AND conname='uq_venue_managers_venue_id_user_id'")"
test "$manager_unique_count" = "1"

manager_user_fk_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.venue_managers'::regclass AND contype='f' AND conname='fk_venue_managers_user_id_users' AND confdeltype='c'")"
test "$manager_user_fk_count" = "1"

manager_venue_fk_count="$(psql_scalar "SELECT COUNT(*) FROM pg_constraint WHERE conrelid='public.venue_managers'::regclass AND contype='f' AND conname='fk_venue_managers_venue_id_venues' AND confdeltype='c'")"
test "$manager_venue_fk_count" = "1"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000040',
  'supabase-subject-venue-manager',
  'venue-manager@example.test',
  'active'
);

INSERT INTO user_roles (user_id, role)
VALUES
  ('00000000-0000-0000-0000-000000000040', 'player'),
  ('00000000-0000-0000-0000-000000000040', 'gm'),
  ('00000000-0000-0000-0000-000000000040', 'venue_manager');

INSERT INTO player_profiles (id, user_id, postal_code, travel_radius_miles)
VALUES (
  '00000000-0000-0000-0000-000000000140',
  '00000000-0000-0000-0000-000000000040',
  '29501',
  25
);

INSERT INTO gm_profiles (id, user_id, postal_code, travel_radius_miles, gm_style)
VALUES (
  '00000000-0000-0000-0000-000000000141',
  '00000000-0000-0000-0000-000000000040',
  '29501',
  50,
  'Narrative and tactical.'
);

INSERT INTO venues (
  id,
  name,
  slug,
  venue_type,
  address_line1,
  city,
  state_region,
  postal_code,
  latitude,
  longitude,
  accessibility_notes,
  parking_notes
)
VALUES (
  '00000000-0000-0000-0000-000000000240',
  'Florence Game Cafe',
  'florence-game-cafe',
  'cafe',
  '100 Game Night Way',
  'Florence',
  'SC',
  '29501',
  34.1954,
  -79.7626,
  'Accessible entrance and movable chairs.',
  'Free parking behind the building.'
);

INSERT INTO venue_managers (id, venue_id, user_id)
VALUES (
  '00000000-0000-0000-0000-000000000340',
  '00000000-0000-0000-0000-000000000240',
  '00000000-0000-0000-0000-000000000040'
);
SQL

venue_defaults="$(psql_scalar "SELECT venue_type || ':' || verified::text || ':' || active::text || ':' || amenities::text FROM venues WHERE id='00000000-0000-0000-0000-000000000240'")"
test "$venue_defaults" = "cafe:false:true:[]"

manager_defaults="$(psql_scalar "SELECT role || ':' || (verified_at IS NULL)::text FROM venue_managers WHERE id='00000000-0000-0000-0000-000000000340'")"
test "$manager_defaults" = "manager:true"

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
UPDATE venue_managers
SET verified_at = CURRENT_TIMESTAMP
WHERE id = '00000000-0000-0000-0000-000000000340';
SQL

verified_manager_count="$(psql_scalar "SELECT COUNT(*) FROM venue_managers WHERE id='00000000-0000-0000-0000-000000000340' AND verified_at IS NOT NULL")"
test "$verified_manager_count" = "1"

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO venues (
  id, name, slug, venue_type, address_line1, city, state_region, postal_code
)
VALUES (
  '00000000-0000-0000-0000-000000000241',
  'Duplicate Slug Venue',
  'florence-game-cafe',
  'restaurant',
  '101 Game Night Way',
  'Florence',
  'SC',
  '29501'
);
SQL
then
  echo "ERROR: duplicate Venue slug was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO venues (
  id, name, slug, venue_type, address_line1, city, state_region, postal_code
)
VALUES (
  '00000000-0000-0000-0000-000000000242',
  'Uppercase Slug Venue',
  'Uppercase-Slug',
  'cafe',
  '102 Game Night Way',
  'Florence',
  'SC',
  '29501'
);
SQL
then
  echo "ERROR: uppercase Venue slug was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO venues (
  id, name, slug, venue_type, address_line1, city, state_region, postal_code
)
VALUES (
  '00000000-0000-0000-0000-000000000243',
  'Private House',
  'private-house',
  'private_house',
  '103 Game Night Way',
  'Florence',
  'SC',
  '29501'
);
SQL
then
  echo "ERROR: invalid Venue type was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO venues (
  id, name, slug, venue_type, address_line1, city, state_region, postal_code
)
VALUES (
  '00000000-0000-0000-0000-000000000244',
  'Lowercase State Venue',
  'lowercase-state-venue',
  'public_venue',
  '104 Game Night Way',
  'Florence',
  'sc',
  '29501'
);
SQL
then
  echo "ERROR: lowercase Venue state was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO venues (
  id, name, slug, venue_type, address_line1, city, state_region, postal_code, latitude
)
VALUES (
  '00000000-0000-0000-0000-000000000245',
  'Bad Latitude Venue',
  'bad-latitude-venue',
  'public_venue',
  '105 Game Night Way',
  'Florence',
  'SC',
  '29501',
  91
);
SQL
then
  echo "ERROR: invalid Venue latitude was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO venue_managers (id, venue_id, user_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000341',
  '00000000-0000-0000-0000-000000000240',
  '00000000-0000-0000-0000-000000000040',
  'owner'
);
SQL
then
  echo "ERROR: duplicate User/Venue manager relationship was accepted" >&2
  exit 1
fi

if docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000041',
  'supabase-subject-venue-invalid-role',
  'venue-invalid-role@example.test',
  'active'
);
INSERT INTO venue_managers (id, venue_id, user_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000342',
  '00000000-0000-0000-0000-000000000240',
  '00000000-0000-0000-0000-000000000041',
  'super_owner'
);
SQL
then
  echo "ERROR: invalid Venue Manager role was accepted" >&2
  exit 1
fi

# Removing a manager account removes the relationship and private role profiles,
# but the public Venue remains available for another verified manager to claim.
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
DELETE FROM users
WHERE id = '00000000-0000-0000-0000-000000000040';
SQL

manager_count_after_user_delete="$(psql_scalar "SELECT COUNT(*) FROM venue_managers WHERE user_id='00000000-0000-0000-0000-000000000040'")"
test "$manager_count_after_user_delete" = "0"

venue_count_after_user_delete="$(psql_scalar "SELECT COUNT(*) FROM venues WHERE id='00000000-0000-0000-0000-000000000240'")"
test "$venue_count_after_user_delete" = "1"

player_count_after_user_delete="$(psql_scalar "SELECT COUNT(*) FROM player_profiles WHERE user_id='00000000-0000-0000-0000-000000000040'")"
test "$player_count_after_user_delete" = "0"

gm_count_after_user_delete="$(psql_scalar "SELECT COUNT(*) FROM gm_profiles WHERE user_id='00000000-0000-0000-0000-000000000040'")"
test "$gm_count_after_user_delete" = "0"

# Deleting the Venue itself cascades any manager relationships for that Venue.
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ddd -d ddd <<'SQL'
INSERT INTO users (id, auth_provider_user_id, email, status)
VALUES (
  '00000000-0000-0000-0000-000000000042',
  'supabase-subject-venue-second-manager',
  'venue-second-manager@example.test',
  'active'
);
INSERT INTO venue_managers (id, venue_id, user_id, role, verified_at)
VALUES (
  '00000000-0000-0000-0000-000000000343',
  '00000000-0000-0000-0000-000000000240',
  '00000000-0000-0000-0000-000000000042',
  'manager',
  CURRENT_TIMESTAMP
);
DELETE FROM venues
WHERE id = '00000000-0000-0000-0000-000000000240';
SQL

manager_count_after_venue_delete="$(psql_scalar "SELECT COUNT(*) FROM venue_managers WHERE venue_id='00000000-0000-0000-0000-000000000240'")"
test "$manager_count_after_venue_delete" = "0"

echo "Venue and VenueManager schema verification passed."
