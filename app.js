(() => {
  "use strict";

  const grid = document.querySelector("#game-grid");
  const locationForm = document.querySelector("#location-filter");
  const zipInput = document.querySelector("#home-zip");
  const radiusSelect = document.querySelector("#travel-radius");
  const resetButton = document.querySelector("#reset-location");
  const statusNode = document.querySelector("#location-status");
  const games = Array.isArray(window.DDD_GAMES) ? window.DDD_GAMES : [];
  const zipCache = new Map();

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function createTag(label) {
    try {
      const tag = document.createElement("span");
      tag.textContent = label;
      return tag;
    } catch (error) {
      logError("Unable to create game tag", error);
      return document.createElement("span");
    }
  }

  function createDistanceLabel(distanceMiles) {
    try {
      if (!Number.isFinite(distanceMiles)) return null;
      const distance = document.createElement("p");
      distance.className = "distance-label";
      distance.textContent = `📍 About ${distanceMiles.toFixed(1)} miles away`;
      return distance;
    } catch (error) {
      logError("Unable to create distance label", error);
      return null;
    }
  }

  function buildGameCard(game, distanceMiles = null) {
    try {
      const article = document.createElement("article");
      article.className = "game-card";

      const system = document.createElement("p");
      system.className = "eyebrow";
      system.textContent = game.system;

      const title = document.createElement("h3");
      title.textContent = game.title;

      const meta = document.createElement("p");
      meta.className = "game-meta";
      meta.textContent = `${game.type} · ${game.when} · ${game.venue}`;

      const distance = createDistanceLabel(distanceMiles);

      const style = document.createElement("p");
      style.textContent = game.style;

      const seats = document.createElement("strong");
      seats.textContent = game.seats;

      const tags = document.createElement("div");
      tags.className = "tag-row";
      game.tags.forEach((label) => tags.appendChild(createTag(label)));

      const actions = document.createElement("div");
      actions.className = "game-actions";

      const passButton = document.createElement("button");
      passButton.type = "button";
      passButton.textContent = "Pass";
      passButton.addEventListener("click", () => {
        try {
          article.setAttribute("aria-label", `${game.title} passed for this prototype session`);
          article.style.opacity = "0.55";
        } catch (error) {
          logError("Unable to mark game as passed", error);
        }
      });

      const interestButton = document.createElement("button");
      interestButton.type = "button";
      interestButton.className = "interested";
      interestButton.textContent = "♥ Interested";
      interestButton.setAttribute("aria-pressed", "false");
      interestButton.addEventListener("click", () => {
        try {
          const pressed = interestButton.getAttribute("aria-pressed") === "true";
          interestButton.setAttribute("aria-pressed", String(!pressed));
          interestButton.textContent = pressed ? "♥ Interested" : "✓ Interested";
        } catch (error) {
          logError("Unable to update interest state", error);
        }
      });

      actions.append(passButton, interestButton);
      article.append(system, title, meta);
      if (distance) article.append(distance);
      article.append(style, seats, tags, actions);
      return article;
    } catch (error) {
      logError("Unable to build game card", error);
      return null;
    }
  }

  function renderGames(gameResults = games.map((game) => ({ game, distanceMiles: null }))) {
    try {
      if (!grid) throw new Error("Game grid container was not found.");
      grid.replaceChildren();

      if (!gameResults.length) {
        const empty = document.createElement("div");
        empty.className = "panel empty-state";
        empty.innerHTML = "<h3>No tables inside that travel radius yet.</h3><p>Try a larger radius or show all prototype games.</p>";
        grid.appendChild(empty);
        return;
      }

      gameResults.forEach(({ game, distanceMiles }) => {
        const card = buildGameCard(game, distanceMiles);
        if (card) grid.appendChild(card);
      });
    } catch (error) {
      logError("Unable to render prototype games", error);
      if (grid) grid.textContent = "Game previews are temporarily unavailable.";
    }
  }

  function toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  function calculateDistanceMiles(a, b) {
    try {
      const earthRadiusMiles = 3958.8;
      const lat1 = toRadians(a.latitude);
      const lat2 = toRadians(b.latitude);
      const deltaLat = toRadians(b.latitude - a.latitude);
      const deltaLon = toRadians(b.longitude - a.longitude);

      const haversine =
        Math.sin(deltaLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
      const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
      return earthRadiusMiles * centralAngle;
    } catch (error) {
      logError("Unable to calculate geographic distance", error);
      return Number.NaN;
    }
  }

  async function lookupZip(zipCode) {
    try {
      if (zipCache.has(zipCode)) return zipCache.get(zipCode);

      const response = await fetch(`https://api.zippopotam.us/us/${encodeURIComponent(zipCode)}`);
      if (!response.ok) throw new Error(`ZIP lookup returned HTTP ${response.status}`);

      const data = await response.json();
      const place = Array.isArray(data.places) ? data.places[0] : null;
      if (!place) throw new Error("ZIP lookup did not return a location.");

      const location = {
        postalCode: data["post code"],
        city: place["place name"],
        state: place["state abbreviation"],
        latitude: Number.parseFloat(place.latitude),
        longitude: Number.parseFloat(place.longitude)
      };

      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        throw new Error("ZIP lookup returned invalid coordinates.");
      }

      zipCache.set(zipCode, location);
      return location;
    } catch (error) {
      logError(`Unable to resolve ZIP ${zipCode}`, error);
      throw error;
    }
  }

  async function filterByTravelRadius(zipCode, radiusMiles) {
    try {
      const userLocation = await lookupZip(zipCode);
      const results = [];

      for (const game of games) {
        try {
          if (!game.venuePostalCode) continue;
          const venueLocation = await lookupZip(game.venuePostalCode);
          const distanceMiles = calculateDistanceMiles(userLocation, venueLocation);
          if (Number.isFinite(distanceMiles) && distanceMiles <= radiusMiles) {
            results.push({ game, distanceMiles });
          }
        } catch (error) {
          logError(`Unable to evaluate distance for ${game.title}`, error);
        }
      }

      results.sort((a, b) => a.distanceMiles - b.distanceMiles);
      renderGames(results);

      if (statusNode) {
        statusNode.textContent = `${results.length} game${results.length === 1 ? "" : "s"} found within ${radiusMiles} miles of ${userLocation.city}, ${userLocation.state} (${zipCode}).`;
      }
    } catch (error) {
      if (statusNode) {
        statusNode.textContent = "We could not find that ZIP code right now. Check the five digits and try again.";
      }
    }
  }

  function bindLocationControls() {
    try {
      if (!locationForm || !zipInput || !radiusSelect || !resetButton) return;

      locationForm.addEventListener("submit", async (event) => {
        try {
          event.preventDefault();
          const zipCode = zipInput.value.trim();
          const radiusMiles = Number.parseInt(radiusSelect.value, 10);

          if (!/^\d{5}$/.test(zipCode)) {
            if (statusNode) statusNode.textContent = "Enter a five-digit US ZIP code.";
            zipInput.focus();
            return;
          }

          if (!Number.isFinite(radiusMiles) || radiusMiles <= 0) {
            if (statusNode) statusNode.textContent = "Choose a valid travel radius.";
            return;
          }

          if (statusNode) statusNode.textContent = "Finding nearby tables…";
          await filterByTravelRadius(zipCode, radiusMiles);
        } catch (error) {
          logError("Unable to apply location filter", error);
          if (statusNode) statusNode.textContent = "Location matching is temporarily unavailable.";
        }
      });

      resetButton.addEventListener("click", () => {
        try {
          renderGames();
          if (statusNode) statusNode.textContent = "Showing all prototype games.";
        } catch (error) {
          logError("Unable to reset location filter", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize location controls", error);
    }
  }

  try {
    renderGames();
    bindLocationControls();
  } catch (error) {
    logError("Unable to initialize prototype", error);
  }
})();
