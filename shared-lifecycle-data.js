(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function identity() {
    try {
      return {
        playerId: localStorage.getItem("ddd-player-id") || "",
        gmId: localStorage.getItem("ddd-game-master-id") || "",
        gameId: localStorage.getItem("ddd-game-id") || "",
        venueManagerId: localStorage.getItem("ddd-venue-manager-id") || ""
      };
    } catch (error) {
      logError("Unable to read shared lifecycle identity", error);
      return { playerId:"", gmId:"", gameId:"", venueManagerId:"" };
    }
  }

  async function gamesMap() {
    try {
      const result = await window.DDD_API.get("games.list");
      if (!result.ok || !Array.isArray(result.games)) throw new Error(result.error || "Invalid game-list response");
      return Object.fromEntries(result.games.map((game) => [String(game.game_id), game]));
    } catch (error) {
      logError("Unable to load shared games", error);
      throw error;
    }
  }

  async function gmQueue() {
    try {
      const ids = identity();
      if (!ids.gmId || !ids.gameId) throw new Error("Save a GM profile and Forming table in this browser first");
      const result = await window.DDD_API.post("gm.registration_queue", { gm_id:ids.gmId, game_id:ids.gameId });
      if (!result.ok) throw new Error(result.error || "Unable to load GM registration queue");
      return result;
    } catch (error) {
      logError("Unable to load GM registration queue", error);
      throw error;
    }
  }

  async function gmManage(registrationId, action) {
    try {
      const ids = identity();
      if (!ids.gmId) throw new Error("GM pilot identity is missing");
      const result = await window.DDD_API.post("gm.registration_manage", {
        gm_id:ids.gmId,
        registration_id:registrationId,
        registration_action:action
      });
      if (!result.ok) throw new Error(result.error || "Unable to update registration");
      return result;
    } catch (error) {
      logError("Unable to manage GM registration", error);
      throw error;
    }
  }

  async function venueQueue() {
    try {
      const ids = identity();
      if (!ids.venueManagerId) throw new Error("Save a shared Venue opening in this browser first");
      const result = await window.DDD_API.post("venue.booking_queue", { venue_manager_id:ids.venueManagerId });
      if (!result.ok) throw new Error(result.error || "Unable to load Venue booking queue");
      return result;
    } catch (error) {
      logError("Unable to load Venue booking queue", error);
      throw error;
    }
  }

  async function venueManage(gameId, action) {
    try {
      const ids = identity();
      if (!ids.venueManagerId) throw new Error("Venue Manager pilot identity is missing");
      const result = await window.DDD_API.post("venue.booking_manage", {
        venue_manager_id:ids.venueManagerId,
        game_id:gameId,
        booking_action:action
      });
      if (!result.ok) throw new Error(result.error || "Unable to update Venue booking");
      return result;
    } catch (error) {
      logError("Unable to manage Venue booking", error);
      throw error;
    }
  }

  async function playerState() {
    try {
      const ids = identity();
      if (!ids.playerId) throw new Error("Save a Player signal in this browser first");
      const [result, games] = await Promise.all([
        window.DDD_API.post("player.registration_state", { player_id:ids.playerId }),
        gamesMap()
      ]);
      if (!result.ok || !Array.isArray(result.registrations)) throw new Error(result.error || "Unable to load Player registration state");
      return {
        registrations:result.registrations.map((registration) => ({
          ...registration,
          game:games[String(registration.game_id)] || null
        }))
      };
    } catch (error) {
      logError("Unable to load Player registration state", error);
      throw error;
    }
  }

  async function playerCancel(gameId) {
    try {
      const ids = identity();
      if (!ids.playerId) throw new Error("Player pilot identity is missing");
      const result = await window.DDD_API.post("game.cancel_registration", { game_id:gameId, player_id:ids.playerId });
      if (!result.ok) throw new Error(result.error || "Unable to cancel registration");
      return result;
    } catch (error) {
      logError("Unable to cancel Player registration", error);
      throw error;
    }
  }

  window.DDDSharedLifecycleData = {
    identity,
    gmQueue,
    gmManage,
    venueQueue,
    venueManage,
    playerState,
    playerCancel
  };
})();
