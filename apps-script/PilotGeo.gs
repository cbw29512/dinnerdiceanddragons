function pilotRadians_(value) {
  try {
    return Number(value) * (Math.PI / 180);
  } catch (error) {
    console.error("[DDD] pilotRadians_ failed", error);
    return Number.NaN;
  }
}

function pilotDistanceMiles_(a, b) {
  try {
    const lat1 = pilotRadians_(a.latitude);
    const lat2 = pilotRadians_(b.latitude);
    const dLat = pilotRadians_(b.latitude - a.latitude);
    const dLon = pilotRadians_(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  } catch (error) {
    console.error("[DDD] pilotDistanceMiles_ failed", error);
    return Number.NaN;
  }
}

function pilotMinutes_(value) {
  try {
    const parts = String(value || "").split(":").map(Number);
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return Number.NaN;
    return (parts[0] * 60) + parts[1];
  } catch (error) {
    console.error("[DDD] pilotMinutes_ failed", error);
    return Number.NaN;
  }
}

function pilotZipPoint_(zipCode) {
  try {
    const zip = String(zipCode || "").trim();
    if (!/^\d{5}$/.test(zip)) throw new Error("Invalid US ZIP code");
    const cache = CacheService.getScriptCache();
    const cacheKey = `ddd_zip_${zip}`;
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = UrlFetchApp.fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`, { muteHttpExceptions:true });
    if (response.getResponseCode() !== 200) throw new Error(`ZIP lookup HTTP ${response.getResponseCode()}`);
    const data = JSON.parse(response.getContentText() || "{}");
    const place = Array.isArray(data.places) ? data.places[0] : null;
    if (!place) throw new Error("ZIP lookup returned no place");
    const point = {
      city: String(place["place name"] || ""),
      state: String(place["state abbreviation"] || ""),
      latitude: Number.parseFloat(place.latitude),
      longitude: Number.parseFloat(place.longitude)
    };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) throw new Error("ZIP lookup returned invalid coordinates");
    cache.put(cacheKey, JSON.stringify(point), 3600);
    return point;
  } catch (error) {
    console.error(`[DDD] pilotZipPoint_ failed for ${zipCode}`, error);
    throw error;
  }
}
