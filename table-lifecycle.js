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
      confirmedPlayers: 0,
      waitlistedPlayers: 0,
      venueApproved: false,
      status: "forming",
      completed: false,
      attendanceRecorded: false
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
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
      const suffix = hours >= 12 ? "PM" : "AM";
      return `${hours % 12 || 12}:${minutes} ${suffix}`;
    } catch (error) {
      logError("Unable to format lifecycle time", error);
      return value || "";
    }
  }

  function node(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    try {
      const target = node(id);
      if (target) target.textContent = value;
    } catch (error) {
      logError(`Unable to update ${id}`, error);
    }
  }

  function renderRequirements(state) {
    try {
      const list = node("requirements-list");
      if (!list) return;
      list.replaceChildren();
      const requirements = [
        { met: state.venueApproved, text: "Venue approval" },
        { met: state.confirmedPlayers >= state.minPlayers, text: `${state.minPlayers} minimum confirmed Players` },
        { met: state.confirmedPlayers <= state.maxPlayers, text: `${state.maxPlayers} maximum confirmed Player seats` }
      ];
      requirements.forEach((requirement) => {
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
        paragraph.textContent = "The session happened. Attendance can now be recorded and verified reputation evidence may be created.";
      } else if (state.status === "confirmed") {
        strong.textContent = "Confirmed";
        paragraph.textContent = "Venue approval and minimum Player commitment are satisfied. Calendar, reminders, and the Game Hub can activate.";
      } else {
        strong.textContent = "Forming";
        const missing = [];
        if (!state.venueApproved) missing.push("venue approval");
        if (state.confirmedPlayers < state.minPlayers) missing.push(`${state.minPlayers - state.confirmedPlayers} more Player commitment${state.minPlayers - state.confirmedPlayers === 1 ? "" : "s"}`);
        paragraph.textContent = `Still waiting for ${missing.join(" and ")}.`;
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
        paragraph.textContent = "The completed Event may now generate verified attendance/hosting evidence and unlock feedback for eligible participants.";
      } else {
        strong.textContent = "Locked";
        paragraph.textContent = "No reputation can be earned from an unplayed table.";
      }
      box.append(strong, paragraph);
    } catch (error) {
      logError("Unable to render reputation gate", error);
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
      setText("hero-players", `${state.confirmedPlayers} / ${state.minPlayers} minimum`);
      setText("hero-status", state.status.toUpperCase());
      const reason = state.status === "completed" ? "Session completed" : state.status === "confirmed" ? "All confirmation requirements satisfied" : "Waiting for required commitments";
      setText("hero-reason", reason);

      const venueButton = node("toggle-venue");
      if (venueButton) venueButton.textContent = state.venueApproved ? "Revoke Venue Approval" : "Approve Venue";
      const completeButton = node("complete-game");
      if (completeButton) completeButton.disabled = state.status !== "confirmed";
      renderRequirements(state);
      renderExplanation(state);
      renderReputationGate(state);
    } catch (error) {
      logError("Unable to render lifecycle", error);
    }
  }

  function statusMessage(message) {
    setText("lifecycle-status", message);
  }

  function appendRecovery(message) {
    try {
      const log = node("recovery-log");
      if (!log) return;
      if (log.textContent.includes("No seat changes yet.")) log.replaceChildren();
      const item = document.createElement("p");
      item.textContent = message;
      log.prepend(item);
    } catch (error) {
      logError("Unable to append seat recovery event", error);
    }
  }

  function bind() {
    try {
      let state = loadState();
      render(state);

      node("toggle-venue")?.addEventListener("click", () => {
        try {
          if (state.completed) return;
          state.venueApproved = !state.venueApproved;
          render(state);
          statusMessage(state.venueApproved ? "Venue approved the table." : "Venue approval was revoked; the table returns to Forming if approval is required.");
        } catch (error) {
          logError("Unable to toggle venue approval", error);
        }
      });

      node("add-player")?.addEventListener("click", () => {
        try {
          if (state.completed) return;
          if (state.confirmedPlayers < state.maxPlayers) {
            state.confirmedPlayers += 1;
            appendRecovery(`Player confirmed. ${state.confirmedPlayers}/${state.maxPlayers} seats now filled.`);
          } else {
            state.waitlistedPlayers += 1;
            appendRecovery(`Table full. New Player added to waitlist at position ${state.waitlistedPlayers}.`);
          }
          render(state);
          statusMessage(state.status === "confirmed" ? "Confirmation threshold satisfied. The table is Confirmed." : "Player commitment recorded.");
        } catch (error) {
          logError("Unable to add Player", error);
        }
      });

      node("cancel-player")?.addEventListener("click", () => {
        try {
          if (state.completed) return;
          if (state.confirmedPlayers <= 0) {
            statusMessage("There are no confirmed Players to cancel.");
            return;
          }
          state.confirmedPlayers -= 1;
          if (state.waitlistedPlayers > 0) {
            state.waitlistedPlayers -= 1;
            state.confirmedPlayers += 1;
            appendRecovery("A confirmed Player cancelled; the first waitlisted Player was promoted automatically.");
          } else {
            appendRecovery("A confirmed Player cancelled. No waitlisted replacement was available.");
          }
          render(state);
          statusMessage(state.status === "forming" ? "The table is below confirmation requirements and has returned to Forming." : "Seat change processed.");
        } catch (error) {
          logError("Unable to cancel Player", error);
        }
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
        } catch (error) {
          logError("Unable to complete game", error);
        }
      });

      node("reset-lifecycle")?.addEventListener("click", () => {
        try {
          state = defaultState();
          localStorage.removeItem(STORAGE_KEY);
          const log = node("recovery-log");
          if (log) log.innerHTML = "<p>No seat changes yet.</p>";
          render(state);
          statusMessage("Lifecycle demo reset.");
        } catch (error) {
          logError("Unable to reset lifecycle", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize lifecycle simulator", error);
    }
  }

  bind();
})();