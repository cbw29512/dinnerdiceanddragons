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
        "Venue is available for the full game night.",
        "Venue is inside your travel range.",
        "Interested Players can make the full game time.",
        "Interested Players are within their own travel ranges.",
        `Venue can seat you plus ${match.hardFit.playerCapacity} Players.`,
        "Player interest is not counted as a confirmed seat until someone actually joins."
      ];
    } catch (error) {
      logError("Unable to build match reasons", error);
      return [];
    }
  }

  function buildCard(match) {
    try {
      const card = make("article", null, "table-match-card");
      const source = match.mode === "shared" ? "LOCAL MATCH" : "SAMPLE MATCH";
      const readiness = match.hardFit.viable ? "READY TO FORM" : "NEEDS MORE PLAYERS";
      const playerCount = Number(match.eligiblePlayerCount || 0);
      const playerText = playerCount > match.hardFit.playerCapacity
        ? `${playerCount} potential Players · ${match.hardFit.playerCapacity} seats available`
        : `${playerCount} potential Player${playerCount === 1 ? "" : "s"}`;

      card.appendChild(make("p", `${source} · ${readiness}`, "eyebrow"));
      card.appendChild(make("div", `${match.score.total}/100`, "match-score"));
      card.appendChild(make("h3", `${match.system} · ${match.day}`));
      const summary = make("p");
      summary.appendChild(make("strong", playerText));
      summary.appendChild(document.createTextNode(` · ${match.venue.name} · ${Number(match.distance).toFixed(1)} miles from you`));
      card.appendChild(summary);

      const breakdown = make("div", null, "match-breakdown");
      [["Player fit", match.score.demand, 40], ["Travel", match.score.distance, 25], ["Schedule", match.score.schedule, 25], ["Capacity", match.score.capacity, 10]].forEach(([label, value, max]) => {
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

      const action = make("button", match.hardFit.viable ? "Start Forming This Table" : `Needs ${match.hardFit.needsPlayers} More Interested Player${match.hardFit.needsPlayers === 1 ? "" : "s"}`, "button primary");
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
        empty.appendChild(make("h3", "No match for that game night yet."));
        empty.appendChild(make("p", "Try another day, time, game, or travel range. You can also save what you want to run so future Player interest can line up with it."));
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

      status.textContent = "Checking Player interest, your schedule, travel distance, and venue availability…";
      const calculation = await window.DDDTableMatchCalculator.calculate(values);
      const matches = calculation.matches || [];
      renderMatches(matches);
      const viableCount = matches.filter((match) => match.hardFit.viable).length;
      const sourceText = calculation.mode === "shared" ? "Local results" : calculation.mode === "prototype-fallback" ? "Sample results — online matching unavailable" : "Sample results";
      status.textContent = `${sourceText}: ${matches.length} option${matches.length === 1 ? "" : "s"} found; ${viableCount} ready to form.`;
      localStorage.setItem("ddd-home-zip", values.gmZip);
      localStorage.setItem("ddd-travel-radius", String(values.gmRadius));
    } catch (error) {
      logError("Unable to submit Table Match", error);
      if (status) status.textContent = "We couldn’t calculate matches right now. Please try again.";
    }
  }

  function initialize() {
    try {
      window.DDDTableMatchProfile?.renderDemandSnapshot(document.querySelector("#demand-snapshot"));
      const loadedSavedDm = window.DDDTableMatchProfile?.prefill(form, document.querySelector("#saved-gm-status"));
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        await submitMatch();
      });
      if (loadedSavedDm) submitMatch();
    } catch (error) {
      logError("Unable to initialize Table Match UI", error);
    }
  }

  initialize();
})();