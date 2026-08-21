import { managedVenue, requireRole } from "./auth.mjs";
import { postalCentroid } from "./geo.mjs";
import { SupabaseRestError, eq, selectOne, updateRows } from "./supabase-rest.mjs";

const LOCATION_KINDS = new Set(["business", "private_residence"]);

function normalizeLocationKind(value) {
  const kind = String(value || "").trim();
  if (!LOCATION_KINDS.has(kind)) {
    throw new SupabaseRestError("Choose whether this location is a business/public place or a private residence.", 422);
  }
  return kind;
}

async function residenceEligibility(venue, userId, now) {
  try {
    const point = await postalCentroid(venue.postal_code);
    await updateRows("venues", { id: eq(venue.id) }, {
      location_kind: "private_residence",
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      verified: true,
      updated_at: now
    }, { returning: false });
    await updateRows("venue_managers", { venue_id: eq(venue.id), user_id: eq(userId) }, {
      verified_at: now
    }, { returning: false });
  } catch (error) {
    console.error("[DDD Venue Location] Unable to enable residence matching", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}

export async function setVenueLocationKind(user, venueId, rawKind) {
  try {
    await requireRole(user.id, "venue_manager");
    await managedVenue(user.id, venueId, { verified: false });
    const venue = await selectOne("venues", { id: eq(venueId) });
    if (!venue) throw new SupabaseRestError("Venue was not found.", 404);
    const locationKind = normalizeLocationKind(rawKind);
    const now = new Date().toISOString();
    if (locationKind === "private_residence") {
      await residenceEligibility(venue, user.id, now);
    } else {
      await updateRows("venues", { id: eq(venue.id) }, {
        location_kind: "business",
        updated_at: now
      }, { returning: false });
    }
    return {
      venue_id: venue.id,
      location_kind: locationKind,
      matching_eligible: locationKind === "private_residence" ? true : Boolean(venue.verified)
    };
  } catch (error) {
    console.error("[DDD Venue Location] Unable to save location kind", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}

export function publicVenueLocation(venue, { formed = false } = {}) {
  try {
    const isResidence = venue?.location_kind === "private_residence";
    return {
      location_kind: isResidence ? "private_residence" : "business",
      location_label: isResidence ? "Private residence" : (venue?.name || "Public Venue"),
      name: isResidence && !formed ? "Private residence" : (venue?.name || "Venue"),
      city: venue?.city || "",
      state_region: venue?.state_region || "",
      address_line1: formed ? (venue?.address_line1 || "") : null,
      address_line2: formed ? (venue?.address_line2 || null) : null,
      postal_code: formed ? (venue?.postal_code || null) : null
    };
  } catch (error) {
    console.error("[DDD Venue Location] Unable to project Venue location", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}
