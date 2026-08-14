(() => {
  "use strict";

  const form = document.querySelector("#table-match-form");
  const results = document.querySelector("#table-match-results");
  const status = document.querySelector("#table-match-status");

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function venueWindows(venue, day, start, end) {
    try {
      return (venue.windows || []).filter((slot) => slot.day === day && window.DDDTableMatch.minutes(slot.start) <= start && window.DDDTableMatch.minutes(slot.end) >= end);
    } catch (error) {
      logError(`Unable to inspect ${venue.name} windows`, error);
      return [];
    }
  }

  function buildCard(match) {
    try {
      const card = document.createElement("article");
      card.className = "table-match-card";
      const readiness = match.hardFit.viable ? "VIABLE TABLE MATCH" : "EMERGING MATCH";
      const playerText = match.players.length > match.hardFit.playerCapacity
        ? `${match.players.length} compatible Player signals · ${match.hardFit.playerCapacity} seats available`
        : `${match.players.length} compatible Player signal${match.players.length === 1 ? "" : "s"}`;
      card.innerHTML = `<p class="eyebrow">${readiness}</p><div class="match-score">${match.score.total}/100</div><h3>${match.system} · ${match.day}</h3><p><strong>${playerText}</strong> · ${match.venue.name} · ${match.distance.toFixed(1)} miles from GM</p><div class="match-breakdown"><span>Usable Player demand <b>${match.score.demand}/40</b></span><span>GM distance <b>${match.score.distance}/25</b></span><span>Schedule <b>${match.score.schedule}/25</b></span><span>Capacity <b>${match.score.capacity}/10</b></span></div><div class="match-reasons"><p>✓ Venue is available for the full session</p><p>✓ Venue is inside GM travel radius</p><p>✓ Counted Players can attend the full session</p><p>✓ Counted Players are within their own travel radius</p><p>✓ Venue can seat the GM plus ${match.hardFit.playerCapacity} Player${match.hardFit.playerCapacity === 1 ? "" : "s"}</p></div>`;

      const action = document.createElement("button");
      action.className = "button primary";
      action.type = "button";
      action.disabled = !match.hardFit.viable;
      action.textContent = action.disabled ? `Need ${match.hardFit.needsPlayers} More Player Signal${match.hardFit.needsPlayers === 1 ? "" : "s"}` : "Start Forming This Table";
      action.addEventListener("click", () => selectMatch(match));
      card.appendChild(action);
      return card;
    } catch (error) {
      logError("Unable to build Table Match card", error);
      return null;
    }
  }

  function selectMatch(match) {
    try {
      localStorage.setItem("ddd-selected-venue-slot", JSON.stringify({
        venueId: match.venue.id,
        venueName: match.venue.name,
        venuePostalCode: match.venue.postalCode,
        day: match.day,
        gmStart: match.startText,
        durationMinutes: match.duration,
        radius: match.gmRadius,
        homeZip: match.gmZip,
        policy: match.venue.policy,
        approvalRequired: match.venue.approvalRequired,
        system: match.system,
        eligiblePlayers: match.players.length,
        usablePlayers: match.hardFit.usablePlayers,
        playerCapacity: match.hardFit.playerCapacity,
        matchScore: match.score.total
      }));
      window.location.href = "create-game.html";
    } catch (error) {
      logError("Unable to start forming table", error);
    }
  }

  async function calculate(values) {
    try {
      const gmPoint = await window.DDDGeo.lookupZip(values.gmZip);
      const end = values.start + values.duration;
      const matches = [];
      for (const venue of window.DDD_VENUES || []) {
        try {
          const windows = venueWindows(venue, values.day, values.start, end);
          if (!windows.length) continue;
          const venuePoint = await window.DDDGeo.lookupZip(venue.postalCode);
          const distance = window.DDDGeo.distanceMiles(gmPoint, venuePoint);
          if (!Number.isFinite(distance) || distance > values.gmRadius) continue;
          const players = await window.DDDTableMatch.eligiblePlayers(values.system, values.day, values.start, end, venue.postalCode);
          if (!players.length) continue;
          const seatsPerTable = Math.max(...windows.map((slot) => slot.seatsPerTable || 0));
          const hardFit = window.DDDTableMatch.hardFit(players.length, seatsPerTable);
          const score = window.DDDTableMatch.scoreMatch(hardFit.usablePlayers, distance, values.gmRadius, seatsPerTable);
          matches.push({ ...values, venue, players, distance, seatsPerTable, hardFit, score });
        } catch (error) {
          logError(`Unable to evaluate venue ${venue.name || venue.id || "venue"}`, error);
        }
      }
      return matches.sort((a, b) => Number(b.hardFit.viable) - Number(a.hardFit.viable) || b.score.total - a.score.total);
    } catch (error) {
      logError("Unable to calculate Table Matches", error);
      return [];
    }
  }

  async function submitMatch() {
    try {
      if (!form) return;
      const fields = form.elements;
      const values = {
        system: fields.system.value,
        day: fields.day.value,
        startText: fields.start.value,
        start: window.DDDTableMatch.minutes(fields.start.value),
        duration: Number(fields.duration.value),
        gmZip: fields.gm_zip.value.trim(),
        gmRadius: Number(fields.gm_radius.value)
      };
      if (!/^\d{5}$/.test(values.gmZip) || !values.system || !values.day || !Number.isFinite(values.start)) {
        form.reportValidity();
        return;
      }

      status.textContent = "Calculating Player + GM + Venue overlap…";
      const matches = await calculate(values);
      results.replaceChildren();
      matches.forEach((match) => {
        const card = buildCard(match);
        if (card) results.appendChild(card);
      });
      if (!matches.length) results.innerHTML = "<div class='panel empty-state'><h3>No three-sided match yet.</h3><p>Try another system, day, time, or travel radius. The absence of a match is itself useful demand information.</p></div>";
      const viableCount = matches.filter((match) => match.hardFit.viable).length;
      status.textContent = `${matches.length} potential match${matches.length === 1 ? "" : "es"} found; ${viableCount} can form now.`;
      localStorage.setItem("ddd-home-zip", values.gmZip);
      localStorage.setItem("ddd-travel-radius", String(values.gmRadius));
    } catch (error) {
      logError("Unable to submit Table Match", error);
      if (status) status.textContent = "Unable to calculate matches right now.";
    }
  }

  function initialize() {
    try {
      window.DDDTableMatchProfile?.renderDemandSnapshot(document.querySelector("#demand-snapshot"));
      const loadedSavedGm = window.DDDTableMatchProfile?.prefill(form, document.querySelector("#saved-gm-status"));
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await submitMatch();
      });
      if (loadedSavedGm) submitMatch();
    } catch (error) {
      logError("Unable to initialize Table Match UI", error);
    }
  }

  initialize();
})();
