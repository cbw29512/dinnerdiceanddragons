(() => {
  "use strict";

  const form = document.querySelector("#location-filter");
  const zipInput = document.querySelector("#home-zip");
  const radiusSelect = document.querySelector("#travel-radius");
  const resetButton = document.querySelector("#reset-location");
  const statusNode = document.querySelector("#location-status");

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  async function applyFilter(zipCode, radius) {
    try {
      const discovery = window.DDDDiscovery;
      const geo = window.DDDGeo;
      if (!discovery || !geo) throw new Error("Discovery or geographic module is unavailable.");
      const home = await geo.lookupZip(zipCode);
      const results = [];

      for (const game of discovery.games) {
        try {
          const venue = await geo.lookupZip(game.venuePostalCode);
          const miles = geo.distanceMiles(home, venue);
          if (Number.isFinite(miles) && miles <= radius) results.push({ game, distanceMiles: miles });
        } catch (error) {
          logError(`Unable to match ${game.title}`, error);
        }
      }

      results.sort((a, b) => a.distanceMiles - b.distanceMiles);
      discovery.renderGames(results);
      localStorage.setItem("ddd-home-zip", zipCode);
      localStorage.setItem("ddd-travel-radius", String(radius));
      if (statusNode) statusNode.textContent = `${results.length} game${results.length === 1 ? "" : "s"} within ${radius} miles of ${home.city}, ${home.state}.`;
    } catch (error) {
      logError("Unable to apply geographic filter", error);
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
        } catch (error) {
          logError("Unable to submit location filter", error);
        }
      });

      resetButton.addEventListener("click", () => {
        try {
          window.DDDDiscovery.renderGames();
          if (statusNode) statusNode.textContent = "Showing all prototype games.";
        } catch (error) {
          logError("Unable to reset games", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize location controls", error);
    }
  }

  bindControls();
})();
