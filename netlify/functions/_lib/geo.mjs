import { SupabaseRestError, eq, insertRows, selectOne } from "./supabase-rest.mjs";

const EARTH_RADIUS_MILES = 3958.7613;

function radians(value) {
  return value * Math.PI / 180;
}

function postalCode(value) {
  const zip = String(value || "").trim();
  if (!/^\d{5}$/.test(zip)) throw new SupabaseRestError("Postal code is invalid for matching.", 422);
  return zip;
}

export function postalPlaceFromPayload(postalCodeValue, payload) {
  const zip = postalCode(postalCodeValue);
  const place = Array.isArray(payload?.places) ? payload.places[0] : null;
  const city = String(place?.["place name"] || "").trim();
  const state = String(place?.state || "").trim();
  const stateCode = String(place?.["state abbreviation"] || "").trim().toUpperCase();
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!city || !/^[A-Z]{2}$/.test(stateCode) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new SupabaseRestError("Location lookup returned invalid location data.", 503);
  }
  return { postal_code: zip, city, state, state_code: stateCode, latitude, longitude };
}

async function fetchPostalPlace(zip) {
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
  return postalPlaceFromPayload(zip, await response.json());
}

async function cachePostalCentroid(place) {
  const row = {
    id: crypto.randomUUID(),
    country_code: "US",
    postal_code: place.postal_code,
    latitude: place.latitude,
    longitude: place.longitude,
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

export async function postalPlace(postalCodeValue) {
  const place = await fetchPostalPlace(postalCode(postalCodeValue));
  await cachePostalCentroid(place);
  return place;
}

export async function postalCentroid(postalCodeValue) {
  const zip = postalCode(postalCodeValue);
  const cached = await selectOne("postal_code_centroids", {
    country_code: eq("US"),
    postal_code: eq(zip)
  });
  if (cached) return { latitude: Number(cached.latitude), longitude: Number(cached.longitude) };
  const place = await postalPlace(zip);
  return { latitude: place.latitude, longitude: place.longitude };
}
