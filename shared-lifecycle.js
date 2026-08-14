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
      const localDemo = document.querySelector("#local-lifecycle-demo");
      const localHero = document.querySelector("#local-hero-card");
      if (localDemo) localDemo.hidden = connected;
      if (localHero) localHero.hidden = connected;
    } catch (error) {
      logError("Unable to toggle local lifecycle fallback", error);
    }
  }

  function writeError(error, action) {
    try {
      return error.message === "Shared pilot writes are disabled"
        ? `Shared pilot writes are disabled; ${action} is currently read-only.`
        : `${action} failed: ${error.message || "unknown error"}`;
    } catch (nestedError) {
      logError("Unable to format shared lifecycle error", nestedError);
      return `${action} failed.`;
    }
  }

  async function loadGM() {
    try {
      setStatus("Loading shared Player commitments…");
      const queue = await window.DDDSharedLifecycleData.gmQueue();
      window.DDDSharedLifecycleView.renderGM(panel, queue, async (registrationId, action) => {
        try {
          setStatus(`${action === "approve" ? "Approving" : action === "decline" ? "Declining" : "Removing"} Player…`);
          await window.DDDSharedLifecycleData.gmManage(registrationId, action);
          setStatus("Shared Player commitment updated.");
          await loadGM();
        } catch (error) {
          logError("Unable to update shared Player commitment", error);
          setStatus(writeError(error, "Player commitment update"));
        }
      });
      setStatus(`Shared table status: ${String(queue.state?.status || "forming").toUpperCase()}.`);
    } catch (error) {
      logError("Unable to load GM shared lifecycle", error);
      window.DDDSharedLifecycleView.renderMessage(panel, "GM shared state unavailable", error.message || "Save a GM profile and Forming table first.");
      setStatus("GM shared commitment state is unavailable.");
    }
  }

  async function loadVenue() {
    try {
      setStatus("Loading shared Venue booking requests…");
      const queue = await window.DDDSharedLifecycleData.venueQueue();
      window.DDDSharedLifecycleView.renderVenue(panel, queue, async (gameId, action) => {
        try {
          setStatus(`${action === "approve" ? "Approving" : action === "decline" ? "Declining" : "Reopening"} Venue request…`);
          await window.DDDSharedLifecycleData.venueManage(gameId, action);
          setStatus("Shared Venue booking updated.");
          await loadVenue();
        } catch (error) {
          logError("Unable to update shared Venue booking", error);
          setStatus(writeError(error, "Venue booking update"));
        }
      });
      setStatus(`${queue.bookings?.length || 0} booking request${queue.bookings?.length === 1 ? "" : "s"} for this Venue Manager.`);
    } catch (error) {
      logError("Unable to load Venue shared lifecycle", error);
      window.DDDSharedLifecycleView.renderMessage(panel, "Venue shared state unavailable", error.message || "Save a Venue opening first.");
      setStatus("Venue shared booking state is unavailable.");
    }
  }

  async function loadPlayer() {
    try {
      setStatus("Loading your shared seat state…");
      const state = await window.DDDSharedLifecycleData.playerState();
      window.DDDSharedLifecycleView.renderPlayer(panel, state, async (gameId) => {
        try {
          setStatus("Cancelling shared registration…");
          await window.DDDSharedLifecycleData.playerCancel(gameId);
          setStatus("Shared registration cancelled; waitlist recovery recalculated if needed.");
          await loadPlayer();
        } catch (error) {
          logError("Unable to cancel shared Player registration", error);
          setStatus(writeError(error, "Registration cancellation"));
        }
      });
      setStatus(`${state.registrations?.length || 0} active shared registration${state.registrations?.length === 1 ? "" : "s"}.`);
    } catch (error) {
      logError("Unable to load Player shared lifecycle", error);
      window.DDDSharedLifecycleView.renderMessage(panel, "Player shared state unavailable", error.message || "Save a Player signal first.");
      setStatus("Player shared seat state is unavailable.");
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
      logError("Unable to load shared lifecycle role", error);
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
      logError("Unable to choose initial shared lifecycle role", error);
      return "gm";
    }
  }

  async function initialize() {
    try {
      if (!panel || !roleSelect) return;
      const connected = Boolean(window.DDD_API?.isConfigured());
      setConnectedLayout(connected);
      if (!connected) {
        window.DDDSharedLifecycleView.renderMessage(panel, "Shared pilot not connected", "The local lifecycle simulator remains available below. Configure the pilot API to manage commitments across browsers.");
        setStatus("Local prototype mode active.");
        return;
      }
      roleSelect.addEventListener("change", () => loadRole(roleSelect.value));
      await loadRole(initialRole());
    } catch (error) {
      logError("Unable to initialize shared lifecycle", error);
    }
  }

  initialize();
})();
