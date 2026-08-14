(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
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
        const item = document.createElement("li");
        item.textContent = `${requirement.met ? "✓" : "○"} ${requirement.text}`;
        list.appendChild(item);
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
        paragraph.textContent = "The GM is unavailable, so this session cannot remain Confirmed. Players and venue should be notified immediately in production.";
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
      const candidates = Number(state.candidatePlayers) || 0;
      const usable = Number(state.usablePlayerDemand) || 0;
      const capacity = Number(state.venuePlayerCapacity) || state.maxPlayers;
      if (!candidates) {
        setText("match-origin", "This table was not seeded from a saved Table Match. Commitments below still control confirmation.");
        return;
      }
      setText("match-origin", `Started from an explained Table Match with ${candidates} compatible Player signal${candidates === 1 ? "" : "s"}; ${usable} fit the selected table capacity of ${capacity} Players. Demand is not counted as commitment.`);
    } catch (error) {
      logError("Unable to render Table Match origin", error);
    }
  }

  function render(state) {
    try {
      const model = window.DDDLifecycleModel;
      state.status = model.deriveStatus(state);
      model.saveState(state);
      setText("lifecycle-title", state.title);
      setText("lifecycle-meta", `${state.system} · ${state.venue} · ${state.day} ${model.humanTime(state.start)}`);
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

  window.DDDLifecycleView = { node, render, statusMessage, appendRecovery, currentNotice };
})();
