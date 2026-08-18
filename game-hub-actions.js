(() => {
  "use strict";

  const rt = window.DDDGameHubRuntime;

  async function loadHubIndex() {
    rt.setVisible("hub-loading", true);
    rt.setVisible("hub-error", false);
    rt.setVisible("hub-content", false);
    rt.setVisible("hub-index", false);
    rt.setText("hub-title", "Your game nights, in one place.");
    rt.setText("hub-lede", "Choose a confirmed table where you participate as a Player, Dungeon Master, or verified Venue Manager.");
    rt.setStatus("Loading your Game Hubs…");
    const hubs = await window.DDDProductionAPI.getGameHubs();
    window.DDDGameHubRender.renderIndex(hubs);
    rt.setStatus(hubs.length ? "Choose a Game Hub." : "No live Game Hubs found.");
  }

  async function loadHub() {
    rt.setVisible("hub-loading", true);
    rt.setVisible("hub-error", false);
    rt.setVisible("hub-index", false);
    rt.setVisible("hub-content", false);
    rt.setStatus("Loading live Event and communication state…");
    const [hub, page] = await Promise.all([
      window.DDDProductionAPI.getGameHub(rt.state.eventId),
      window.DDDProductionAPI.getHubMessages(rt.state.eventId, { limit: 50 })
    ]);
    rt.state.hub = hub;
    rt.state.messages = page.items || [];
    rt.state.nextCursor = page.next_cursor || "";
    rt.state.role = chooseInitialRole(hub.capabilities.viewer_roles || []);
    window.DDDGameHubRender.renderHub();
    rt.setVisible("hub-loading", false);
    rt.setVisible("hub-content", true);
    rt.setStatus("Live Game Hub loaded.", "success");
  }

  function chooseInitialRole(roles) {
    const preferred = rt.requestedRole();
    if (preferred && roles.includes(preferred)) return preferred;
    return roles[0] || "";
  }

  async function reloadHubState() {
    rt.state.hub = await window.DDDProductionAPI.getGameHub(rt.state.eventId);
    if (!rt.state.hub.capabilities.viewer_roles.includes(rt.state.role)) {
      rt.state.role = chooseInitialRole(rt.state.hub.capabilities.viewer_roles);
    }
    window.DDDGameHubRender.renderHub();
  }

  async function mutateRegistration(registrationId, action) {
    try {
      rt.setStatus(`Updating Player registration…`);
      await window.DDDProductionAPI.decideRegistration(rt.state.eventId, registrationId, action);
      await reloadHubState();
      rt.setStatus(`Player registration ${rt.humanize(action)} action completed.`, "success");
    } catch (error) {
      rt.handleApiError(error, "Player registration could not be updated.");
    }
  }

  async function cancelSeat() {
    try {
      rt.setStatus("Cancelling your seat…");
      await window.DDDProductionAPI.cancelMyRegistration(rt.state.eventId);
      history.replaceState({}, "", "game-hub.html");
      rt.state.eventId = "";
      rt.state.hub = null;
      await loadHubIndex();
      rt.setStatus("Your seat was cancelled.", "success");
    } catch (error) {
      rt.handleApiError(error, "Your seat could not be cancelled.");
    }
  }

  async function mutateBooking(action) {
    try {
      const booking = rt.state.hub.event.booking;
      const note = rt.byId("venue-booking-message");
      const message = String(note?.value || "").trim();
      if (action === "question" && !message) {
        rt.setStatus("Type the Venue question before sending it to the DM.", "error");
        note?.focus();
        return;
      }
      rt.setStatus("Updating Venue booking…");
      await window.DDDProductionAPI.decideVenueBooking(booking.id, action, message || null);
      if (note) note.value = "";
      await reloadHubState();
      rt.setStatus(`Venue booking ${rt.humanize(action)} action completed.`, "success");
    } catch (error) {
      rt.handleApiError(error, "Venue booking could not be updated.");
    }
  }

  async function initialize() {
    try {
      if (!window.DDDProductionAuth || !window.DDDProductionAPI) {
        rt.showError("Game Hub is unavailable.", "The production authentication client did not load.");
        return;
      }
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (!session) {
        rt.showError("Sign in to open your Game Hubs.", "Use the account connected to your confirmed table, DM role, or verified Venue.");
        return;
      }
      rt.state.eventId = rt.eventIdFromUrl();
      if (rt.state.eventId) await loadHub();
      else await loadHubIndex();
    } catch (error) {
      rt.handleApiError(error, "Game Hub could not be loaded.");
    }
  }

  window.DDDGameHubActions = Object.freeze({
    cancelSeat,
    initialize,
    loadHub,
    loadHubIndex,
    mutateBooking,
    mutateRegistration,
    reloadHubState
  });
})();
