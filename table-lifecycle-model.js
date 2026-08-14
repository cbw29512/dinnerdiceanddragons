(() => {
  "use strict";

  const STORAGE_KEY = "ddd-lifecycle-demo";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function defaultState() {
    try {
      return {
        title: "Shadows Over Florence",
        system: "D&D 5e",
        venue: "Partner Venue",
        day: "Tuesday",
        start: "18:00",
        minPlayers: 3,
        maxPlayers: 5,
        candidatePlayers: 0,
        usablePlayerDemand: 0,
        venuePlayerCapacity: 5,
        matchScore: 0,
        confirmedPlayers: 0,
        waitlistedPlayers: 0,
        venueApproved: false,
        gmAvailable: true,
        status: "forming",
        completed: false
      };
    } catch (error) {
      logError("Unable to create default lifecycle state", error);
      return {};
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaultState(), ...JSON.parse(raw) } : defaultState();
    } catch (error) {
      logError("Unable to load lifecycle state", error);
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      logError("Unable to save lifecycle state", error);
    }
  }

  function resetState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return defaultState();
    } catch (error) {
      logError("Unable to reset lifecycle state", error);
      return defaultState();
    }
  }

  function deriveStatus(state) {
    try {
      if (state.completed) return "completed";
      if (!state.gmAvailable) return "cancelled";
      if (state.venueApproved && state.confirmedPlayers >= state.minPlayers) return "confirmed";
      return "forming";
    } catch (error) {
      logError("Unable to derive table status", error);
      return "forming";
    }
  }

  function humanTime(value) {
    try {
      const [hoursText, minutes = "00"] = String(value || "").split(":");
      const hours = Number(hoursText);
      if (!Number.isFinite(hours)) return value || "";
      return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
    } catch (error) {
      logError("Unable to format lifecycle time", error);
      return value || "";
    }
  }

  function noticeLabel(value) {
    try {
      const labels = {
        early: "more than 24 hours notice",
        late: "less than 24 hours notice",
        same_day: "same-day / very late notice",
        no_show: "no notice / no-show"
      };
      return labels[value] || "notice recorded";
    } catch (error) {
      logError("Unable to label cancellation notice", error);
      return "notice recorded";
    }
  }

  function reputationEffect(value) {
    try {
      if (value === "early") return "No negative reputation event by default.";
      if (value === "late" || value === "same_day") return "Logged as a late-cancellation reliability event; isolated events should not create a public caution.";
      if (value === "no_show") return "Logged separately as a no-show; repeated verified no-shows may affect reliability.";
      return "No automatic reputation effect.";
    } catch (error) {
      logError("Unable to describe reputation effect", error);
      return "No automatic reputation effect.";
    }
  }

  window.DDDLifecycleModel = {
    STORAGE_KEY,
    defaultState,
    loadState,
    saveState,
    resetState,
    deriveStatus,
    humanTime,
    noticeLabel,
    reputationEffect
  };
})();
