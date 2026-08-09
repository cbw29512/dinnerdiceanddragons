(() => {
  "use strict";

  const cache = new Map();

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function radians(value) {
    return value * (Math.PI / 180);
  }

  function distanceMiles(a, b) {
    try {
      const lat1 = radians(a.latitude);
      const lat2 = radians(b.latitude);
      const dLat = radians(b.latitude - a.latitude);
      const dLon = radians(b.longitude - a.longitude);
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    } catch (error) {
      logError("Unable to calculate distance", error);
      return Number.NaN;
    }
  }

  async function lookupZip(zipCode) {
    try {
      if (cache.has(zipCode)) return cache.get(zipCode);
      const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zipCode)}`);
      if (!response.ok) throw new Error(`ZIP lookup HTTP ${response.status}`);
      const data = await response.json();
      const place = Array.isArray(data.places) ? data.places[0] : null;
      if (!place) throw new Error("ZIP lookup returned no place.");
      const location = {
        city: place["place name"],
        state: place["state abbreviation"],
        latitude: Number.parseFloat(place.latitude),
        longitude: Number.parseFloat(place.longitude)
      };
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        throw new Error("Invalid ZIP coordinates.");
      }
      cache.set(zipCode, location);
      return location;
    } catch (error) {
      logError(`Unable to resolve ZIP ${zipCode}`, error);
      throw error;
    }
  }

  window.DDDGeo = { distanceMiles, lookupZip };
})();
