import { SupabaseRestError, eq, insertRows, selectOne } from "./supabase-rest.mjs";

const EARTH_RADIUS_MILES = 3958.7613;

function radians(value) {
  return value * Math.PI / 180;
}

export function haversineMiles(a, b) {
  const lat1 = radians(Number(a.latitude));
  const lat2 = radians(Number(b.latitude));
  const dLat = lat2 - lat1;
  const dLng = radians(Number(b.longitude) - Number(a.longitude));
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function postalCentroid(postalCode) {
  const zip = String(postalCode || "").trim();
  if (!/^\d{5}$/.test(zip)) throw new SupabaseRestError("Postal code is invalid for matching.", 422);
  const cached = await selectOne("postal_code_centroids", {
    country_code: eq("US"),
    postal_code: eq(zip)
  });
  if (cached) return { latitude: Number(cached.latitude), longitude: Number(cached.longitude) };

  let response;
  try {
    response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, {
      headers: { Accept: "application/json" }
    });
  } catch {
    throw new SupabaseRestError("Location lookup is temporarily unavailable.", 503);
  }
  if (response.status === 404) throw new SupabaseRestError(`ZIP code ${zip} could not be resolved.`, 422);
  if (!response.ok) throw new SupabaseRestError("Location lookup is temporarily unavailable.", 503);
  const payload = await response.json();
  const place = Array.isArray(payload?.places) ? payload.places[0] : null;
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new SupabaseRestError("Location lookup returned invalid coordinates.", 503);
  }

  const row = {
    id: crypto.randomUUID(),
    country_code: "US",
    postal_code: zip,
    latitude,
    longitude,
    provider: "zippopotam",
    accuracy: 0.5,
    accuracy_type: "postal_centroid",
    updated_at: new Date().toISOString()
  };
  try {
    await insertRows("postal_code_centroids", [row], {
      upsert: true,
      onConflict: "country_code,postal_code",
      returning: false
    });
  } catch (error) {
    console.warn("[Dinner Dice & Dragons] Unable to cache ZIP centroid", error);
  }
  return { latitude, longitude };
}
