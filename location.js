(() => {
  "use strict";

  const form = document.querySelector("#location-filter");
  const zipInput = document.querySelector("#home-zip");
  const radiusSelect = document.querySelector("#travel-radius");
  const systemSelect = document.querySelector("#game-system-filter");
  const daySelect = document.querySelector("#game-day-filter");
  const resetButton = document.querySelector("#reset-location");
  const statusNode = document.querySelector("#location-status");

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function matchesGameFilters(game, system, day) {
    try {
      const systemMatch = !system || String(game.system).toLowerCase() === system.toLowerCase();
      const dayMatch = !day || String(game.when).toLowerCase().startsWith(day.toLowerCase());
      return systemMatch && dayMatch;
    } catch (error) {
      logError("Unable to compare game filters", error);
      return false;
    }
  }

  async function applyFilter(zipCode, radius, system, day) {
    try {
      const discovery = window.DDDDiscovery;
      const geo = window.DDDGeo;
      if (!discovery || !geo) throw new Error("Discovery or geographic module is unavailable.");

      const filteredGames = discovery.games.filter((game) => matchesGameFilters(game, system, day));
      const results = [];
      let home = null;

      if (zipCode) home = await geo.lookupZip(zipCode);

      for (const game of filteredGames) {
        try {
          if (!home) {
            results.push({ game, distanceMiles: null });
            continue;
          }
          const venue = await geo.lookupZip(game.venuePostalCode);
          const miles = geo.distanceMiles(home, venue);
          if (Number.isFinite(miles) && miles <= radius) results.push({ game, distanceMiles: miles });
        } catch (error) {
          logError(`Unable to match ${game.title}`, error);
        }
      }

      results.sort((a, b) => {
        if (!Number.isFinite(a.distanceMiles) || !Number.isFinite(b.distanceMiles)) return 0;
        return a.distanceMiles - b.distanceMiles;
      });
      discovery.renderGames(results);

      if (zipCode) {
        localStorage.setItem("ddd-home-zip", zipCode);
        localStorage.setItem("ddd-travel-radius", String(radius));
      }

      if (statusNode) {
        const where = home ? ` within ${radius} miles of ${home.city}, ${home.state}` : "";
        const what = system ? ` for ${system}` : "";
        const when = day ? ` on ${day}` : "";
        statusNode.textContent = `${results.length} game${results.length === 1 ? "" : "s"}${what}${when}${where}.`;
      }
    } catch (error) {
      logError("Unable to apply game filters", error);
      if (statusNode) statusNode.textContent = "We could not complete that search. Check your ZIP code and try again.";
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
          const system = systemSelect?.value || "";
          const day = daySelect?.value || "";
          if (zipCode && !/^\d{5}$/.test(zipCode)) {
            if (statusNode) statusNode.textContent = "Enter a five-digit US ZIP code, or leave it blank to browse all sample games.";
            zipInput.focus();
            return;
          }
          if (statusNode) statusNode.textContent = "Finding games that fit…";
          await applyFilter(zipCode, radius, system, day);
        } catch (error) {
          logError("Unable to submit game search", error);
        }
      });

      resetButton.addEventListener("click", () => {
        try {
          form.reset();
          if (savedRadius) radiusSelect.value = savedRadius;
          window.DDDDiscovery.renderGames();
          if (statusNode) statusNode.textContent = "Showing all games.";
        } catch (error) {
          logError("Unable to reset games", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize game search", error);
    }
  }

  bindControls();
})();
