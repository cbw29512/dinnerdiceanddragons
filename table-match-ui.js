(() => {
  "use strict";

  const form = document.querySelector("#table-match-form");
  const results = document.querySelector("#table-match-results");
  const status = document.querySelector("#table-match-status");

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function make(tag, text, className) {
    try {
      const element = document.createElement(tag);
      if (text !== undefined && text !== null) element.textContent = String(text);
      if (className) element.className = className;
      return element;
    } catch (error) {
      logError(`Unable to create ${tag}`, error);
      return document.createElement("span");
    }
  }

  function defaultReasons(match) {
    try {
      return [
        "Venue is available for the full session.",
        "Venue is inside the GM travel radius.",
        "Counted Players can attend the full session.",
        "Counted Players are within their own travel radius.",
        `Venue can seat the GM plus ${match.hardFit.playerCapacity} Players.`,
        "Compatible demand is not yet a seat commitment."
      ];
    } catch (error) {
      logError("Unable to build match reasons", error);
      return [];
    }
  }

  function buildCard(match) {
    try {
      const card = make("article", null, "table-match-card");
      const source = match.mode === "shared" ? "SHARED PILOT" : "PROTOTYPE";
      const readiness = match.hardFit.viable ? "VIABLE TO FORM" : "EMERGING";
      const playerCount = Number(match.eligiblePlayerCount || 0);
      const playerText = playerCount > match.hardFit.playerCapacity
        ? `${playerCount} compatible Player signals · ${match.hardFit.playerCapacity} seats available`
        : `${playerCount} compatible Player signal${playerCount === 1 ? "" : "s"}`;

      card.appendChild(make("p", `${source} · POTENTIAL MATCH · ${readiness}`, "eyebrow"));
      card.appendChild(make("div", `${match.score.total}/100`, "match-score"));
      card.appendChild(make("h3", `${match.system} · ${match.day}`));
      const summary = make("p");
      summary.appendChild(make("strong", playerText));
      summary.appendChild(document.createTextNode(` · ${match.venue.name} · ${Number(match.distance).toFixed(1)} miles from GM`));
      card.appendChild(summary);

      const breakdown = make("div", null, "match-breakdown");
      [["Usable Player demand", match.score.demand, 40], ["GM distance", match.score.distance, 25], ["Schedule", match.score.schedule, 25], ["Capacity", match.score.capacity, 10]].forEach(([label, value, max]) => {
        const row = make("span");
        row.appendChild(document.createTextNode(`${label} `));
        row.appendChild(make("b", `${value}/${max}`));
        breakdown.appendChild(row);
      });
      card.appendChild(breakdown);

      const reasons = make("div", null, "match-reasons");
      const reasonTexts = Array.isArray(match.explanations) && match.explanations.length
        ? match.explanations.map((item) => item.summary).filter(Boolean)
        : defaultReasons(match);
      reasonTexts.forEach((reason) => reasons.appendChild(make("p", `✓ ${reason}`)));
      card.appendChild(reasons);

      const action = make("button", match.hardFit.viable ? "Start Forming This Table" : `Need ${match.hardFit.needsPlayers} More Player Signal${match.hardFit.needsPlayers === 1 ? "" : "s"}`, "button primary");
      action.type = "button";
      action.disabled = !match.hardFit.viable;
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
        sourceMode:match.mode || "prototype",
        venueId:match.venue.id,
        venueWindowId:match.venueWindowId || "",
        venueName:match.venue.name,
        venuePostalCode:match.venue.postalCode,
        day:match.day,
        gmStart:match.startText,
        durationMinutes:match.duration,
        radius:match.gmRadius,
        homeZip:match.gmZip,
        policy:match.venue.policy,
        approvalRequired:match.venue.approvalRequired,
        system:match.system,
        eligiblePlayers:Number(match.eligiblePlayerCount || 0),
        usablePlayers:match.hardFit.usablePlayers,
        playerCapacity:match.hardFit.playerCapacity,
        matchScore:match.score.total
      }));
      window.location.href = "create-game.html";
    } catch (error) {
      logError("Unable to start forming table", error);
    }
  }

  function readValues() {
    try {
      const fields = form.elements;
      return {
        system:fields.system.value,
        day:fields.day.value,
        startText:fields.start.value,
        start:window.DDDTableMatch.minutes(fields.start.value),
        duration:Number(fields.duration.value),
        gmZip:fields.gm_zip.value.trim(),
        gmRadius:Number(fields.gm_radius.value)
      };
    } catch (error) {
      logError("Unable to read Table Match fields", error);
      return null;
    }
  }

  function renderMatches(matches) {
    try {
      results.replaceChildren();
      matches.forEach((match) => {
        const card = buildCard(match);
        if (card) results.appendChild(card);
      });
      if (!matches.length) {
        const empty = make("div", null, "panel empty-state");
        empty.appendChild(make("h3", "No three-sided match yet."));
        empty.appendChild(make("p", "Try another system, day, time, or travel radius. The absence of a match is itself useful demand information."));
        results.appendChild(empty);
      }
    } catch (error) {
      logError("Unable to render Table Matches", error);
    }
  }

  async function submitMatch() {
    try {
      if (!form) return;
      const values = readValues();
      if (!values || !/^\d{5}$/.test(values.gmZip) || !values.system || !values.day || !Number.isFinite(values.start)) {
        form.reportValidity();
        return;
      }

      status.textContent = window.DDD_API?.isConfigured() ? "Calculating private shared-pilot overlap…" : "Calculating prototype Player + GM + Venue overlap…";
      const calculation = await window.DDDTableMatchCalculator.calculate(values);
      const matches = calculation.matches || [];
      renderMatches(matches);
      const viableCount = matches.filter((match) => match.hardFit.viable).length;
      const modeText = calculation.mode === "shared" ? "Shared pilot" : calculation.mode === "prototype-fallback" ? "Prototype fallback — shared matcher unavailable" : "Prototype";
      status.textContent = `${modeText}: ${matches.length} potential match${matches.length === 1 ? "" : "es"} found; ${viableCount} viable to form.`;
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
