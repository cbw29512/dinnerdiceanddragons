function saveGame_(payload) {
  try {
    const now = dddNow_();
    const gameId = payload.game_id || dddId_("game");
    const seriesId = payload.recurrence && payload.recurrence !== "One time" ? (payload.series_id || dddId_("series")) : "";
    if (seriesId) {
      dddAppend_("GameSeries", {
        series_id: seriesId,
        title: payload.title || "",
        gm_id: payload.gm_id || "",
        system: payload.system || "",
        venue_id: payload.venue_id || "",
        cadence: payload.recurrence || "",
        expected_sessions: payload.expected_sessions || "",
        starts_on: payload.starts_on || "",
        ends_on: payload.ends_on || "",
        active: true,
        created_at: now,
        updated_at: now
      });
    }
    dddAppend_("Games", {
      game_id: gameId,
      series_id: seriesId,
      title: payload.title || "",
      description: payload.description || "",
      gm_id: payload.gm_id || "",
      system: payload.system || "",
      venue_id: payload.venue_id || "",
      status: payload.status || "forming",
      starts_at: payload.starts_at || `${payload.day || ""} ${payload.start_time || ""}`.trim(),
      ends_at: payload.ends_at || "",
      min_players: payload.min_players || "",
      max_players: payload.seats || payload.max_players || "",
      minimum_age: payload.age || "",
      beginner_friendly: payload.experience || "",
      join_mode: payload.join_mode || "",
      created_at: now,
      updated_at: now
    });
    return { ok: true, game_id: gameId, series_id: seriesId };
  } catch (error) {
    console.error("[DDD] saveGame_ failed", error);
    throw error;
  }
}

function listPublicGames_() {
  try {
    const games = dddRows_("Games").filter((game) => !["draft","cancelled"].includes(String(game.status)));
    const venues = Object.fromEntries(dddRows_("Venues").map((venue) => [String(venue.venue_id), venue]));
    const registrations = dddRows_("Registrations");
    return games.map((game) => {
      const confirmed = registrations.filter((row) => String(row.game_id) === String(game.game_id) && String(row.status) === "confirmed").length;
      return {
        game_id: game.game_id,
        title: game.title,
        description: game.description,
        system: game.system,
        status: game.status,
        starts_at: game.starts_at,
        max_players: Number(game.max_players || 0),
        confirmed_players: confirmed,
        expected_guests: confirmed + 1,
        venue: venues[String(game.venue_id)] ? {
          venue_id: venues[String(game.venue_id)].venue_id,
          name: venues[String(game.venue_id)].name,
          city: venues[String(game.venue_id)].city,
          state: venues[String(game.venue_id)].state,
          postal_code: venues[String(game.venue_id)].postal_code
        } : null
      };
    });
  } catch (error) {
    console.error("[DDD] listPublicGames_ failed", error);
    throw error;
  }
}

function joinGame_(payload) {
  try {
    if (!payload.game_id || !payload.player_id) throw new Error("game_id and player_id are required");
    const game = dddFindBy_("Games", "game_id", payload.game_id)[0];
    if (!game) throw new Error("Game not found");
    const existing = dddRows_("Registrations").find((row) => String(row.game_id) === String(payload.game_id) && String(row.player_id) === String(payload.player_id) && !["cancelled","removed","declined"].includes(String(row.status)));
    if (existing) throw new Error("Player already registered");
    const confirmedCount = dddRows_("Registrations").filter((row) => String(row.game_id) === String(payload.game_id) && String(row.status) === "confirmed").length;
    const full = confirmedCount >= Number(game.max_players || 0);
    const approval = String(game.join_mode).toLowerCase().includes("request");
    const status = full ? "waitlisted" : (approval ? "requested" : "confirmed");
    const row = {
      registration_id: dddId_("reg"), game_id:payload.game_id, player_id:payload.player_id,
      status, requested_at:dddNow_(), responded_at:status === "confirmed" ? dddNow_() : "", cancelled_at:""
    };
    dddAppend_("Registrations", row);
    return { ok:true, registration_id:row.registration_id, status };
  } catch (error) {
    console.error("[DDD] joinGame_ failed", error);
    throw error;
  }
}
