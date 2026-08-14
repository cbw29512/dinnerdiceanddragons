(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function formatDuration(minutes) {
    try {
      const hours = Number(minutes) / 60;
      return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
    } catch (error) {
      logError("Unable to format duration", error);
      return "";
    }
  }

  function readInt(selector) {
    try {
      const node = document.querySelector(selector);
      return node ? Number.parseInt(node.value, 10) : Number.NaN;
    } catch (error) {
      logError(`Unable to read integer from ${selector}`, error);
      return Number.NaN;
    }
  }

  function setSelectIfAvailable(selector, value) {
    try {
      const select = document.querySelector(selector);
      if (!select || !Number.isFinite(Number(value))) return;
      const desired = String(value);
      if ([...select.options].some((option) => option.value === desired && !option.disabled)) select.value = desired;
    } catch (error) {
      logError(`Unable to set ${selector}`, error);
    }
  }

  function updateCommitmentSummary() {
    try {
      const seats = document.querySelector("#player-seats");
      const minimum = document.querySelector("#min-players");
      const guests = document.querySelector("#expected-guests");
      const rule = document.querySelector("#confirmation-rule");
      if (!seats || !minimum || !guests || !rule) return;

      const maxPlayers = Number.parseInt(seats.value, 10);
      let minPlayers = Number.parseInt(minimum.value, 10);
      if (!Number.isFinite(maxPlayers) || !Number.isFinite(minPlayers)) return;

      [...minimum.options].forEach((option) => {
        option.disabled = Number(option.value) > maxPlayers;
      });
      if (minPlayers > maxPlayers) {
        minPlayers = maxPlayers;
        minimum.value = String(maxPlayers);
      }

      guests.value = String(maxPlayers + 1);
      rule.value = `Venue approval + ${minPlayers} confirmed Player${minPlayers === 1 ? "" : "s"}`;
    } catch (error) {
      logError("Unable to update commitment summary", error);
    }
  }

  function updateRecurrenceDefaults() {
    try {
      const recurrence = document.querySelector("#game-recurrence");
      const sessions = document.querySelector("#expected-sessions");
      if (!recurrence || !sessions) return;
      if (recurrence.value === "one_time") sessions.value = "1";
      else if (Number.parseInt(sessions.value, 10) <= 1) sessions.value = "8";
    } catch (error) {
      logError("Unable to update recurrence defaults", error);
    }
  }

  function setSystemFromMatch(form, system) {
    try {
      if (!form?.elements.system || !system) return;
      if (system === "D&D 5e") {
        form.elements.system.value = "";
        form.elements.system.focus();
        return;
      }
      if (system === "Call of Cthulhu") {
        form.elements.system.value = "Call of Cthulhu 7e";
        return;
      }
      form.elements.system.value = system;
    } catch (error) {
      logError("Unable to apply matched RPG system", error);
    }
  }

  function applyCapacityDefaults(slot) {
    try {
      const seatSelect = document.querySelector("#player-seats");
      const capacity = Number(slot.playerCapacity);
      if (seatSelect && Number.isFinite(capacity)) {
        [...seatSelect.options].forEach((option) => {
          option.disabled = Number(option.value) > capacity;
        });
        const usableChoice = [...seatSelect.options]
          .map((option) => Number(option.value))
          .filter((value) => Number.isFinite(value) && value <= capacity)
          .sort((a, b) => b - a)[0];
        if (Number.isFinite(usableChoice)) seatSelect.value = String(usableChoice);
      }

      const usablePlayers = Number(slot.usablePlayers);
      if (Number.isFinite(usablePlayers) && usablePlayers >= 2) setSelectIfAvailable("#min-players", Math.min(3, usablePlayers));
      updateCommitmentSummary();
    } catch (error) {
      logError("Unable to apply matched capacity defaults", error);
    }
  }

  function bindSelection() {
    try {
      const raw = localStorage.getItem("ddd-selected-venue-slot");
      if (!raw) return;
      const slot = JSON.parse(raw);
      const form = document.querySelector("#game-form");
      const day = document.querySelector("#game-day");
      const start = document.querySelector("#game-start");
      const duration = document.querySelector("#game-duration");
      const venue = document.querySelector("#game-venue");
      const summary = document.querySelector("#selected-slot");

      if (day) day.value = slot.day || "";
      if (start) start.value = slot.gmStart || "";
      if (duration) duration.value = formatDuration(slot.durationMinutes);
      if (venue) venue.value = slot.venueName || "";
      setSystemFromMatch(form, slot.system);
      applyCapacityDefaults(slot);

      if (summary) {
        summary.replaceChildren();
        const title = document.createElement("h2");
        title.textContent = slot.venueName || "Selected venue";
        const time = document.createElement("p");
        time.textContent = `${slot.system || "RPG"} · ${slot.day || ""} · ${slot.gmStart || ""} · ${formatDuration(slot.durationMinutes)}`;
        const fit = document.createElement("p");
        const usable = Number(slot.usablePlayers) || Number(slot.eligiblePlayers) || 0;
        fit.innerHTML = `<strong>${slot.matchScore || "—"}/100 fit</strong> · ${slot.eligiblePlayers || 0} potential Player${slot.eligiblePlayers === 1 ? "" : "s"} match this game night · ${usable} fit the current table capacity`;
        const capacity = document.createElement("p");
        capacity.textContent = `Venue table capacity: you + ${slot.playerCapacity || "?"} Players. Larger Player-count options are disabled automatically.`;
        const policy = document.createElement("p");
        policy.textContent = `Venue policy: ${slot.policy || "See venue terms"}`;
        const approval = document.createElement("p");
        approval.className = "microcopy";
        approval.textContent = slot.system === "D&D 5e" ? "Choose the D&D edition below. The table stays Forming until the venue approves and enough Players commit." : "The table stays Forming until the venue approves and enough Players commit.";
        summary.append(title, time, fit, capacity, policy, approval);
      }
    } catch (error) {
      logError("Unable to load selected Table Match", error);
    }
  }

  function revealNextStep() {
    try {
      const next = document.querySelector("#game-next-step");
      if (next) next.hidden = false;
    } catch (error) {
      logError("Unable to reveal game next step", error);
    }
  }

  function bindLifecycleSeed() {
    try {
      const form = document.querySelector("#game-form");
      if (!form) return;
      form.addEventListener("ddd:save-success", () => {
        try {
          const minPlayers = readInt("#min-players");
          const maxPlayers = readInt("#player-seats");
          if (!Number.isFinite(minPlayers) || !Number.isFinite(maxPlayers) || minPlayers > maxPlayers) return;
          const rawMatch = localStorage.getItem("ddd-selected-venue-slot");
          const match = rawMatch ? JSON.parse(rawMatch) : {};
          const venueCapacity = Number(match.playerCapacity) || maxPlayers;
          if (maxPlayers > venueCapacity) {
            logError("Player seat selection exceeds matched venue capacity", { maxPlayers, venueCapacity });
            return;
          }
          const lifecycle = {
            title: form.elements.title?.value || "Forming Table",
            system: form.elements.system?.value || match.system || "RPG",
            venue: form.elements.venue?.value || match.venueName || "Partner Venue",
            venueId: match.venueId || "",
            day: form.elements.day?.value || match.day || "",
            start: form.elements.start_time?.value || match.gmStart || "",
            minPlayers,
            maxPlayers,
            candidatePlayers: Number(match.eligiblePlayers) || 0,
            usablePlayerDemand: Number(match.usablePlayers) || 0,
            venuePlayerCapacity: venueCapacity,
            matchScore: Number(match.matchScore) || 0,
            confirmedPlayers: 0,
            waitlistedPlayers: 0,
            venueApproved: false,
            status: "forming",
            completed: false
          };
          localStorage.setItem("ddd-lifecycle-demo", JSON.stringify(lifecycle));
          revealNextStep();
        } catch (error) {
          logError("Unable to seed table lifecycle demo", error);
        }
      });
    } catch (error) {
      logError("Unable to bind lifecycle seed", error);
    }
  }

  function bindControls() {
    try {
      const seats = document.querySelector("#player-seats");
      const minimum = document.querySelector("#min-players");
      const recurrence = document.querySelector("#game-recurrence");
      if (seats) seats.addEventListener("change", updateCommitmentSummary);
      if (minimum) minimum.addEventListener("change", updateCommitmentSummary);
      if (recurrence) recurrence.addEventListener("change", updateRecurrenceDefaults);
      updateCommitmentSummary();
      updateRecurrenceDefaults();
    } catch (error) {
      logError("Unable to initialize game creation controls", error);
    }
  }

  try {
    bindSelection();
    bindControls();
    bindLifecycleSeed();
  } catch (error) {
    logError("Unable to initialize game creation", error);
  }
})();