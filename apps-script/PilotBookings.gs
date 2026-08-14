function saveBookingForGame_(gameId, payload, seriesId, now) {
  try {
    if (!payload.venue_window_id || !payload.gm_id) return { booking_id:"", status:"not_required" };
    const bookingId = `booking_${gameId}`;
    const existing = dddFindBy_("VenueBookingRequests", "booking_id", bookingId)[0] || null;
    const sameWindow = existing && String(existing.venue_window_id) === String(payload.venue_window_id);
    const approvalRequired = payload.approval_required === true || String(payload.approval_required).toLowerCase() === "true" || String(payload.approval_required).toLowerCase() === "on";
    let bookingStatus = approvalRequired ? "requested" : "approved";
    if (sameWindow && ["approved", "declined"].includes(String(existing.status))) bookingStatus = String(existing.status);

    dddUpsert_("VenueBookingRequests", "booking_id", bookingId, {
      booking_id:bookingId,
      venue_window_id:payload.venue_window_id,
      gm_id:payload.gm_id,
      game_series_id:seriesId || "",
      event_id:gameId,
      requested_start:payload.starts_at || `${payload.day || ""} ${payload.start_time || ""}`.trim(),
      requested_end:payload.ends_at || "",
      tables_requested:"1",
      expected_guests:Number(payload.seats || payload.max_players || 0) + 1,
      status:bookingStatus,
      venue_message:"",
      gm_message:"",
      created_at:now,
      updated_at:now
    });
    return { booking_id:bookingId, status:bookingStatus };
  } catch (error) {
    console.error("[DDD] saveBookingForGame_ failed", error);
    throw error;
  }
}

function bookingForGame_(gameId) {
  try {
    return dddRows_("VenueBookingRequests").find((row) => String(row.event_id) === String(gameId)) || null;
  } catch (error) {
    console.error("[DDD] bookingForGame_ failed", error);
    throw error;
  }
}

function refreshSharedGameStatus_(gameId) {
  try {
    const game = latestGameById_(gameId);
    if (!game) throw new Error("Game not found");
    if (["cancelled", "completed"].includes(String(game.status))) return sharedGameState_(gameId);

    const registrations = dddRows_("Registrations").filter((row) => String(row.game_id) === String(gameId));
    const confirmedPlayers = registrations.filter((row) => String(row.status) === "confirmed").length;
    const waitlistedPlayers = registrations.filter((row) => String(row.status) === "waitlisted").length;
    const requestedPlayers = registrations.filter((row) => String(row.status) === "requested").length;
    const booking = bookingForGame_(gameId);
    const venueApproved = !game.venue_id || (booking && String(booking.status) === "approved");
    const minimumPlayers = Number(game.min_players || 0);
    const maximumPlayers = Number(game.max_players || 0);
    let status = "forming";
    if (venueApproved && minimumPlayers > 0 && confirmedPlayers >= minimumPlayers) status = confirmedPlayers >= maximumPlayers && maximumPlayers > 0 ? "full" : "confirmed";
    dddPatchBy_("Games", { game_id:gameId }, { status, updated_at:dddNow_() });
    return { game_id:gameId, status, venue_approved:venueApproved, booking_status:booking ? booking.status : "not_required", confirmed_players:confirmedPlayers, requested_players:requestedPlayers, waitlisted_players:waitlistedPlayers, min_players:minimumPlayers, max_players:maximumPlayers };
  } catch (error) {
    console.error("[DDD] refreshSharedGameStatus_ failed", error);
    throw error;
  }
}

function sharedGameState_(gameId) {
  try {
    const game = latestGameById_(gameId);
    if (!game) throw new Error("Game not found");
    const registrations = dddRows_("Registrations").filter((row) => String(row.game_id) === String(gameId));
    const booking = bookingForGame_(gameId);
    return {
      game_id:gameId,
      status:String(game.status || "forming"),
      venue_approved:!game.venue_id || Boolean(booking && String(booking.status) === "approved"),
      booking_status:booking ? String(booking.status) : "not_required",
      confirmed_players:registrations.filter((row) => String(row.status) === "confirmed").length,
      requested_players:registrations.filter((row) => String(row.status) === "requested").length,
      waitlisted_players:registrations.filter((row) => String(row.status) === "waitlisted").length,
      min_players:Number(game.min_players || 0),
      max_players:Number(game.max_players || 0)
    };
  } catch (error) {
    console.error("[DDD] sharedGameState_ failed", error);
    throw error;
  }
}

function venueManageBooking_(payload) {
  try {
    if (!payload.game_id || !payload.venue_manager_id) throw new Error("game_id and venue_manager_id are required");
    const game = latestGameById_(payload.game_id);
    if (!game || !game.venue_id) throw new Error("Game venue not found");
    if (!venueManagerOwns_(payload.venue_manager_id, game.venue_id)) throw new Error("Venue Manager does not control this venue");
    const booking = bookingForGame_(payload.game_id);
    if (!booking) throw new Error("Booking request not found");
    const action = String(payload.booking_action || "approve");
    if (!["approve", "decline", "reopen"].includes(action)) throw new Error("Unsupported booking action");
    const status = action === "approve" ? "approved" : action === "decline" ? "declined" : "requested";
    dddPatchBy_("VenueBookingRequests", { booking_id:booking.booking_id }, { status, updated_at:dddNow_() });
    return { ok:true, booking_id:booking.booking_id, booking_status:status, game:refreshSharedGameStatus_(payload.game_id) };
  } catch (error) {
    console.error("[DDD] venueManageBooking_ failed", error);
    throw error;
  }
}
