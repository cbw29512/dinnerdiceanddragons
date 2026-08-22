import { requireRole } from "./auth.mjs";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "./rate-limit.mjs";
import {
  SupabaseRestError,
  eq,
  inList,
  insertRows,
  selectMany,
  selectOne,
  selectOneForUpdate,
  updateRows,
  withTransaction
} from "./supabase-rest.mjs";
import { requireUuid } from "./http.mjs";

const CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/address";

function addressSnapshot(venue) {
  return {
    address_line1: venue.address_line1,
    address_line2: venue.address_line2 || null,
    city: venue.city,
    state_region: venue.state_region,
    postal_code: venue.postal_code
  };
}

function sameAddress(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function assertPendingClaim(venue, manager, missingMessage) {
  if (!venue || !manager) throw new SupabaseRestError(missingMessage, 404);
  if (!venue.active) throw new SupabaseRestError("This Venue is inactive and cannot be verified.", 409);
  if (venue.verified) throw new SupabaseRestError("This Venue is already verified.", 409);
  if (manager.verified_at) throw new SupabaseRestError("This Venue Manager claim is already verified.", 409);
}

function assertActiveManagerAccount(account) {
  if (!account) throw new SupabaseRestError("The Venue Manager account no longer exists.", 404);
  if (account.status !== "active") throw new SupabaseRestError("The Venue Manager account is not active and cannot be verified.", 409);
}

async function censusGeocode(address) {
  const params = new URLSearchParams({
    street: [address.address_line1, address.address_line2].filter(Boolean).join(" "),
    city: address.city,
    state: address.state_region,
    zip: address.postal_code,
    benchmark: "Public_AR_Current",
    format: "json"
  });

  let response;
  try {
    response = await fetch(`${CENSUS_GEOCODER_URL}?${params}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DinnerDiceAndDragons/1.0 (venue verification)"
      }
    });
  } catch {
    throw new SupabaseRestError("Venue geocoding is temporarily unavailable.", 503);
  }
  if (!response.ok) throw new SupabaseRestError("Venue geocoding is temporarily unavailable.", 503);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new SupabaseRestError("Venue geocoding returned malformed data.", 503);
  }

  const matches = payload?.result?.addressMatches;
  if (!Array.isArray(matches) || matches.length === 0) {
    throw new SupabaseRestError("Venue address could not be matched precisely enough for verification.", 422);
  }
  const coordinates = matches[0]?.coordinates;
  const longitude = Number(coordinates?.x);
  const latitude = Number(coordinates?.y);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new SupabaseRestError("Venue geocoding returned invalid coordinates.", 503);
  }
  return { latitude, longitude };
}

export async function listPendingVenueClaims(user) {
  await requireRole(user.id, "admin");
  const managers = await selectMany("venue_managers", {
    verified_at: "is.null",
    select: "id,venue_id,user_id,role",
    order: "id.asc",
    limit: 500
  });
  if (!managers.length) return [];

  const venueIds = [...new Set(managers.map((manager) => manager.venue_id))];
  const userIds = [...new Set(managers.map((manager) => manager.user_id))];
  const [venues, users] = await Promise.all([
    selectMany("venues", {
      id: inList(venueIds),
      active: "is.true",
      verified: "is.false",
      select: "id,name,venue_type,address_line1,address_line2,city,state_region,postal_code,website_url,phone"
    }),
    selectMany("users", {
      id: inList(userIds),
      select: "id,email,display_name,status"
    })
  ]);
  const venueById = new Map(venues.map((venue) => [venue.id, venue]));
  const userById = new Map(users.map((account) => [account.id, account]));

  return managers.flatMap((manager) => {
    const venue = venueById.get(manager.venue_id);
    const account = userById.get(manager.user_id);
    if (!venue || !account) return [];
    return [{
      venue_id: venue.id,
      venue_manager_id: manager.id,
      name: venue.name,
      venue_type: venue.venue_type,
      address_line1: venue.address_line1,
      address_line2: venue.address_line2 || null,
      city: venue.city,
      state_region: venue.state_region,
      postal_code: venue.postal_code,
      website_url: venue.website_url || null,
      phone: venue.phone || null,
      manager_role: manager.role,
      manager_display_name: account.display_name || null,
      manager_email: account.email,
      manager_account_status: account.status
    }];
  }).sort((left, right) =>
    left.name.localeCompare(right.name) ||
    left.city.localeCompare(right.city) ||
    left.venue_manager_id.localeCompare(right.venue_manager_id)
  );
}

export async function verifyVenueClaim(user, venueId, managerId) {
  await requireRole(user.id, "admin");

  const safeVenueId = requireUuid(venueId, "venue_id");
  const safeManagerId = requireUuid(managerId, "venue_manager_id");
  const venue = await selectOne("venues", { id: eq(safeVenueId) });
  const manager = await selectOne("venue_managers", { id: eq(safeManagerId), venue_id: eq(safeVenueId) });
  assertPendingClaim(venue, manager, "The requested Venue Manager claim does not exist for this Venue.");
  const managerAccount = await selectOne("users", { id: eq(manager.user_id) });
  assertActiveManagerAccount(managerAccount);
  await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.PROVIDER_GEOCODING);

  const expectedAddress = addressSnapshot(venue);
  const coordinates = await censusGeocode(expectedAddress);

  return withTransaction(async () => {
    const lockedVenue = await selectOneForUpdate("venues", { id: eq(safeVenueId) });
    const lockedManager = await selectOneForUpdate("venue_managers", { id: eq(safeManagerId), venue_id: eq(safeVenueId) });
    assertPendingClaim(lockedVenue, lockedManager, "The requested Venue Manager claim no longer exists.");
    const lockedManagerAccount = await selectOneForUpdate("users", { id: eq(lockedManager.user_id) });
    assertActiveManagerAccount(lockedManagerAccount);
    if (!sameAddress(expectedAddress, addressSnapshot(lockedVenue))) {
      throw new SupabaseRestError("Venue address changed while verification was in progress.", 409);
    }

    const now = new Date().toISOString();
    const venueRows = await updateRows("venues", { id: eq(safeVenueId), verified: "is.false" }, {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      verified: true
    });
    if (!Array.isArray(venueRows) || venueRows.length !== 1) {
      throw new SupabaseRestError("Venue claim changed while verification was in progress.", 409);
    }

    const managerRows = await updateRows("venue_managers", { id: eq(safeManagerId), verified_at: "is.null" }, {
      verified_at: now
    });
    if (!Array.isArray(managerRows) || managerRows.length !== 1) {
      throw new SupabaseRestError("Venue Manager claim changed while verification was in progress.", 409);
    }

    await insertRows("privileged_audit_events", [{
      id: crypto.randomUUID(),
      actor_user_id: user.id,
      actor_role: "admin",
      action: "venue.verify_initial_claim",
      target_type: "venue_manager",
      target_id: safeManagerId,
      outcome: "success",
      reason_code: "initial_claim_approved"
    }], { returning: false });

    return null;
  });
}
