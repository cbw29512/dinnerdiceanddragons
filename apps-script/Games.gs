function saveGame_(payload) {
  try {
    const validated = validatePilotGamePayload_(payload);
    const now = dddNow_();
    const gameId = payload.game_id || dddId_("game");
    const recurrence = String(payload.recurrence || "one_time");
    const recurring = !["", "one_time", "One time", "One-time"].includes(recurrence);
    const seriesId = recurring ? (payload.series_id || dddId_("series")) : "";

    if (seriesId) {
      dddUpsert_("GameSeries", "series_id", seriesId, {
        series_id:seriesId,
        title:payload.title || "",
        gm_id:validated.gmId,
        system:payload.system || "",
        venue_id:validated.venueId,
        cadence:recurrence,
        expected_sessions:payload.expected_sessions || "",
        starts_on:payload.starts_on || "",
        ends_on:payload.ends_on || "",
        active:true,
        created_at:now,
        updated_at:now
      });
    }

    dddUpsert_("Games", "game_id", gameId, {
      game_id:gameId,
      series_id:seriesId,
      title:payload.title || "",
      description:payload.description || "",
      gm_id:validated.gmId,
      system:payload.system || "",
      venue_id:validated.venueId,
      status:"forming",
      starts_at:payload.starts_at || `${payload.day || ""} ${payload.start_time || ""}`.trim(),
      ends_at:payload.ends_at || "",
      min_players:validated.minimumPlayers,
      max_players:validated.maximumPlayers,
      minimum_age:payload.age || "",
      beginner_friendly:payload.experience || "",
      join_mode:payload.join_mode || "",
      created_at:now,
      updated_at:now
    });
    const booking = saveBookingForGame_(gameId, { ...payload, gm_id:validated.gmId, venue_id:validated.venueId, venue_window_id:validated.venueWindowId }, seriesId, now);
    const gameState = refreshSharedGameStatus_(gameId);
    return { ok:true, game_id:gameId, series_id:seriesId, booking_id:booking.booking_id, booking_status:booking.status, game_state:gameState };
  } catch (error) {
    console.error("[DDD] saveGame_ failed", error);
    throw error;
  }
}

function latestGames_() {
  try {
    const latest = {};
    dddRows_("Games").forEach((game) => {
      const id = String(game.game_id || "");
      if (!id) return;
      const current = latest[id];
      const updated = Date.parse(game.updated_at || game.created_at || 0) || 0;
      const currentUpdated = current ? (Date.parse(current.updated_at || current.created_at || 0) || 0) : -1;
      if (!current || updated >= currentUpdated) latest[id] = game;
    });
    return Object.values(latest);
  } catch (error) {
    console.error("[DDD] latestGames_ failed", error);
    throw error;
  }
}

function latestGameById_(gameId) {
  try {
    return latestGames_().find((game) => String(game.game_id) === String(gameId)) || null;
  } catch (error) {
    console.error("[DDD] latestGameById_ failed", error);
    throw error;
  }
}

function listPublicGames_() {
  try {
    const games = latestGames_().filter((game) => !["draft", "cancelled"].includes(String(game.status)));
    const venues = Object.fromEntries(dddRows_("Venues").map((venue) => [String(venue.venue_id), venue]));
    const registrations = dddRows_("Registrations");
    return games.map((game) => {
      const confirmed = registrations.filter((row) => String(row.game_id) === String(game.game_id) && String(row.status) === "confirmed").length;
      const requested = registrations.filter((row) => String(row.game_id) === String(game.game_id) && String(row.status) === "requested").length;
      const waitlisted = registrations.filter((row) => String(row.game_id) === String(game.game_id) && String(row.status) === "waitlisted").length;
      const booking = bookingForGame_(game.game_id);
      return {
        game_id:game.game_id,
        title:game.title,
        description:game.description,
        system:game.system,
        status:game.status,
        starts_at:game.starts_at,
        min_players:Number(game.min_players || 0),
        max_players:Number(game.max_players || 0),
        confirmed_players:confirmed,
        requested_players:requested,
        waitlisted_players:waitlisted,
        expected_guests:confirmed + 1,
        join_mode:game.join_mode,
        venue_approved:!game.venue_id || Boolean(booking && String(booking.status) === "approved"),
        venue:venues[String(game.venue_id)] ? {
          venue_id:venues[String(game.venue_id)].venue_id,
          name:venues[String(game.venue_id)].name,
          city:venues[String(game.venue_id)].city,
          state:venues[String(game.venue_id)].state,
          postal_code:venues[String(game.venue_id)].postal_code
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
    const player = dddFindBy_("Players", "player_id", payload.player_id)[0];
    if (!player) throw new Error("Player profile not found");
    const game = latestGameById_(payload.game_id);
    if (!game) throw new Error("Game not found");
    if (["draft", "cancelled", "completed"].includes(String(game.status))) throw new Error("This game is not accepting registrations");

    const registrations = dddRows_("Registrations");
    const existing = registrations.find((row) => String(row.game_id) === String(payload.game_id) && String(row.player_id) === String(payload.player_id) && !["cancelled", "removed", "declined"].includes(String(row.status)));
    if (existing) throw new Error("Player already registered");

    const confirmedCount = registrations.filter((row) => String(row.game_id) === String(payload.game_id) && String(row.status) === "confirmed").length;
    const maxPlayers = Number(game.max_players || 0);
    if (!Number.isFinite(maxPlayers) || maxPlayers <= 0) throw new Error("Game has no valid Player capacity");
    const full = confirmedCount >= maxPlayers;
    const approval = String(game.join_mode).toLowerCase().includes("request");
    const registrationStatus = full ? "waitlisted" : (approval ? "requested" : "confirmed");
    const now = dddNow_();
    const row = {
      registration_id:dddId_("reg"),
      game_id:payload.game_id,
      player_id:payload.player_id,
      status:registrationStatus,
      requested_at:now,
      responded_at:registrationStatus === "confirmed" ? now : "",
      cancelled_at:""
    };
    dddAppend_("Registrations", row);
    const gameState = refreshSharedGameStatus_(payload.game_id);
    return { ok:true, registration_id:row.registration_id, status:registrationStatus, game_state:gameState };
  } catch (error) {
    console.error("[DDD] joinGame_ failed", error);
    throw error;
  }
}
