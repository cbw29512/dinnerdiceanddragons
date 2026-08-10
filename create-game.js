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

  function updateExpectedGuests() {
    try {
      const seats = document.querySelector("#player-seats");
      const guests = document.querySelector("#expected-guests");
      if (!seats || !guests) return;
      const playerSeats = Number.parseInt(seats.value, 10);
      guests.value = Number.isFinite(playerSeats) ? String(playerSeats + 1) : "";
    } catch (error) {
      logError("Unable to calculate expected guests", error);
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
      if (form?.elements.system && slot.system) form.elements.system.value = slot.system;

      if (summary) {
        summary.replaceChildren();
        const title = document.createElement("h2");
        title.textContent = slot.venueName || "Selected venue";
        const time = document.createElement("p");
        time.textContent = `${slot.system || "RPG"} · ${slot.day || ""} · ${slot.gmStart || ""} · ${formatDuration(slot.durationMinutes)}`;
        const fit = document.createElement("p");
        fit.innerHTML = `<strong>${slot.matchScore || "—"}% Table Match</strong> · ${slot.eligiblePlayers || 0} compatible Player signal${slot.eligiblePlayers === 1 ? "" : "s"}`;
        const policy = document.createElement("p");
        policy.textContent = `Venue policy: ${slot.policy || "See venue terms"}`;
        const approval = document.createElement("p");
        approval.className = "microcopy";
        approval.textContent = slot.approvalRequired ? "This table is now Forming; venue approval and Player commitments are still required before confirmation." : "This table is now Forming; Player commitments are still required before confirmation.";
        summary.append(title, time, fit, policy, approval);
      }
    } catch (error) {
      logError("Unable to load selected Table Match", error);
    }
  }

  function bindControls() {
    try {
      const seats = document.querySelector("#player-seats");
      const recurrence = document.querySelector("#game-recurrence");
      if (seats) seats.addEventListener("change", updateExpectedGuests);
      if (recurrence) recurrence.addEventListener("change", updateRecurrenceDefaults);
      updateExpectedGuests();
      updateRecurrenceDefaults();
    } catch (error) {
      logError("Unable to initialize game creation controls", error);
    }
  }

  bindSelection();
  bindControls();
})();