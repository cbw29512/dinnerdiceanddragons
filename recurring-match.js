(() => {
  "use strict";

  const BLACKOUTS = {
    "south-florence-tabletop-cafe": ["2026-09-09"],
    "seminar-brewing": ["2026-10-06"]
  };

  const DAY_INDEX = Object.freeze({ Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 });
  let currentResults = [];
  let currentInput = null;
  let currentRule = null;

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

  function nextDateForDay(day) {
    try {
      const target = DAY_INDEX[day];
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      if (!Number.isInteger(target)) return date;
      const difference = (target - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + difference);
      return date;
    } catch (error) {
      logError("Unable to calculate next game date", error);
      return new Date();
    }
  }

  function syncAnchorDate(force = false) {
    try {
      const anchor = document.querySelector("#series-anchor");
      const day = document.querySelector("#series-day")?.value;
      if (!anchor || !day) return;
      const todayKey = dateKey(new Date());
      if (force || !anchor.value || anchor.value < todayKey) anchor.value = dateKey(nextDateForDay(day));
    } catch (error) {
      logError("Unable to set first recurring date", error);
    }
  }

  function venueWindow(venue, day, start, end) {
    try {
      return venue.windows.find((slot) => slot.day === day && minutes(slot.start) <= start && minutes(slot.end) >= end) || null;
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
        return { date, viable, blackout, playerCount: players.length, exception: null };
      });
      const viableCount = occurrences.filter((item) => item.viable).length;
      return { venue, gmDistance, venueSlot, players, occurrences, viableCount };
    } catch (error) {
      logError(`Unable to evaluate recurring venue ${venue.name}`, error);
      return null;
    }
  }

  function patternSummary(input, rule) {
    try {
      if (input.pattern === "monthly") {
        const interval = Number(rule.monthInterval) || 1;
        return `${rule.monthlyOrdinal} ${input.day}${interval === 1 ? " each month" : ` every ${interval} months`}`;
      }
      const weeks = Number(rule.weekInterval) || 1;
      return weeks === 1 ? `Every ${input.day}` : weeks === 2 ? `Every other ${input.day}` : `Every ${weeks} weeks on ${input.day}`;
    } catch (error) {
      logError("Unable to summarize recurrence", error);
      return input.day;
    }
  }

  function occurrenceMarkup(item, venueId) {
    try {
      const key = dateKey(item.date);
      if (item.exception?.action === "skip") {
        return `<div class="venue-schedule-row"><strong>${humanDate(item.date)}</strong><span>${item.playerCount} potential Players</span><span>○ Skipped</span><span><div class="game-actions"><button type="button" data-series-action="restore" data-date="${key}" data-venue-id="${venueId}">Restore Date</button></div></span></div>`;
      }
      if (item.exception?.action === "move_requested") {
        return `<div class="venue-schedule-row"><strong>${humanDate(item.date)}</strong><span>${item.playerCount} potential Players</span><span>△ Move needed</span><span><div class="game-actions"><button type="button" data-series-action="restore" data-date="${key}" data-venue-id="${venueId}">Restore Date</button></div></span></div>`;
      }
      const label = item.viable ? "✓ Looks good" : item.blackout ? "✕ Venue unavailable" : "✕ Needs more Players";
      const action = item.viable ? "" : `<div class="game-actions"><button type="button" data-series-action="skip" data-date="${key}" data-venue-id="${venueId}">Skip This Date</button><button type="button" data-series-action="move" data-date="${key}" data-venue-id="${venueId}">Move This Date</button></div>`;
      return `<div class="venue-schedule-row"><strong>${humanDate(item.date)}</strong><span>${item.playerCount} potential Players</span><span>${label}</span><span>${action}</span></div>`;
    } catch (error) {
      logError("Unable to render recurring occurrence", error);
      return "";
    }
  }

  function selectSeries(result, input, rule) {
    try {
      const payload = {
        system: input.system,
        venue: result.venue.name,
        venueId: result.venue.id,
        gmZip: input.zip,
        gmRadius: input.radius,
        day: input.day,
        startMinutes: input.start,
        endMinutes: input.end,
        pattern: input.pattern,
        patternSummary: patternSummary(input, rule),
        viableCount: result.occurrences.filter((item) => item.viable && !item.exception).length,
        compatiblePlayers: result.players.length,
        sessions: result.occurrences.map((item) => ({
          date: dateKey(item.date),
          viable: item.viable && !item.exception,
          blackout: item.blackout,
          playerCount: item.playerCount,
          exception: item.exception?.action || null
        }))
      };
      sessionStorage.setItem("ddd-recurring-match-selected", JSON.stringify(payload));
      window.location.href = "form-series.html";
    } catch (error) {
      logError("Unable to carry recurring match into series formation", error);
      document.querySelector("#recurring-match-status").textContent = "We couldn’t open the campaign setup. Please try again.";
    }
  }

  function renderResult(result, input, rule) {
    try {
      const activeViable = result.occurrences.filter((item) => item.viable && !item.exception).length;
      const card = document.createElement("article");
      card.className = "panel";
      card.innerHTML = `<p class="eyebrow">${activeViable === result.occurrences.length ? "ALL 6 DATES FIT" : "SOME DATES NEED ATTENTION"}</p><h3>${result.venue.name} · ${activeViable} of 6 dates look good</h3><p>${input.system} · ${patternSummary(input, rule)} · ${result.gmDistance.toFixed(1)} miles away · ${result.players.length} potential Player${result.players.length === 1 ? "" : "s"}</p><div>${result.occurrences.map((item) => occurrenceMarkup(item, result.venue.id)).join("")}</div><div class="next-step"><strong>Like this schedule?</strong><button class="button primary form-series-button" type="button">Continue With These Dates</button><a class="button secondary" href="venues.html">Review Venue Options</a></div>`;
      card.querySelector(".form-series-button")?.addEventListener("click", () => selectSeries(result, input, rule));
      return card;
    } catch (error) {
      logError("Unable to render recurring result", error);
      return document.createElement("article");
    }
  }

  function renderCurrentResults() {
    try {
      const results = document.querySelector("#recurring-match-results");
      if (!results || !currentInput || !currentRule) return;
      results.replaceChildren();
      currentResults.forEach((result) => results.appendChild(renderResult(result, currentInput, currentRule)));
      if (!currentResults.length) results.innerHTML = '<div class="panel empty-state"><h3>No venue fits all of those basics yet.</h3><p>Try another day, a shorter session, or a larger travel range.</p></div>';
    } catch (error) {
      logError("Unable to refresh recurring results", error);
    }
  }

  function applyOccurrenceAction(venueId, key, action) {
    try {
      const result = currentResults.find((item) => item.venue.id === venueId);
      const occurrence = result?.occurrences.find((item) => dateKey(item.date) === key);
      if (!occurrence) throw new Error("That game date could not be found.");
      if (action === "restore") occurrence.exception = null;
      if (action === "skip") occurrence.exception = { action: "skip" };
      if (action === "move") occurrence.exception = { action: "move_requested" };
      renderCurrentResults();
      const verb = action === "restore" ? "Restored" : action === "skip" ? "Skipped" : "Marked to move";
      document.querySelector("#recurring-match-status").textContent = `${verb} ${humanDate(occurrence.date)}. Only this date is affected; the rest of your recurring schedule stays the same.`;
    } catch (error) {
      logError("Unable to update recurring occurrence", error);
      document.querySelector("#recurring-match-status").textContent = error.message || "We couldn’t update that date.";
    }
  }

  async function calculate() {
    try {
      const form = document.querySelector("#recurring-match-form");
      if (form && !form.checkValidity()) {
        form.reportValidity();
        return;
      }
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
      if (!dates.length) {
        status.textContent = "Choose a valid first game date so we can build the schedule.";
        return;
      }
      status.textContent = "Checking Player interest and venue availability for your next six dates…";
      currentInput = input;
      currentRule = rule;
      currentResults = (await Promise.all((window.DDD_VENUES || []).map((venue) => evaluateVenue(venue, input, dates)))).filter(Boolean).sort((a, b) => b.viableCount - a.viableCount);
      renderCurrentResults();
      status.textContent = currentResults.length ? `${currentResults.length} venue option${currentResults.length === 1 ? "" : "s"} found for this recurring schedule.` : "No venue fits this recurring schedule yet. Try adjusting the day, session length, or travel range.";
    } catch (error) {
      logError("Unable to calculate recurring Table Match", error);
      document.querySelector("#recurring-match-status").textContent = "We couldn’t check that recurring schedule. Please try again.";
    }
  }

  function bind() {
    try {
      const form = document.querySelector("#recurring-match-form");
      const pattern = document.querySelector("#series-pattern");
      const day = document.querySelector("#series-day");
      if (!form || !pattern) return;
      const toggle = () => {
        const monthly = pattern.value === "monthly";
        document.querySelector("#week-interval-label").hidden = monthly;
        document.querySelector("#ordinal-label").hidden = !monthly;
        document.querySelector("#month-interval-label").hidden = !monthly;
      };
      pattern.addEventListener("change", toggle);
      day?.addEventListener("change", () => syncAnchorDate(true));
      form.addEventListener("submit", (event) => { event.preventDefault(); calculate(); });
      document.querySelector("#recurring-match-results")?.addEventListener("click", (event) => {
        const button = event.target.closest("[data-series-action]");
        if (!button) return;
        applyOccurrenceAction(button.dataset.venueId, button.dataset.date, button.dataset.seriesAction);
      });
      toggle();
      syncAnchorDate();
    } catch (error) {
      logError("Unable to initialize recurring Table Match", error);
    }
  }

  bind();
})();