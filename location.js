(() => {
  "use strict";

  const form = document.querySelector("#location-filter");
  const zipInput = document.querySelector("#home-zip");
  const radiusSelect = document.querySelector("#travel-radius");
  const resetButton = document.querySelector("#reset-location");
  const statusNode = document.querySelector("#location-status");
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
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) throw new Error("Invalid ZIP coordinates.");
      cache.set(zipCode, location);
      return location;
    } catch (error) {
      logError(`Unable to resolve ZIP ${zipCode}`, error);
      throw error;
    }
  }

  async function applyFilter(zipCode, radius) {
    try {
      const discovery = window.DDDDiscovery;
      if (!discovery) throw new Error("Discovery module is unavailable.");
      const home = await lookupZip(zipCode);
      const results = [];
      for (const game of discovery.games) {
        try {
          const venue = await lookupZip(game.venuePostalCode);
          const miles = distanceMiles(home, venue);
          if (Number.isFinite(miles) && miles <= radius) results.push({ game, distanceMiles: miles });
        } catch (error) { logError(`Unable to match ${game.title}`, error); }
      }
      results.sort((a, b) => a.distanceMiles - b.distanceMiles);
      discovery.renderGames(results);
      localStorage.setItem("ddd-home-zip", zipCode);
      localStorage.setItem("ddd-travel-radius", String(radius));
      if (statusNode) statusNode.textContent = `${results.length} game${results.length === 1 ? "" : "s"} within ${radius} miles of ${home.city}, ${home.state}.`;
    } catch (error) {
      if (statusNode) statusNode.textContent = "We could not match that ZIP code right now. Check the five digits and try again.";
    }
  }

  function bindControls() {
    try {
      if (!form || !zipInput || !radiusSelect || !resetButton) return;
      const savedZip = localStorage.getItem("ddd-home-zip");
      const savedRadius = localStorage.getItem("ddd-travel-radius");
      if (savedZip) zipInput.value = savedZip;
      if (savedRadius) radiusSelect.value = savedRadius;

      form.addEventListener("submit", async (event) => {
        try {
          event.preventDefault();
          const zipCode = zipInput.value.trim();
          const radius = Number.parseInt(radiusSelect.value, 10);
          if (!/^\d{5}$/.test(zipCode)) {
            if (statusNode) statusNode.textContent = "Enter a five-digit US ZIP code.";
            zipInput.focus();
            return;
          }
          if (statusNode) statusNode.textContent = "Finding nearby tables…";
          await applyFilter(zipCode, radius);
        } catch (error) { logError("Unable to apply location filter", error); }
      });

      resetButton.addEventListener("click", () => {
        try {
          window.DDDDiscovery.renderGames();
          if (statusNode) statusNode.textContent = "Showing all prototype games.";
        } catch (error) { logError("Unable to reset games", error); }
      });
    } catch (error) { logError("Unable to initialize location controls", error); }
  }

  bindControls();
})();
