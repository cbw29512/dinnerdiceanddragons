(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function bind() {
    try {
      const model = window.DDDLifecycleModel;
      const view = window.DDDLifecycleView;
      if (!model || !view) throw new Error("Lifecycle model or view module is missing");

      let state = model.loadState();
      view.render(state);

      view.node("game-hub-link")?.addEventListener("click", () => {
        try {
          if (model.deriveStatus(state) !== "confirmed" && !state.completed) {
            view.statusMessage("Confirm the venue and minimum Player commitments before opening the Game Hub.");
            return;
          }
          window.location.href = "game-hub.html?role=gm";
        } catch (error) {
          logError("Unable to open Game Hub", error);
        }
      });

      view.node("toggle-venue")?.addEventListener("click", () => {
        try {
          if (state.completed) return;
          state.venueApproved = !state.venueApproved;
          view.appendRecovery(state.venueApproved ? "Venue approved the table." : "Venue approval was withdrawn; the table can no longer remain Confirmed.");
          view.render(state);
          view.statusMessage(state.venueApproved ? "Venue approved the table." : "Venue approval withdrawn.");
        } catch (error) {
          logError("Unable to toggle venue approval", error);
        }
      });

      view.node("add-player")?.addEventListener("click", () => {
        try {
          if (state.completed || !state.gmAvailable) return;
          if (state.confirmedPlayers < state.maxPlayers) {
            state.confirmedPlayers += 1;
            view.appendRecovery(`Player confirmed. ${state.confirmedPlayers}/${state.maxPlayers} seats now filled.`);
          } else {
            state.waitlistedPlayers += 1;
            view.appendRecovery(`Table full. New Player added to waitlist at position ${state.waitlistedPlayers}.`);
          }
          view.render(state);
          view.statusMessage(state.status === "confirmed" ? "Confirmation threshold satisfied. The table is Confirmed and the Game Hub is unlocked." : "Player commitment recorded.");
        } catch (error) {
          logError("Unable to add Player", error);
        }
      });

      view.node("cancel-player")?.addEventListener("click", () => {
        try {
          if (state.completed || state.confirmedPlayers <= 0) {
            view.statusMessage(state.completed ? "Completed games cannot be changed in this demo." : "There are no confirmed Players to cancel.");
            return;
          }
          const notice = view.currentNotice();
          state.confirmedPlayers -= 1;
          view.appendRecovery(`Player cancelled with ${model.noticeLabel(notice)}. ${model.reputationEffect(notice)}`);
          if (state.waitlistedPlayers > 0) {
            state.waitlistedPlayers -= 1;
            state.confirmedPlayers += 1;
            view.appendRecovery("First waitlisted Player promoted automatically into the open seat.");
          }
          view.render(state);
          view.statusMessage(state.status === "forming" ? "The table is below minimum commitment and returned to Forming; the Game Hub is locked again." : "Player cancellation processed; recovery applied where possible.");
        } catch (error) {
          logError("Unable to cancel Player", error);
        }
      });

      view.node("cancel-gm")?.addEventListener("click", () => {
        try {
          if (state.completed || !state.gmAvailable) return;
          const notice = view.currentNotice();
          state.gmAvailable = false;
          view.appendRecovery(`GM cancelled the session with ${model.noticeLabel(notice)}. ${model.reputationEffect(notice)}`);
          view.render(state);
          view.statusMessage("Session cancelled by the GM. In production, Players and the venue would be notified immediately.");
        } catch (error) {
          logError("Unable to cancel GM session", error);
        }
      });

      view.node("restore-gm")?.addEventListener("click", () => {
        try {
          if (state.completed || state.gmAvailable) return;
          state.gmAvailable = true;
          view.appendRecovery("GM restored availability. Table status recalculated from venue approval and Player commitments.");
          view.render(state);
          view.statusMessage("GM availability restored.");
        } catch (error) {
          logError("Unable to restore GM session", error);
        }
      });

      view.node("complete-game")?.addEventListener("click", () => {
        try {
          if (model.deriveStatus(state) !== "confirmed") {
            view.statusMessage("Only a Confirmed table can be completed.");
            return;
          }
          state.completed = true;
          view.render(state);
          view.statusMessage("Game marked Completed. Attendance and eligible post-game feedback can now create verified reputation evidence.");
        } catch (error) {
          logError("Unable to complete game", error);
        }
      });

      view.node("reset-lifecycle")?.addEventListener("click", () => {
        try {
          state = model.resetState();
          const log = view.node("recovery-log");
          if (log) log.innerHTML = "<p>No changes yet.</p>";
          view.render(state);
          view.statusMessage("Lifecycle demo reset.");
        } catch (error) {
          logError("Unable to reset lifecycle", error);
        }
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
