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
      return (venue.windows || []).filter((w) => w.day === day && window.DDDTableMatch.minutes(w.start) <= start && window.DDDTableMatch.minutes(w.end) >= end);
    } catch (error) {
      logError(`Unable to inspect ${venue.name} windows`, error);
      return [];
    }
  }

  function buildCard(match) {
    try {
      const card = document.createElement("article");
      card.className = "table-match-card";
      const readiness = match.players.length >= window.DDDTableMatch.MIN_DEMAND ? "VIABLE TABLE MATCH" : "EMERGING MATCH";
      card.innerHTML = `<p class="eyebrow">${readiness}</p><div class="match-score">${match.score.total}%</div><h3>${match.system} · ${match.day}</h3><p><strong>${match.players.length} compatible Players</strong> · ${match.venue.name} · ${match.distance.toFixed(1)} miles from GM</p><div class="match-breakdown"><span>Player demand <b>${match.score.demand}/40</b></span><span>GM distance <b>${match.score.distance}/25</b></span><span>Schedule <b>${match.score.schedule}/25</b></span><span>Capacity <b>${match.score.capacity}/10</b></span></div><div class="match-reasons"><p>✓ GM can run the full session</p><p>✓ Venue is available for the full session</p><p>✓ Venue is inside GM travel radius</p><p>✓ Every counted Player can attend the full session</p><p>✓ Every counted Player is within their own travel radius of this venue</p></div>`;
      const action = document.createElement("button");
      action.className = "button primary";
      action.type = "button";
      action.disabled = match.players.length < window.DDDTableMatch.MIN_DEMAND;
      action.textContent = action.disabled ? `Need ${window.DDDTableMatch.MIN_DEMAND - match.players.length} More Player Signal${window.DDDTableMatch.MIN_DEMAND - match.players.length === 1 ? "" : "s"}` : "Start Forming This Table";
      action.addEventListener("click", () => {
        try {
          localStorage.setItem("ddd-selected-venue-slot", JSON.stringify({
            venueId: match.venue.id, venueName: match.venue.name, venuePostalCode: match.venue.postalCode,
            day: match.day, gmStart: match.startText, durationMinutes: match.duration,
            radius: match.gmRadius, homeZip: match.gmZip, policy: match.venue.policy,
            approvalRequired: match.venue.approvalRequired, system: match.system,
            eligiblePlayers: match.players.length, matchScore: match.score.total
          }));
          window.location.href = "create-game.html";
        } catch (error) {
          logError("Unable to start forming table", error);
        }
      });
      card.appendChild(action);
      return card;
    } catch (error) {
      logError("Unable to build Table Match card", error);
      return null;
    }
  }

  async function calculate(values) {
    try {
      const gmPoint = await window.DDDGeo.lookupZip(values.gmZip);
      const end = values.start + values.duration;
      const matches = [];
      for (const venue of window.DDD_VENUES || []) {
        const windows = venueWindows(venue, values.day, values.start, end);
        if (!windows.length) continue;
        const venuePoint = await window.DDDGeo.lookupZip(venue.postalCode);
        const distance = window.DDDGeo.distanceMiles(gmPoint, venuePoint);
        if (!Number.isFinite(distance) || distance > values.gmRadius) continue;
        const players = await window.DDDTableMatch.eligiblePlayers(values.system, values.day, values.start, end, venue.postalCode);
        if (!players.length) continue;
        const seats = Math.max(...windows.map((w) => w.seatsPerTable || 0));
        matches.push({ ...values, venue, players, distance, score: window.DDDTableMatch.scoreMatch(players.length, distance, values.gmRadius, seats) });
      }
      return matches.sort((a, b) => b.score.total - a.score.total);
    } catch (error) {
      logError("Unable to calculate Table Matches", error);
      return [];
    }
  }

  function prefill() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("system")) form.elements.system.value = q.get("system");
      if (q.get("day")) form.elements.day.value = q.get("day");
      if (q.get("start")) form.elements.start.value = q.get("start");
      form.elements.gm_zip.value = localStorage.getItem("ddd-home-zip") || "29501";
      form.elements.gm_radius.value = localStorage.getItem("ddd-travel-radius") || "25";
    } catch (error) { logError("Unable to prefill Table Match", error); }
  }

  form?.addEventListener("submit", async (event) => {
    try {
      event.preventDefault();
      const v = form.elements;
      const values = { system: v.system.value, day: v.day.value, startText: v.start.value, start: window.DDDTableMatch.minutes(v.start.value), duration: Number(v.duration.value), gmZip: v.gm_zip.value.trim(), gmRadius: Number(v.gm_radius.value) };
      if (!/^\d{5}$/.test(values.gmZip) || !values.system || !values.day || !Number.isFinite(values.start)) return form.reportValidity();
      status.textContent = "Calculating Player + GM + Venue overlap…";
      const matches = await calculate(values);
      results.replaceChildren();
      matches.forEach((match) => { const card = buildCard(match); if (card) results.appendChild(card); });
      if (!matches.length) results.innerHTML = "<div class='panel empty-state'><h3>No three-sided match yet.</h3><p>Try another system, day, time, or travel radius. The absence of a match is itself useful demand information.</p></div>";
      status.textContent = `${matches.length} potential Table Match${matches.length === 1 ? "" : "es"} found.`;
      localStorage.setItem("ddd-home-zip", values.gmZip); localStorage.setItem("ddd-travel-radius", String(values.gmRadius));
    } catch (error) { logError("Unable to submit Table Match", error); status.textContent = "Unable to calculate matches right now."; }
  });

  prefill();
})();
