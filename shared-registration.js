(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function playerId() {
    try {
      return localStorage.getItem("ddd-player-id") || "";
    } catch (error) {
      logError("Unable to read shared Player identity", error);
      return "";
    }
  }

  async function loadMap() {
    try {
      const id = playerId();
      if (!id || !window.DDD_API?.isConfigured()) return {};
      const result = await window.DDD_API.post("player.registration_state", { player_id:id });
      if (!result.ok || !Array.isArray(result.registrations)) throw new Error(result.error || "Invalid Player registration response");
      return Object.fromEntries(result.registrations.map((registration) => [String(registration.game_id), registration]));
    } catch (error) {
      logError("Unable to load Player registration state", error);
      return {};
    }
  }

  async function request(gameId) {
    try {
      const id = playerId();
      if (!id) throw new Error("Player profile required");
      const result = await window.DDD_API.post("game.join", { game_id:gameId, player_id:id });
      if (!result.ok) throw new Error(result.error || "Seat request failed");
      return result;
    } catch (error) {
      logError("Unable to request shared pilot seat", error);
      throw error;
    }
  }

  async function cancel(gameId) {
    try {
      const id = playerId();
      if (!id) throw new Error("Player profile required");
      const result = await window.DDD_API.post("game.cancel_registration", { game_id:gameId, player_id:id });
      if (!result.ok) throw new Error(result.error || "Cancellation failed");
      return result;
    } catch (error) {
      logError("Unable to cancel shared pilot registration", error);
      throw error;
    }
  }

  window.DDDSharedRegistration = { playerId, loadMap, request, cancel };
})();
