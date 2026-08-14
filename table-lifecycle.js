(() => {
  "use strict";

  const STORAGE_KEY = "ddd-lifecycle-demo";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function defaultState() {
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

  function node(id) {
    try {
      return document.getElementById(id);
    } catch (error) {
      logError(`Unable to find ${id}`, error);
      return null;
    }
  }

  function setText(id, value) {
    try {
      const target = node(id);
      if (target) target.textContent = value;
    } catch (error) {
      logError(`Unable to update ${id}`, error);
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

  function renderRequirements(state) {
    try {
      const list = node("requirements-list");
      if (!list) return;
      list.replaceChildren();
      [
        { met: state.venueApproved, text: "Venue approval" },
        { met: state.gmAvailable, text: "GM available" },
        { met: state.confirmedPlayers >= state.minPlayers, text: `${state.minPlayers} minimum confirmed Players` },
        { met: state.confirmedPlayers <= state.maxPlayers, text: `${state.maxPlayers} maximum confirmed Player seats` }
      ].forEach((requirement) => {
        const li = document.createElement("li");
        li.textContent = `${requirement.met ? "✓" : "○"} ${requirement.text}`;
        list.appendChild(li);
      });
    } catch (error) {
      logError("Unable to render lifecycle requirements", error);
    }
  }

  function renderExplanation(state) {
    try {
      const box = node("state-explanation");
      if (!box) return;
      box.replaceChildren();
      const strong = document.createElement("strong");
      const paragraph = document.createElement("p");
      if (state.status === "completed") {
        strong.textContent = "Completed";
        paragraph.textContent = "The session happened. Attendance can now be recorded and eligible feedback can create verified reputation evidence.";
      } else if (state.status === "cancelled") {
        strong.textContent = "Cancelled";
        paragraph.textContent = "The GM is unavailable, so this session cannot remain Confirmed. Players and venue should be notified immediately; recurring future sessions remain separate unless explicitly cancelled.";
      } else if (state.status === "confirmed") {
        strong.textContent = "Confirmed";
        paragraph.textContent = "GM, venue, and minimum Player commitment are all satisfied. The Game Hub is now available for coordination.";
      } else {
        strong.textContent = "Forming";
        const missing = [];
        if (!state.venueApproved) missing.push("venue approval");
        if (!state.gmAvailable) missing.push("GM availability");
        if (state.confirmedPlayers < state.minPlayers) missing.push(`${state.minPlayers - state.confirmedPlayers} more Player commitment${state.minPlayers - state.confirmedPlayers === 1 ? "" : "s"}`);
        paragraph.textContent = `Still waiting for ${missing.join(" and ")}. Matching demand shows who could fit; only explicit seat commitments count toward confirmation.`;
      }
      box.append(strong, paragraph);
    } catch (error) {
      logError("Unable to render lifecycle explanation", error);
    }
  }

  function renderReputationGate(state) {
    try {
      const box = node("reputation-gate");
      if (!box) return;
      box.replaceChildren();
      const strong = document.createElement("strong");
      const paragraph = document.createElement("p");
      if (state.completed) {
        strong.textContent = "Eligible after attendance";
        paragraph.textContent = "Verified attendance, hosting, and eligible post-game feedback may now enter the Reputation Ledger.";
      } else if (state.status === "cancelled") {
        strong.textContent = "No play reputation unlocked";
        paragraph.textContent = "A cancelled session does not create played-session reputation. Only the cancellation timing/classification may create a reliability event under policy.";
      } else {
        strong.textContent = "Locked";
        paragraph.textContent = "No played-session reputation can be earned from an unplayed table.";
      }
      box.append(strong, paragraph);
    } catch (error) {
      logError("Unable to render reputation gate", error);
    }
  }

  function renderHubGate(state) {
    try {
      const button = node("game-hub-link");
      const label = node("hub-gate-label");
      if (!button) return;
      const unlocked = state.status === "confirmed" || state.status === "completed";
      button.disabled = !unlocked;
      if (label) label.textContent = unlocked ? "Confirmed — coordination is unlocked." : "Game Hub unlocks when Confirmed.";
    } catch (error) {
      logError("Unable to render Game Hub gate", error);
    }
  }

  function renderMatchOrigin(state) {
    try {
      const candidateCount = Number(state.candidatePlayers) || 0;
      const usableCount = Number(state.usablePlayerDemand) || 0;
      const capacity = Number(state.venuePlayerCapacity) || state.maxPlayers;
      if (!candidateCount) {
        setText("match-origin", "This table was not seeded from a saved Table Match. Commitments below still control confirmation.");
        return;
      }
      setText("match-origin", `Started from an explained Table Match with ${candidateCount} compatible Player signal${candidateCount === 1 ? "" : "s"}; ${usableCount} fit the selected table capacity of ${capacity} Players. Demand is not counted as commitment.`);
    } catch (error) {
      logError("Unable to render Table Match origin", error);
    }
  }

  function render(state) {
    try {
      state.status = deriveStatus(state);
      saveState(state);
      setText("lifecycle-title", state.title);
      setText("lifecycle-meta", `${state.system} · ${state.venue} · ${state.day} ${humanTime(state.start)}`);
      setText("confirmed-count", String(state.confirmedPlayers));
      setText("waitlist-count", String(state.waitlistedPlayers));
      setText("venue-state", state.venueApproved ? "Approved" : "Pending");
      setText("table-state", state.status[0].toUpperCase() + state.status.slice(1));
      setText("lifecycle-state-label", `${state.status.toUpperCase()} TABLE`);
      setText("hero-venue", state.venueApproved ? "Yes" : "No");
      setText("hero-gm", state.gmAvailable ? "Yes" : "No");
      setText("hero-players", `${state.confirmedPlayers} / ${state.minPlayers} minimum`);
      setText("hero-status", state.status.toUpperCase());
      setText("hero-reason", state.status === "completed" ? "Session completed" : state.status === "cancelled" ? "GM cancelled session" : state.status === "confirmed" ? "All requirements satisfied" : "Waiting for required commitments");

      const venueButton = node("toggle-venue");
      if (venueButton) venueButton.textContent = state.venueApproved ? "Revoke Venue Approval" : "Approve Venue";
      const completeButton = node("complete-game");
      if (completeButton) completeButton.disabled = state.status !== "confirmed";
      const cancelGmButton = node("cancel-gm");
      if (cancelGmButton) cancelGmButton.disabled = state.completed || !state.gmAvailable;
      const restoreGmButton = node("restore-gm");
      if (restoreGmButton) restoreGmButton.disabled = state.completed || state.gmAvailable;

      renderRequirements(state);
      renderExplanation(state);
      renderReputationGate(state);
      renderHubGate(state);
      renderMatchOrigin(state);
    } catch (error) {
      logError("Unable to render lifecycle", error);
    }
  }

  function statusMessage(message) {
    try {
      setText("lifecycle-status", message);
    } catch (error) {
      logError("Unable to announce lifecycle status", error);
    }
  }

  function appendRecovery(message) {
    try {
      const log = node("recovery-log");
      if (!log) return;
      if (log.textContent.includes("No changes yet.")) log.replaceChildren();
      const item = document.createElement("p");
      item.textContent = message;
      log.prepend(item);
    } catch (error) {
      logError("Unable to append lifecycle event", error);
    }
  }

  function currentNotice() {
    try {
      return node("cancel-notice")?.value || "early";
    } catch (error) {
      logError("Unable to read cancellation notice", error);
      return "early";
    }
  }

  function bind() {
    try {
      let state = loadState();
      render(state);

      node("game-hub-link")?.addEventListener("click", () => {
        try {
          if (deriveStatus(state) !== "confirmed" && !state.completed) {
            statusMessage("Confirm the venue and minimum Player commitments before opening the Game Hub.");
            return;
          }
          window.location.href = "game-hub.html?role=gm";
        } catch (error) { logError("Unable to open Game Hub", error); }
      });

      node("toggle-venue")?.addEventListener("click", () => {
        try {
          if (state.completed) return;
          state.venueApproved = !state.venueApproved;
          appendRecovery(state.venueApproved ? "Venue approved the table." : "Venue approval was withdrawn; the table can no longer remain Confirmed.");
          render(state);
          statusMessage(state.venueApproved ? "Venue approved the table." : "Venue approval withdrawn.");
        } catch (error) { logError("Unable to toggle venue approval", error); }
      });

      node("add-player")?.addEventListener("click", () => {
        try {
          if (state.completed || !state.gmAvailable) return;
          if (state.confirmedPlayers < state.maxPlayers) {
            state.confirmedPlayers += 1;
            appendRecovery(`Player confirmed. ${state.confirmedPlayers}/${state.maxPlayers} seats now filled.`);
          } else {
            state.waitlistedPlayers += 1;
            appendRecovery(`Table full. New Player added to waitlist at position ${state.waitlistedPlayers}.`);
          }
          render(state);
          statusMessage(state.status === "confirmed" ? "Confirmation threshold satisfied. The table is Confirmed and the Game Hub is unlocked." : "Player commitment recorded.");
        } catch (error) { logError("Unable to add Player", error); }
      });

      node("cancel-player")?.addEventListener("click", () => {
        try {
          if (state.completed || state.confirmedPlayers <= 0) {
            statusMessage(state.completed ? "Completed games cannot be changed in this demo." : "There are no confirmed Players to cancel.");
            return;
          }
          const notice = currentNotice();
          state.confirmedPlayers -= 1;
          appendRecovery(`Player cancelled with ${noticeLabel(notice)}. ${reputationEffect(notice)}`);
          if (state.waitlistedPlayers > 0) {
            state.waitlistedPlayers -= 1;
            state.confirmedPlayers += 1;
            appendRecovery("First waitlisted Player promoted automatically into the open seat.");
          }
          render(state);
          statusMessage(state.status === "forming" ? "The table is below minimum commitment and returned to Forming; the Game Hub is locked again." : "Player cancellation processed; recovery applied where possible.");
        } catch (error) { logError("Unable to cancel Player", error); }
      });

      node("cancel-gm")?.addEventListener("click", () => {
        try {
          if (state.completed || !state.gmAvailable) return;
          const notice = currentNotice();
          state.gmAvailable = false;
          appendRecovery(`GM cancelled the session with ${noticeLabel(notice)}. ${reputationEffect(notice)}`);
          render(state);
          statusMessage("Session cancelled by the GM. Players and venue should be notified immediately; this occurrence is classified by notice timing, not automatically treated as misconduct.");
        } catch (error) { logError("Unable to cancel GM session", error); }
      });

      node("restore-gm")?.addEventListener("click", () => {
        try {
          if (state.completed || state.gmAvailable) return;
          state.gmAvailable = true;
          appendRecovery("GM restored availability. Table status recalculated from venue approval and Player commitments.");
          render(state);
          statusMessage("GM availability restored.");
        } catch (error) { logError("Unable to restore GM session", error); }
      });

      node("complete-game")?.addEventListener("click", () => {
        try {
          if (deriveStatus(state) !== "confirmed") {
            statusMessage("Only a Confirmed table can be completed.");
            return;
          }
          state.completed = true;
          render(state);
          statusMessage("Game marked Completed. Attendance and eligible post-game feedback can now create verified reputation evidence.");
        } catch (error) { logError("Unable to complete game", error); }
      });

      node("reset-lifecycle")?.addEventListener("click", () => {
        try {
          state = defaultState();
          localStorage.removeItem(STORAGE_KEY);
          const log = node("recovery-log");
          if (log) log.innerHTML = "<p>No changes yet.</p>";
          render(state);
          statusMessage("Lifecycle demo reset.");
        } catch (error) { logError("Unable to reset lifecycle", error); }
      });
    } catch (error) {
      logError("Unable to initialize lifecycle simulator", error);
    }
  }

  try {
    bind();
  } catch (error) {
    logError("Lifecycle failed to initialize", error);
  }
})();