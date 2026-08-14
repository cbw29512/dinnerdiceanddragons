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
        { met: state.venueApproved, text: "Venue confirmed" },
        { met: state.gmAvailable, text: "DM available" },
        { met: state.confirmedPlayers >= state.minPlayers, text: `${state.minPlayers} minimum confirmed Players` },
        { met: state.confirmedPlayers <= state.maxPlayers, text: `No more than ${state.maxPlayers} Player seats` }
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
        strong.textContent = "Played";
        paragraph.textContent = "Game night happened. Attendance can now be recorded and eligible feedback can be collected.";
      } else if (state.status === "cancelled") {
        strong.textContent = "Cancelled";
        paragraph.textContent = "The DM is unavailable, so this game night is no longer Confirmed. Players and the venue need to know about the change.";
      } else if (state.status === "confirmed") {
        strong.textContent = "Confirmed";
        paragraph.textContent = "The DM, venue, and minimum Player count are ready. The Game Hub is available for game-night coordination.";
      } else {
        strong.textContent = "Still Forming";
        const missing = [];
        if (!state.venueApproved) missing.push("venue confirmation");
        if (!state.gmAvailable) missing.push("DM availability");
        if (state.confirmedPlayers < state.minPlayers) missing.push(`${state.minPlayers - state.confirmedPlayers} more Player${state.minPlayers - state.confirmedPlayers === 1 ? "" : "s"}`);
        paragraph.textContent = `Still waiting for ${missing.join(" and ")}. Potential matches do not count as confirmed seats until Players actually commit.`;
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
        strong.textContent = "Attendance can be recorded";
        paragraph.textContent = "Once attendance is verified, eligible post-game feedback can be tied to a game that actually happened.";
      } else if (state.status === "cancelled") {
        strong.textContent = "No played-game feedback";
        paragraph.textContent = "A cancelled game night does not count as a played session. Cancellation timing can still be handled separately under the reliability rules.";
      } else {
        strong.textContent = "Available after the game";
        paragraph.textContent = "Played-game attendance and feedback stay locked until the game night is marked played.";
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
      if (label) label.textContent = unlocked ? "Table Confirmed — Game Hub is ready." : "Game Hub unlocks when the table is Confirmed.";
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
        setText("match-origin", "This preview was not started from a saved Table Match. The confirmation rules still work the same way.");
        return;
      }
      setText("match-origin", `Table Match found ${candidates} potential Player${candidates === 1 ? "" : "s"}; ${usable} fit this venue's ${capacity}-Player capacity. Potential interest does not count as a confirmed seat.`);
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
      setText("venue-state", state.venueApproved ? "Confirmed" : "Pending");
      setText("table-state", state.status === "completed" ? "Played" : state.status[0].toUpperCase() + state.status.slice(1));
      setText("lifecycle-state-label", `${state.status === "completed" ? "PLAYED" : state.status.toUpperCase()} TABLE`);
      setText("hero-venue", state.venueApproved ? "Yes" : "No");
      setText("hero-gm", state.gmAvailable ? "Yes" : "No");
      setText("hero-players", `${state.confirmedPlayers} / ${state.minPlayers} minimum`);
      setText("hero-status", state.status === "completed" ? "PLAYED" : state.status.toUpperCase());
      setText("hero-reason", state.status === "completed" ? "Game night completed" : state.status === "cancelled" ? "DM cancelled game night" : state.status === "confirmed" ? "Everyone required is ready" : "Waiting for required commitments");

      const venueButton = node("toggle-venue");
      if (venueButton) venueButton.textContent = state.venueApproved ? "Mark Venue Pending" : "Mark Venue Confirmed";
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