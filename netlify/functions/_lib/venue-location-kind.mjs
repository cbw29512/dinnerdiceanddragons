export function publicVenueLocation(venue, _options = {}) {
  try {
    if (!venue || typeof venue !== "object") throw new Error("Venue is required.");
    return Object.freeze({
      name: String(venue.name || "Public Venue"),
      location_kind: "public_venue",
      location_label: "Public venue",
      city: String(venue.city || ""),
      state_region: String(venue.state_region || "")
    });
  } catch (error) {
    console.error("[DDD Venue Location] Unable to project opportunity Venue", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}
