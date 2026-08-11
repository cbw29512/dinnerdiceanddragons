(() => {
  "use strict";

  const BLACKOUTS = {
    "south-florence-tabletop-cafe": ["2026-09-09"],
    "seminar-brewing": ["2026-10-06"]
  };

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function minutes(value) {
    return window.DDDTableMatch.minutes(value);
  }

  function dateKey(date) {
    try {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch (error) {
      logError("Unable to format date key", error);
      return "";
    }
  }

  function humanDate(date) {
    try {
      return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
    } catch (error) {
      logError("Unable to format date", error);
      return dateKey(date);
    }
  }

  function venueWindow(venue, day, start, end) {
    try {
      return venue.windows.find((window) => window.day === day && minutes(window.start) <= start && minutes(window.end) >= end) || null;
    } catch (error) {
      logError(`Unable to check venue ${venue.name}`, error);
      return null;
    }
  }

  async function evaluateVenue(venue, input, dates) {
    try {
      const gmPoint = await window.DDDGeo.lookupZip(input.zip);
      const venuePoint = await window.DDDGeo.lookupZip(venue.postalCode);
      const gmDistance = window.DDDGeo.distanceMiles(gmPoint, venuePoint);
      if (!Number.isFinite(gmDistance) || gmDistance > input.radius) return null;
      const venueSlot = venueWindow(venue, input.day, input.start, input.end);
      if (!venueSlot) return null;
      const players = await window.DDDTableMatch.eligiblePlayers(input.system, input.day, input.start, input.end, venue.postalCode);
      const occurrences = dates.map((date) => {
        const blackout = (BLACKOUTS[venue.id] || []).includes(dateKey(date));
        const viable = !blackout && players.length >= window.DDDTableMatch.MIN_DEMAND;
        return { date, viable, blackout, playerCount: players.length };
      });
      const viableCount = occurrences.filter((item) => item.viable).length;
      return { venue, gmDistance, venueSlot, players, occurrences, viableCount };
    } catch (error) {
      logError(`Unable to evaluate recurring venue ${venue.name}`, error);
      return null;
    }
  }

  function occurrenceMarkup(item) {
    const label = item.viable ? "✓ Viable" : item.blackout ? "✕ Venue conflict" : "✕ Not enough Players";
    const action = item.viable ? "" : `<div class="game-actions"><button type="button" data-series-action="skip" data-date="${dateKey(item.date)}">Skip</button><button type="button" data-series-action="move" data-date="${dateKey(item.date)}">Move</button></div>`;
    return `<div class="venue-schedule-row"><strong>${humanDate(item.date)}</strong><span>${item.playerCount} Players</span><span>${label}</span><span>${action}</span></div>`;
  }

  function renderResult(result, input) {
    const percent = Math.round((result.viableCount / result.occurrences.length) * 100);
    const card = document.createElement("article");
    card.className = "panel";
    card.innerHTML = `<p class="eyebrow">${result.viableCount === result.occurrences.length ? "STRONG RECURRING MATCH" : "RECOVERABLE SERIES"}</p><h3>${result.venue.name} · ${percent}% of next 6 dates viable</h3><p>${input.system} · ${input.day} · ${result.gmDistance.toFixed(1)} miles from GM · ${result.players.length} compatible Player signals</p><div>${result.occurrences.map(occurrenceMarkup).join("")}</div><div class="next-step"><strong>${result.viableCount}/6 viable →</strong><a class="button primary" href="create-game.html">Form This Series</a><a class="button secondary" href="venues.html">Try Another Venue</a></div>`;
    return card;
  }

  async function calculate(form) {
    try {
      const start = minutes(document.querySelector("#series-start").value);
      const duration = Number(document.querySelector("#series-duration").value);
      const input = {
        system: document.querySelector("#series-system").value,
        zip: document.querySelector("#series-zip").value,
        radius: Number(document.querySelector("#series-radius").value),
        day: document.querySelector("#series-day").value,
        start,
        end: start + duration,
        pattern: document.querySelector("#series-pattern").value
      };
      const rule = {
        pattern: input.pattern,
        day: input.day,
        weekInterval: document.querySelector("#series-week-interval").value,
        monthInterval: document.querySelector("#series-month-interval").value,
        monthlyOrdinal: document.querySelector("#series-ordinal").value,
        anchorDate: document.querySelector("#series-anchor").value
      };
      const dates = window.DDDRecurrence.nextDates(rule, 6, new Date());
      const status = document.querySelector("#recurring-match-status");
      const results = document.querySelector("#recurring-match-results");
      if (!dates.length) {
        status.textContent = "This recurrence needs a valid anchor date before it can be calculated.";
        return;
      }
      status.textContent = "Calculating recurring Player + GM + Venue overlap…";
      const evaluated = (await Promise.all((window.DDD_VENUES || []).map((venue) => evaluateVenue(venue, input, dates)))).filter(Boolean).sort((a, b) => b.viableCount - a.viableCount);
      results.replaceChildren();
      evaluated.forEach((result) => results.appendChild(renderResult(result, input)));
      if (!evaluated.length) results.innerHTML = '<div class="panel empty-state"><h3>No recurring venue match yet.</h3><p>Try another day, shorter session, or larger travel radius.</p></div>';
      status.textContent = `${evaluated.length} recurring venue option${evaluated.length === 1 ? "" : "s"} evaluated.`;
    } catch (error) {
      logError("Unable to calculate recurring Table Match", error);
      document.querySelector("#recurring-match-status").textContent = "Recurring match calculation failed. Please try again.";
    }
  }

  function bind() {
    try {
      const form = document.querySelector("#recurring-match-form");
      const pattern = document.querySelector("#series-pattern");
      if (!form || !pattern) return;
      const toggle = () => {
        const monthly = pattern.value === "monthly";
        document.querySelector("#week-interval-label").hidden = monthly;
        document.querySelector("#ordinal-label").hidden = !monthly;
        document.querySelector("#month-interval-label").hidden = !monthly;
      };
      pattern.addEventListener("change", toggle);
      form.addEventListener("submit", (event) => { event.preventDefault(); calculate(form); });
      document.querySelector("#recurring-match-results")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-series-action]");
        if (!button) return;
        const verb = button.dataset.seriesAction === "skip" ? "Skipped" : "Move requested for";
        document.querySelector("#recurring-match-status").textContent = `${verb} ${button.dataset.date}. This will become a one-session exception, not a recurrence change.`;
      });
      toggle();
    } catch (error) {
      logError("Unable to initialize recurring Table Match", error);
    }
  }

  bind();
})();
