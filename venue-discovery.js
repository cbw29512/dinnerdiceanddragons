(() => {
  "use strict";

  const form = document.querySelector("#venue-location-filter");
  const zipInput = document.querySelector("#venue-home-zip");
  const radiusSelect = document.querySelector("#venue-travel-radius");
  const statusNode = document.querySelector("#venue-location-status");
  const resultsNode = document.querySelector("#venue-results");
  const venues = Array.isArray(window.DDD_VENUES) ? window.DDD_VENUES : [];

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function buildVenueCard(venue, distance) {
    try {
      const article = document.createElement("article");
      article.className = "game-card";
      article.innerHTML = `<p class="eyebrow">${venue.verified ? "VERIFIED PARTNER" : "PARTNER VENUE"}</p><h3></h3><p class="distance-label"></p><p></p><p></p><p></p><p></p>`;
      const nodes = article.querySelectorAll("p");
      article.querySelector("h3").textContent = venue.name;
      nodes[1].textContent = `📍 About ${distance.toFixed(1)} miles away`;
      nodes[2].textContent = venue.type;
      nodes[3].textContent = `Available: ${venue.availability}`;
      nodes[4].textContent = `Capacity: ${venue.capacity}`;
      nodes[5].textContent = venue.amenities;

      const policy = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = "Table policy: ";
      policy.append(strong, document.createTextNode(venue.policy));

      const action = document.createElement("a");
      action.className = "button primary";
      action.href = "join.html#gm-signup";
      action.textContent = "Host a Game Here";
      article.append(policy, action);
      return article;
    } catch (error) {
      logError("Unable to build venue card", error);
      return null;
    }
  }

  async function findVenues(zipCode, radius) {
    try {
      if (!window.DDDGeo) throw new Error("Geographic module unavailable.");
      const home = await window.DDDGeo.lookupZip(zipCode);
      const matched = [];
      for (const venue of venues) {
        try {
          const location = await window.DDDGeo.lookupZip(venue.postalCode);
          const distance = window.DDDGeo.distanceMiles(home, location);
          if (Number.isFinite(distance) && distance <= radius) matched.push({ venue, distance });
        } catch (error) {
          logError(`Unable to match venue ${venue.name}`, error);
        }
      }
      matched.sort((a, b) => a.distance - b.distance);
      resultsNode.replaceChildren();
      matched.forEach(({ venue, distance }) => {
        const card = buildVenueCard(venue, distance);
        if (card) resultsNode.appendChild(card);
      });
      if (!matched.length) {
        resultsNode.innerHTML = "<div class='panel empty-state'><h3>No partner venues in that radius yet.</h3><p>Try expanding your travel distance.</p></div>";
      }
      localStorage.setItem("ddd-home-zip", zipCode);
      localStorage.setItem("ddd-travel-radius", String(radius));
      statusNode.textContent = `${matched.length} venue${matched.length === 1 ? "" : "s"} within ${radius} miles of ${home.city}, ${home.state}.`;
    } catch (error) {
      logError("Unable to find nearby venues", error);
      statusNode.textContent = "We could not match that ZIP code right now. Check the five digits and try again.";
    }
  }

  function bind() {
    try {
      if (!form || !zipInput || !radiusSelect || !statusNode || !resultsNode) return;
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
            statusNode.textContent = "Enter a five-digit US ZIP code.";
            zipInput.focus();
            return;
          }
          statusNode.textContent = "Finding willing partner venues…";
          await findVenues(zipCode, radius);
        } catch (error) {
          logError("Unable to submit venue search", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize venue discovery", error);
    }
  }

  bind();
})();
