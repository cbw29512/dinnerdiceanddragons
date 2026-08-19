import { requireRole } from "./auth.mjs";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "./rate-limit.mjs";
import {
  SupabaseRestError,
  eq,
  insertRows,
  selectOne,
  updateRows
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

export async function verifyVenueClaim(user, venueId, managerId) {
  await requireRole(user.id, "admin");
  await enforceRateLimit(user.id, RATE_LIMIT_SCOPES.PROVIDER_GEOCODING);

  const safeVenueId = requireUuid(venueId, "venue_id");
  const safeManagerId = requireUuid(managerId, "venue_manager_id");
  let venue = await selectOne("venues", { id: eq(safeVenueId) });
  let manager = await selectOne("venue_managers", { id: eq(safeManagerId), venue_id: eq(safeVenueId) });
  if (!venue || !manager) throw new SupabaseRestError("The requested Venue Manager claim does not exist for this Venue.", 404);
  if (!venue.active) throw new SupabaseRestError("This Venue is inactive and cannot be verified.", 409);
  if (venue.verified) throw new SupabaseRestError("This Venue is already verified.", 409);
  if (manager.verified_at) throw new SupabaseRestError("This Venue Manager claim is already verified.", 409);

  const expectedAddress = addressSnapshot(venue);
  const coordinates = await censusGeocode(expectedAddress);

  // Re-read after the external request so an address edit cannot be verified using stale coordinates.
  venue = await selectOne("venues", { id: eq(safeVenueId) });
  manager = await selectOne("venue_managers", { id: eq(safeManagerId), venue_id: eq(safeVenueId) });
  if (!venue || !manager) throw new SupabaseRestError("The requested Venue Manager claim no longer exists.", 404);
  if (!venue.active || venue.verified || manager.verified_at) throw new SupabaseRestError("Venue claim changed while verification was in progress.", 409);
  if (!sameAddress(expectedAddress, addressSnapshot(venue))) {
    throw new SupabaseRestError("Venue address changed while verification was in progress.", 409);
  }

  const now = new Date().toISOString();
  const venueRows = await updateRows("venues", { id: eq(safeVenueId), verified: "is.false" }, {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    verified: true,
    updated_at: now
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
}
