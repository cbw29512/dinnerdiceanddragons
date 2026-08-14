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
            view.statusMessage("Confirm the venue and the minimum number of Players before opening the Game Hub.");
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
          view.appendRecovery(state.venueApproved ? "Venue marked confirmed." : "Venue marked pending; the table is no longer Confirmed.");
          view.render(state);
          view.statusMessage(state.venueApproved ? "Venue marked confirmed." : "Venue marked pending.");
        } catch (error) {
          logError("Unable to toggle venue approval", error);
        }
      });

      view.node("add-player")?.addEventListener("click", () => {
        try {
          if (state.completed || !state.gmAvailable) return;
          if (state.confirmedPlayers < state.maxPlayers) {
            state.confirmedPlayers += 1;
            view.appendRecovery(`Sample Player added. ${state.confirmedPlayers}/${state.maxPlayers} seats now filled.`);
          } else {
            state.waitlistedPlayers += 1;
            view.appendRecovery(`Table full. Sample Player added to the waitlist at position ${state.waitlistedPlayers}.`);
          }
          view.render(state);
          view.statusMessage(state.status === "confirmed" ? "The table now has everything it needs. Game Hub is unlocked." : "Sample Player commitment added.");
        } catch (error) {
          logError("Unable to add Player", error);
        }
      });

      view.node("cancel-player")?.addEventListener("click", () => {
        try {
          if (state.completed || state.confirmedPlayers <= 0) {
            view.statusMessage(state.completed ? "A played game cannot be changed in this preview." : "There are no confirmed sample Players to remove.");
            return;
          }
          const notice = view.currentNotice();
          state.confirmedPlayers -= 1;
          view.appendRecovery(`Sample Player released the seat with ${model.noticeLabel(notice)}. ${model.reputationEffect(notice)}`);
          if (state.waitlistedPlayers > 0) {
            state.waitlistedPlayers -= 1;
            state.confirmedPlayers += 1;
            view.appendRecovery("The first waitlisted Player moved automatically into the open seat.");
          }
          view.render(state);
          view.statusMessage(state.status === "forming" ? "The table dropped below the minimum and returned to Forming. Game Hub is locked again." : "Seat released and the waitlist was checked automatically.");
        } catch (error) {
          logError("Unable to cancel Player", error);
        }
      });

      view.node("cancel-gm")?.addEventListener("click", () => {
        try {
          if (state.completed || !state.gmAvailable) return;
          const notice = view.currentNotice();
          state.gmAvailable = false;
          view.appendRecovery(`DM cancelled the game night with ${model.noticeLabel(notice)}. ${model.reputationEffect(notice)}`);
          view.render(state);
          view.statusMessage("Game night cancelled by the DM. Players and the venue would need to be notified.");
        } catch (error) {
          logError("Unable to cancel DM game night", error);
        }
      });

      view.node("restore-gm")?.addEventListener("click", () => {
        try {
          if (state.completed || state.gmAvailable) return;
          state.gmAvailable = true;
          view.appendRecovery("DM restored the game night. Readiness was recalculated from venue and Player commitments.");
          view.render(state);
          view.statusMessage("Game night restored by the DM.");
        } catch (error) {
          logError("Unable to restore DM game night", error);
        }
      });

      view.node("complete-game")?.addEventListener("click", () => {
        try {
          if (model.deriveStatus(state) !== "confirmed") {
            view.statusMessage("Only a Confirmed table can be marked played.");
            return;
          }
          state.completed = true;
          view.render(state);
          view.statusMessage("Game marked played. Attendance and eligible post-game feedback can now be recorded.");
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
          view.statusMessage("Confirmation preview reset.");
        } catch (error) {
          logError("Unable to reset lifecycle", error);
        }
      });
    } catch (error) {
      logError("Unable to initialize lifecycle preview", error);
    }
  }

  try {
    bind();
  } catch (error) {
    logError("Lifecycle failed to initialize", error);
  }
})();