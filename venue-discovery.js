(() => {
  "use strict";

  const form = document.querySelector("#venue-location-filter");
  const zipInput = document.querySelector("#venue-home-zip");
  const radiusSelect = document.querySelector("#venue-travel-radius");
  const daySelect = document.querySelector("#gm-day");
  const startInput = document.querySelector("#gm-start");
  const durationSelect = document.querySelector("#gm-duration");
  const statusNode = document.querySelector("#venue-location-status");
  const resultsNode = document.querySelector("#venue-results");
  const venues = Array.isArray(window.DDD_VENUES) ? window.DDD_VENUES : [];

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function timeToMinutes(value) {
    try {
      const [hours, minutes] = String(value).split(":").map(Number);
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) throw new Error("Invalid time value");
      return (hours * 60) + minutes;
    } catch (error) {
      logError("Unable to parse time", error);
      return Number.NaN;
    }
  }

  function formatTime(value) {
    try {
      const [hoursText, minutes] = String(value).split(":");
      const hours = Number(hoursText);
      const suffix = hours >= 12 ? "PM" : "AM";
      const display = hours % 12 || 12;
      return `${display}:${minutes} ${suffix}`;
    } catch (error) {
      logError("Unable to format time", error);
      return value;
    }
  }

  function matchingWindows(venue, day, startMinutes, durationMinutes) {
    try {
      const requiredEnd = startMinutes + durationMinutes;
      return (venue.windows || []).filter((window) => {
        const windowStart = timeToMinutes(window.start);
        const windowEnd = timeToMinutes(window.end);
        return window.day === day && startMinutes >= windowStart && requiredEnd <= windowEnd;
      });
    } catch (error) {
      logError(`Unable to compare schedule for ${venue.name}`, error);
      return [];
    }
  }

  function buildVenueCard(venue, distance, window) {
    try {
      const article = document.createElement("article");
      article.className = "game-card";
      article.appendChild(Object.assign(document.createElement("p"), { className: "eyebrow", textContent: venue.verified ? "VERIFIED PARTNER" : "PARTNER VENUE" }));
      article.appendChild(Object.assign(document.createElement("h3"), { textContent: venue.name }));
      article.appendChild(Object.assign(document.createElement("p"), { className: "distance-label", textContent: `📍 About ${distance.toFixed(1)} miles away` }));
      article.appendChild(Object.assign(document.createElement("p"), { textContent: venue.type }));
      article.appendChild(Object.assign(document.createElement("p"), { textContent: `Matching slot: ${window.day} ${formatTime(window.start)}–${formatTime(window.end)}` }));
      article.appendChild(Object.assign(document.createElement("p"), { textContent: `${window.tables} table${window.tables === 1 ? "" : "s"} · up to ${window.seatsPerTable} guests per table` }));
      article.appendChild(Object.assign(document.createElement("p"), { textContent: venue.amenities }));

      const policy = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = "Venue policy: ";
      policy.append(strong, document.createTextNode(venue.policy));
      article.appendChild(policy);

      if (venue.approvalRequired) {
        article.appendChild(Object.assign(document.createElement("p"), { className: "microcopy", textContent: "Venue approval required before this table is considered confirmed." }));
      }

      const action = document.createElement("button");
      action.type = "button";
      action.className = "button primary";
      action.textContent = "Choose This Venue & Create Game";
      action.addEventListener("click", () => {
        try {
          const selection = {
            venueId: venue.id,
            venueName: venue.name,
            venuePostalCode: venue.postalCode,
            day: window.day,
            windowStart: window.start,
            windowEnd: window.end,
            gmStart: startInput.value,
            durationMinutes: Number.parseInt(durationSelect.value, 10),
            radius: Number.parseInt(radiusSelect.value, 10),
            homeZip: zipInput.value.trim(),
            policy: venue.policy,
            approvalRequired: venue.approvalRequired
          };
          localStorage.setItem("ddd-selected-venue-slot", JSON.stringify(selection));
          window.location.href = "create-game.html";
        } catch (error) {
          logError("Unable to select venue", error);
        }
      });
      article.appendChild(action);
      return article;
    } catch (error) {
      logError("Unable to build venue card", error);
      return null;
    }
  }

  async function findVenues(zipCode, radius, day, startMinutes, durationMinutes) {
    try {
      if (!window.DDDGeo) throw new Error("Geographic module unavailable.");
      const home = await window.DDDGeo.lookupZip(zipCode);
      const matched = [];
      for (const venue of venues) {
        try {
          const windows = matchingWindows(venue, day, startMinutes, durationMinutes);
          if (!windows.length) continue;
          const location = await window.DDDGeo.lookupZip(venue.postalCode);
          const distance = window.DDDGeo.distanceMiles(home, location);
          if (Number.isFinite(distance) && distance <= radius) {
            windows.forEach((window) => matched.push({ venue, distance, window }));
          }
        } catch (error) {
          logError(`Unable to match venue ${venue.name}`, error);
        }
      }
      matched.sort((a, b) => a.distance - b.distance);
      resultsNode.replaceChildren();
      matched.forEach(({ venue, distance, window }) => {
        const card = buildVenueCard(venue, distance, window);
        if (card) resultsNode.appendChild(card);
      });
      if (!matched.length) {
        resultsNode.innerHTML = "<div class='panel empty-state'><h3>No venue can fit that full session yet.</h3><p>Try another day, an earlier start, a shorter session, or a larger travel radius.</p></div>";
      }
      localStorage.setItem("ddd-home-zip", zipCode);
      localStorage.setItem("ddd-travel-radius", String(radius));
      statusNode.textContent = `${matched.length} matching venue slot${matched.length === 1 ? "" : "s"} for ${day} within ${radius} miles of ${home.city}, ${home.state}.`;
    } catch (error) {
      logError("Unable to find matching venue windows", error);
      statusNode.textContent = "We could not complete that match. Check your ZIP and schedule and try again.";
    }
  }

  function bind() {
    try {
      if (!form || !zipInput || !radiusSelect || !daySelect || !startInput || !durationSelect || !statusNode || !resultsNode) return;
      const savedZip = localStorage.getItem("ddd-home-zip");
      const savedRadius = localStorage.getItem("ddd-travel-radius");
      if (savedZip) zipInput.value = savedZip;
      if (savedRadius) radiusSelect.value = savedRadius;

      form.addEventListener("submit", async (event) => {
        try {
          event.preventDefault();
          const zipCode = zipInput.value.trim();
          const radius = Number.parseInt(radiusSelect.value, 10);
          const day = daySelect.value;
          const startMinutes = timeToMinutes(startInput.value);
          const durationMinutes = Number.parseInt(durationSelect.value, 10);
          if (!/^\d{5}$/.test(zipCode)) {
            statusNode.textContent = "Enter a five-digit US ZIP code.";
            zipInput.focus();
            return;
          }
          if (!day) {
            statusNode.textContent = "Choose the day you can GM.";
            daySelect.focus();
            return;
          }
          if (!Number.isFinite(startMinutes)) {
            statusNode.textContent = "Choose a valid start time.";
            startInput.focus();
            return;
          }
          statusNode.textContent = "Matching your GM time to willing venue windows…";
          await findVenues(zipCode, radius, day, startMinutes, durationMinutes);
        } catch (error) {
          logError("Unable to submit venue schedule search", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize venue discovery", error);
    }
  }

  bind();
})();
