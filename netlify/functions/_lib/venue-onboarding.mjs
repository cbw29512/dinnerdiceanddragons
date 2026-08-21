import { ensureRole } from "./auth.mjs";
import {
  SupabaseRestError,
  eq,
  insertRows,
  selectMany,
  withTransaction
} from "./supabase-rest.mjs";
import { asString } from "./http.mjs";
import {
  enumValue,
  optionalText,
  postalCode,
  uniqueStrings
} from "./onboarding-common.mjs";

const VENUE_TYPES = new Set([
  "public_venue", "restaurant", "cafe", "brewery",
  "library", "game_store", "community_center", "other"
]);
const VENUE_MANAGER_ROLES = new Set(["manager", "owner", "staff"]);

function slugBase(name, city, state) {
  return `${name}-${city}-${state}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "venue";
}

export async function createVenueOnboarding(user, payload) {
  if (!payload || typeof payload !== "object") {
    throw new SupabaseRestError("Venue onboarding payload is invalid.", 422);
  }
  const name = asString(payload.name, "name", { min: 1, max: 160 });
  const address = asString(payload.address_line1, "address_line1", { min: 1, max: 200 });
  const city = asString(payload.city, "city", { min: 1, max: 100 });
  const state = asString(payload.state_region, "state_region", {
    min: 2,
    max: 2,
    pattern: /^[A-Za-z]{2}$/
  }).toUpperCase();
  const zip = postalCode(payload.postal_code);
  const managerRole = enumValue(payload.manager_role ?? "manager", "manager_role", VENUE_MANAGER_ROLES);
  const venueType = enumValue(payload.venue_type ?? "public_venue", "venue_type", VENUE_TYPES);

  const nearby = await selectMany("venues", { postal_code: eq(zip) });
  const duplicate = nearby.find((venue) =>
    String(venue.name || "").toLowerCase() === name.toLowerCase() &&
    String(venue.address_line1 || "").toLowerCase() === address.toLowerCase() &&
    String(venue.city || "").toLowerCase() === city.toLowerCase() &&
    venue.state_region === state
  );
  if (duplicate) {
    throw new SupabaseRestError(
      "That venue already appears to exist. Use the existing-venue claim flow.",
      409
    );
  }

  return withTransaction(async () => {
    await ensureRole(user.id, "venue_manager");
    const venueId = crypto.randomUUID();
    const managerId = crypto.randomUUID();
    const venue = {
      id: venueId,
      name,
      slug: `${slugBase(name, city, state)}-${venueId.replaceAll("-", "").slice(0, 8)}`.slice(0, 180),
      venue_type: venueType,
      address_line1: address,
      address_line2: optionalText(payload.address_line2, "address_line2", 200),
      city,
      state_region: state,
      postal_code: zip,
      latitude: null,
      longitude: null,
      website_url: optionalText(payload.website_url, "website_url", 500),
      phone: optionalText(payload.phone, "phone", 40),
      verified: false,
      amenities: uniqueStrings(payload.amenities ?? [], "amenities", { maxItems: 30 }),
      host_support_offerings: uniqueStrings(payload.host_support_offerings ?? [], "host_support_offerings", { maxItems: 30 }),
      host_support_notes: optionalText(payload.host_support_notes, "host_support_notes"),
      accessibility_notes: optionalText(payload.accessibility_notes, "accessibility_notes"),
      parking_notes: optionalText(payload.parking_notes, "parking_notes"),
      noise_notes: optionalText(payload.noise_notes, "noise_notes"),
      lighting_notes: optionalText(payload.lighting_notes, "lighting_notes"),
      active: true
    };
    await insertRows("venues", [venue], { returning: false });
    await insertRows("venue_managers", [{
      id: managerId,
      venue_id: venueId,
      user_id: user.id,
      role: managerRole,
      verified_at: null
    }], { returning: false });

    return {
      venue_id: venueId,
      venue_manager_id: managerId,
      name,
      slug: venue.slug,
      role: managerRole,
      venue_verified: false,
      manager_verified: false
    };
  });
}
