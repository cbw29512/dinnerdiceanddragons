(() => {
  "use strict";

  const distanceNode = document.querySelector("#game-distance");

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  async function showSavedDistance() {
    try {
      if (!distanceNode || !window.DDDGeo) return;
      const venueZip = distanceNode.dataset.venueZip;
      const homeZip = localStorage.getItem("ddd-home-zip");
      const radius = Number.parseInt(localStorage.getItem("ddd-travel-radius"), 10);
      if (!homeZip || !venueZip) {
        distanceNode.textContent = "Set your ZIP on Find a Game to see approximate distance.";
        return;
      }
      const [home, venue] = await Promise.all([window.DDDGeo.lookupZip(homeZip), window.DDDGeo.lookupZip(venueZip)]);
      const miles = window.DDDGeo.distanceMiles(home, venue);
      if (!Number.isFinite(miles)) throw new Error("Distance calculation failed.");
      const rangeText = Number.isFinite(radius) ? (miles <= radius ? ` · inside your ${radius}-mile range` : ` · outside your ${radius}-mile range`) : "";
      distanceNode.textContent = `📍 About ${miles.toFixed(1)} miles from your saved ZIP${rangeText}.`;
    } catch (error) {
      logError("Unable to show game distance", error);
      if (distanceNode) distanceNode.textContent = "Approximate distance is temporarily unavailable.";
    }
  }

  showSavedDistance();
})();
