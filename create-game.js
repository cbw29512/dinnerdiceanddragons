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

      const day = document.querySelector("#game-day");
      const start = document.querySelector("#game-start");
      const duration = document.querySelector("#game-duration");
      const venue = document.querySelector("#game-venue");
      const summary = document.querySelector("#selected-slot");

      if (day) day.value = slot.day || "";
      if (start) start.value = slot.gmStart || "";
      if (duration) duration.value = formatDuration(slot.durationMinutes);
      if (venue) venue.value = slot.venueName || "";

      if (summary) {
        summary.replaceChildren();
        const title = document.createElement("h2");
        title.textContent = slot.venueName || "Selected venue";
        const time = document.createElement("p");
        time.textContent = `${slot.day || ""} · ${slot.gmStart || ""} · ${formatDuration(slot.durationMinutes)}`;
        const policy = document.createElement("p");
        policy.textContent = `Venue policy: ${slot.policy || "See venue terms"}`;
        const approval = document.createElement("p");
        approval.className = "microcopy";
        approval.textContent = slot.approvalRequired ? "Venue approval is required before publication." : "This slot does not require separate venue approval.";
        summary.append(title, time, policy, approval);
      }
    } catch (error) {
      logError("Unable to load selected venue slot", error);
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