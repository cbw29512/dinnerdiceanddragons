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

  bindSelection();
})();
