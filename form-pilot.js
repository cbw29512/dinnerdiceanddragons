(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function actionFor(type) {
    try {
      return ({ Player:"player.save", "Game Master":"gm.save", Venue:"venue.save", Game:"game.save" })[type] || "";
    } catch (error) {
      logError("Unable to resolve pilot form action", error);
      return "";
    }
  }

  function injectIdentity(type, values) {
    try {
      const userId = localStorage.getItem("ddd-user-id") || "";
      if (userId) values.user_id = userId;
      if (type === "Player") {
        const id = localStorage.getItem("ddd-player-id") || "";
        if (id) values.player_id = id;
      } else if (type === "Game Master") {
        const id = localStorage.getItem("ddd-game-master-id") || "";
        if (id) values.gm_id = id;
      } else if (type === "Venue") {
        const venueId = localStorage.getItem("ddd-venue-id") || "";
        const managerId = localStorage.getItem("ddd-venue-manager-id") || "";
        const windowId = localStorage.getItem("ddd-venue-window-id") || "";
        if (venueId) values.venue_id = venueId;
        if (managerId) values.venue_manager_id = managerId;
        if (windowId) values.venue_window_id = windowId;
      } else if (type === "Game") {
        injectGameIdentity_(values);
      }
      return values;
    } catch (error) {
      logError("Unable to reuse saved pilot identity", error);
      return values;
    }
  }

  function injectGameIdentity_(values) {
    try {
      const gameId = localStorage.getItem("ddd-game-id") || "";
      const seriesId = localStorage.getItem("ddd-series-id") || "";
      const gmId = localStorage.getItem("ddd-game-master-id") || "";
      if (gameId) values.game_id = gameId;
      if (seriesId) values.series_id = seriesId;
      if (gmId) values.gm_id = gmId;
      values.status = "forming";
      const rawMatch = localStorage.getItem("ddd-selected-venue-slot");
      if (!rawMatch) return;
      const match = JSON.parse(rawMatch);
      if (match.venueId) values.venue_id = match.venueId;
      if (match.venueWindowId) values.venue_window_id = match.venueWindowId;
      if (match.sourceMode) values.match_source = match.sourceMode;
      if (match.matchScore !== undefined) values.match_score = match.matchScore;
      if (match.eligiblePlayers !== undefined) values.compatible_player_count = match.eligiblePlayers;
      if (match.usablePlayers !== undefined) values.usable_player_count = match.usablePlayers;
      if (match.approvalRequired !== undefined) values.approval_required = match.approvalRequired;
    } catch (error) {
      logError("Unable to add selected match to Game save", error);
    }
  }

  function persistIdentity(result) {
    try {
      const pairs = [
        ["user_id", "ddd-user-id"], ["player_id", "ddd-player-id"], ["gm_id", "ddd-game-master-id"],
        ["game_id", "ddd-game-id"], ["series_id", "ddd-series-id"], ["venue_id", "ddd-venue-id"],
        ["venue_manager_id", "ddd-venue-manager-id"], ["venue_window_id", "ddd-venue-window-id"]
      ];
      pairs.forEach(([field, key]) => {
        if (result[field]) localStorage.setItem(key, result[field]);
      });
    } catch (error) {
      logError("Unable to persist returned pilot identity", error);
    }
  }

  async function save(type, values) {
    try {
      const action = actionFor(type);
      if (!action || !window.DDD_API?.isConfigured()) return { shared:false, result:null };
      const result = await window.DDD_API.post(action, values);
      if (!result.ok) throw new Error(result.error || "Save failed");
      persistIdentity(result);
      return { shared:true, result };
    } catch (error) {
      logError(`Unable to save ${type} to shared pilot`, error);
      throw error;
    }
  }

  window.DDDFormPilot = { actionFor, injectIdentity, save };
})();
