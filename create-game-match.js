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
      logError("Unable to format selected match duration", error);
      return "";
    }
  }

  function setSystem(form, system) {
    try {
      if (!form?.elements.system || !system) return;
      if (system === "D&D 5e") {
        form.elements.system.value = "";
        return;
      }
      form.elements.system.value = system === "Call of Cthulhu" ? "Call of Cthulhu 7e" : system;
    } catch (error) {
      logError("Unable to apply matched RPG system", error);
    }
  }

  function constrainSeats(slot) {
    try {
      const select = document.querySelector("#player-seats");
      const capacity = Number(slot.playerCapacity);
      if (!select || !Number.isFinite(capacity)) return;
      [...select.options].forEach((option) => { option.disabled = Number(option.value) > capacity; });
      const best = [...select.options].map((option) => Number(option.value)).filter((value) => Number.isFinite(value) && value <= capacity).sort((a, b) => b - a)[0];
      if (Number.isFinite(best)) select.value = String(best);
    } catch (error) {
      logError("Unable to constrain Player seats to venue capacity", error);
    }
  }

  function renderSummary(slot) {
    try {
      const summary = document.querySelector("#selected-slot");
      if (!summary) return;
      summary.replaceChildren();
      const title = document.createElement("h2");
      title.textContent = slot.venueName || "Selected venue";
      const time = document.createElement("p");
      time.textContent = `${slot.system || "RPG"} · ${slot.day || ""} · ${slot.gmStart || ""} · ${formatDuration(slot.durationMinutes)}`;
      const usable = Number(slot.usablePlayers) || Number(slot.eligiblePlayers) || 0;
      const fit = document.createElement("p");
      const fitStrong = document.createElement("strong");
      fitStrong.textContent = `${slot.matchScore || "—"}/100 explained fit`;
      fit.append(fitStrong, document.createTextNode(` · ${slot.eligiblePlayers || 0} compatible Player signals · ${usable} fit current table capacity`));
      const capacity = document.createElement("p");
      capacity.textContent = `Venue table capacity: GM + ${slot.playerCapacity || "?"} Players. Larger Player-count options are disabled.`;
      const trust = document.createElement("p");
      trust.textContent = slot.sourceMode === "shared" ? (slot.venueVerified ? "Shared pilot venue: verified." : "Shared pilot venue: not verified yet.") : "Prototype venue data.";
      const policy = document.createElement("p");
      policy.textContent = `Venue policy: ${slot.policy || "See venue terms"}`;
      const approval = document.createElement("p");
      approval.className = "microcopy";
      approval.textContent = `${slot.approvalRequired ? "Venue approval is required. " : "This venue window does not require separate booking approval. "}${slot.system === "D&D 5e" ? "Choose the D&D edition below. " : ""}Player commitments are still required before confirmation.`;
      summary.append(title, time, fit, capacity, trust, policy, approval);
    } catch (error) {
      logError("Unable to render selected Table Match", error);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem("ddd-selected-venue-slot");
      if (!raw) return null;
      const slot = JSON.parse(raw);
      const form = document.querySelector("#game-form");
      const day = document.querySelector("#game-day");
      const start = document.querySelector("#game-start");
      const duration = document.querySelector("#game-duration");
      const venue = document.querySelector("#game-venue");
      if (day) day.value = slot.day || "";
      if (start) start.value = slot.gmStart || "";
      if (duration) duration.value = formatDuration(slot.durationMinutes);
      if (venue) venue.value = slot.venueName || "";
      setSystem(form, slot.system);
      constrainSeats(slot);
      renderSummary(slot);
      return slot;
    } catch (error) {
      logError("Unable to load selected Table Match", error);
      return null;
    }
  }

  window.DDDCreateGameMatch = { load };
})();
