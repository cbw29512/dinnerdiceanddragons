(() => {
  "use strict";

  const panel = document.querySelector("#shared-lifecycle-content");
  const roleSelect = document.querySelector("#shared-lifecycle-role");
  const status = document.querySelector("#shared-lifecycle-status");

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function setStatus(message) {
    try {
      if (status) status.textContent = message;
    } catch (error) {
      logError("Unable to update shared lifecycle status", error);
    }
  }

  function setConnectedLayout(connected) {
    try {
      const sharedSection = document.querySelector("#shared-lifecycle");
      const localDemo = document.querySelector("#local-lifecycle-demo");
      const localHero = document.querySelector("#local-hero-card");
      if (sharedSection) sharedSection.hidden = !connected;
      if (localDemo) localDemo.hidden = connected;
      if (localHero) localHero.hidden = connected;
    } catch (error) {
      logError("Unable to toggle lifecycle layout", error);
    }
  }

  function writeError(error, action) {
    try {
      return error.message === "Shared pilot writes are disabled"
        ? `This early-access connection is currently read-only, so ${action.toLowerCase()} is unavailable.`
        : `${action} failed: ${error.message || "unknown error"}`;
    } catch (nestedError) {
      logError("Unable to format lifecycle error", nestedError);
      return `${action} failed.`;
    }
  }

  async function loadGM() {
    try {
      setStatus("Loading Player commitments…");
      const queue = await window.DDDSharedLifecycleData.gmQueue();
      window.DDDSharedLifecycleView.renderGM(panel, queue, async (registrationId, action) => {
        try {
          setStatus(`${action === "approve" ? "Approving" : action === "decline" ? "Declining" : "Removing"} Player…`);
          await window.DDDSharedLifecycleData.gmManage(registrationId, action);
          setStatus("Player commitment updated.");
          await loadGM();
        } catch (error) {
          logError("Unable to update Player commitment", error);
          setStatus(writeError(error, "Player commitment update"));
        }
      });
      setStatus(`Table status: ${String(queue.state?.status || "forming").toUpperCase()}.`);
    } catch (error) {
      logError("Unable to load GM lifecycle", error);
      window.DDDSharedLifecycleView.renderMessage(panel, "Your DM table is not available yet", error.message || "Save a DM profile and create a Forming table first.");
      setStatus("DM table commitments are unavailable.");
    }
  }

  async function loadVenue() {
    try {
      setStatus("Loading booking requests…");
      const queue = await window.DDDSharedLifecycleData.venueQueue();
      window.DDDSharedLifecycleView.renderVenue(panel, queue, async (gameId, action) => {
        try {
          setStatus(`${action === "approve" ? "Approving" : action === "decline" ? "Declining" : "Reopening"} booking…`);
          await window.DDDSharedLifecycleData.venueManage(gameId, action);
          setStatus("Venue booking updated.");
          await loadVenue();
        } catch (error) {
          logError("Unable to update Venue booking", error);
          setStatus(writeError(error, "Venue booking update"));
        }
      });
      setStatus(`${queue.bookings?.length || 0} booking request${queue.bookings?.length === 1 ? "" : "s"} for this venue.`);
    } catch (error) {
      logError("Unable to load Venue lifecycle", error);
      window.DDDSharedLifecycleView.renderMessage(panel, "Your venue bookings are not available yet", error.message || "Save a venue opening first.");
      setStatus("Venue booking requests are unavailable.");
    }
  }

  async function loadPlayer() {
    try {
      setStatus("Loading your seats…");
      const state = await window.DDDSharedLifecycleData.playerState();
      window.DDDSharedLifecycleView.renderPlayer(panel, state, async (gameId) => {
        try {
          setStatus("Cancelling your registration…");
          await window.DDDSharedLifecycleData.playerCancel(gameId);
          setStatus("Registration cancelled. If someone was waiting, the open seat can now be recovered.");
          await loadPlayer();
        } catch (error) {
          logError("Unable to cancel Player registration", error);
          setStatus(writeError(error, "Registration cancellation"));
        }
      });
      setStatus(`${state.registrations?.length || 0} active registration${state.registrations?.length === 1 ? "" : "s"}.`);
    } catch (error) {
      logError("Unable to load Player lifecycle", error);
      window.DDDSharedLifecycleView.renderMessage(panel, "Your seats are not available yet", error.message || "Save your Player preferences first.");
      setStatus("Player seat information is unavailable.");
    }
  }

  async function loadRole(role) {
    try {
      const loaders = { gm:loadGM, venue:loadVenue, player:loadPlayer };
      const safeRole = loaders[role] ? role : "gm";
      if (roleSelect && roleSelect.value !== safeRole) roleSelect.value = safeRole;
      const url = new URL(window.location.href);
      url.searchParams.set("role", safeRole);
      window.history.replaceState({}, "", url);
      await loaders[safeRole]();
    } catch (error) {
      logError("Unable to load lifecycle role", error);
    }
  }

  function initialRole() {
    try {
      const requested = new URLSearchParams(window.location.search).get("role");
      if (["gm", "venue", "player"].includes(requested)) return requested;
      const ids = window.DDDSharedLifecycleData.identity();
      if (ids.gmId && ids.gameId) return "gm";
      if (ids.venueManagerId) return "venue";
      if (ids.playerId) return "player";
      return "gm";
    } catch (error) {
      logError("Unable to choose initial lifecycle role", error);
      return "gm";
    }
  }

  async function initialize() {
    try {
      if (!panel || !roleSelect) return;
      const connected = Boolean(window.DDD_API?.isConfigured());
      setConnectedLayout(connected);
      if (!connected) return;
      roleSelect.addEventListener("change", () => loadRole(roleSelect.value));
      await loadRole(initialRole());
    } catch (error) {
      logError("Unable to initialize lifecycle", error);
    }
  }

  initialize();
})();