function registrationById_(registrationId) {
  try {
    return dddRows_("Registrations").find((row) => String(row.registration_id) === String(registrationId)) || null;
  } catch (error) {
    console.error("[DDD] registrationById_ failed", error);
    throw error;
  }
}

function promoteWaitlist_(game) {
  try {
    const registrations = dddRows_("Registrations").filter((row) => String(row.game_id) === String(game.game_id));
    const confirmedCount = registrations.filter((row) => String(row.status) === "confirmed").length;
    const maxPlayers = Number(game.max_players || 0);
    if (confirmedCount >= maxPlayers) return null;
    const next = registrations
      .filter((row) => String(row.status) === "waitlisted")
      .sort((a, b) => (Date.parse(a.requested_at || 0) || 0) - (Date.parse(b.requested_at || 0) || 0))[0];
    if (!next) return null;
    const requiresApproval = String(game.join_mode || "").toLowerCase().includes("request");
    const status = requiresApproval ? "requested" : "confirmed";
    dddPatchBy_("Registrations", { registration_id:next.registration_id }, { status, responded_at:status === "confirmed" ? dddNow_() : "" });
    return { registration_id:next.registration_id, status };
  } catch (error) {
    console.error("[DDD] promoteWaitlist_ failed", error);
    throw error;
  }
}

function cancelPlayerRegistration_(payload) {
  try {
    if (!payload.game_id || !payload.player_id) throw new Error("game_id and player_id are required");
    const registration = dddRows_("Registrations").find((row) => String(row.game_id) === String(payload.game_id) && String(row.player_id) === String(payload.player_id) && !["cancelled", "removed", "declined"].includes(String(row.status)));
    if (!registration) throw new Error("Active registration not found");
    const wasConfirmed = String(registration.status) === "confirmed";
    dddPatchBy_("Registrations", { registration_id:registration.registration_id }, { status:"cancelled", cancelled_at:dddNow_() });
    const game = latestGameById_(payload.game_id);
    const promoted = wasConfirmed && game ? promoteWaitlist_(game) : null;
    return { ok:true, registration_id:registration.registration_id, status:"cancelled", promoted, game_state:refreshSharedGameStatus_(payload.game_id) };
  } catch (error) {
    console.error("[DDD] cancelPlayerRegistration_ failed", error);
    throw error;
  }
}

function gmManageRegistration_(payload) {
  try {
    if (!payload.gm_id || !payload.registration_id) throw new Error("gm_id and registration_id are required");
    const registration = registrationById_(payload.registration_id);
    if (!registration) throw new Error("Registration not found");
    const game = latestGameById_(registration.game_id);
    if (!game || String(game.gm_id) !== String(payload.gm_id)) throw new Error("GM does not control this game");
    const action = String(payload.registration_action || "approve");
    if (!["approve", "decline", "remove"].includes(action)) throw new Error("Unsupported registration action");

    const now = dddNow_();
    let nextStatus = String(registration.status || "requested");
    let freedConfirmedSeat = false;
    if (action === "approve") {
      const confirmedCount = dddRows_("Registrations").filter((row) => String(row.game_id) === String(game.game_id) && String(row.status) === "confirmed" && String(row.registration_id) !== String(registration.registration_id)).length;
      nextStatus = confirmedCount >= Number(game.max_players || 0) ? "waitlisted" : "confirmed";
    } else if (action === "decline") {
      nextStatus = "declined";
      freedConfirmedSeat = String(registration.status) === "confirmed";
    } else {
      nextStatus = "removed";
      freedConfirmedSeat = String(registration.status) === "confirmed";
    }

    dddPatchBy_("Registrations", { registration_id:registration.registration_id }, { status:nextStatus, responded_at:now, cancelled_at:"" });
    const promoted = freedConfirmedSeat ? promoteWaitlist_(game) : null;
    return { ok:true, registration_id:registration.registration_id, status:nextStatus, promoted, game_state:refreshSharedGameStatus_(game.game_id) };
  } catch (error) {
    console.error("[DDD] gmManageRegistration_ failed", error);
    throw error;
  }
}

function gmRegistrationQueue_(payload) {
  try {
    if (!payload.gm_id || !payload.game_id) throw new Error("gm_id and game_id are required");
    const game = latestGameById_(payload.game_id);
    if (!game || String(game.gm_id) !== String(payload.gm_id)) throw new Error("GM does not control this game");
    const players = Object.fromEntries(dddRows_("Players").map((player) => [String(player.player_id), player]));
    const users = Object.fromEntries(dddRows_("Users").map((user) => [String(user.user_id), user]));
    const registrations = dddRows_("Registrations")
      .filter((row) => String(row.game_id) === String(payload.game_id) && !["cancelled", "removed", "declined"].includes(String(row.status)))
      .map((row) => {
        const player = players[String(row.player_id)] || {};
        const user = users[String(player.user_id)] || {};
        return {
          registration_id:String(row.registration_id),
          status:String(row.status),
          requested_at:String(row.requested_at || ""),
          display_name:String(user.display_name || "Player")
        };
      });
    return { ok:true, game:{ game_id:game.game_id, title:game.title, status:game.status }, registrations, state:sharedGameState_(payload.game_id) };
  } catch (error) {
    console.error("[DDD] gmRegistrationQueue_ failed", error);
    throw error;
  }
}

function playerRegistrationState_(payload) {
  try {
    if (!payload.player_id) throw new Error("player_id is required");
    const player = dddFindBy_("Players", "player_id", payload.player_id)[0];
    if (!player) throw new Error("Player profile not found");
    const games = Object.fromEntries(latestGames_().map((game) => [String(game.game_id), game]));
    const registrations = dddRows_("Registrations")
      .filter((row) => String(row.player_id) === String(payload.player_id) && !["cancelled", "removed", "declined"].includes(String(row.status)))
      .map((row) => ({ registration_id:String(row.registration_id), game_id:String(row.game_id), status:String(row.status), requested_at:String(row.requested_at || ""), game_title:games[String(row.game_id)] ? String(games[String(row.game_id)].title || "Game") : "Game" }));
    return { ok:true, registrations };
  } catch (error) {
    console.error("[DDD] playerRegistrationState_ failed", error);
    throw error;
  }
}
