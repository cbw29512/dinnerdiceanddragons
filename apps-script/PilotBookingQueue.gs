function venueBookingQueue_(payload) {
  try {
    if (!payload.venue_manager_id) throw new Error("venue_manager_id is required");
    const manager = dddFindBy_("VenueManagers", "venue_manager_id", payload.venue_manager_id)
      .find((row) => pilotActive_(row.active));
    if (!manager) throw new Error("Active Venue Manager not found");

    const venueId = String(manager.venue_id || "");
    if (!venueId) throw new Error("Venue Manager has no venue");
    const venue = dddFindBy_("Venues", "venue_id", venueId)[0] || null;
    const windowIds = new Set(dddRows_("VenueWindows")
      .filter((row) => String(row.venue_id) === venueId && pilotActive_(row.active))
      .map((row) => String(row.venue_window_id || ""))
      .filter(Boolean));

    const games = Object.fromEntries(latestGames_().map((game) => [String(game.game_id), game]));
    const gms = Object.fromEntries(dddRows_("GMs").map((gm) => [String(gm.gm_id), gm]));
    const users = Object.fromEntries(dddRows_("Users").map((user) => [String(user.user_id), user]));

    const bookings = dddRows_("VenueBookingRequests")
      .filter((booking) => windowIds.has(String(booking.venue_window_id || "")))
      .map((booking) => {
        const game = games[String(booking.event_id)] || {};
        const gm = gms[String(booking.gm_id)] || {};
        const gmUser = users[String(gm.user_id)] || {};
        const state = game.game_id ? sharedGameState_(game.game_id) : null;
        return {
          booking_id:String(booking.booking_id || ""),
          game_id:String(booking.event_id || ""),
          game_title:String(game.title || "Forming Table"),
          system:String(game.system || "RPG"),
          requested_start:String(booking.requested_start || game.starts_at || ""),
          expected_guests:Number(booking.expected_guests || 0),
          booking_status:String(booking.status || "requested"),
          gm_display_name:String(gmUser.display_name || "Game Master"),
          game_status:state ? state.status : String(game.status || "forming"),
          confirmed_players:state ? state.confirmed_players : 0,
          requested_players:state ? state.requested_players : 0,
          waitlisted_players:state ? state.waitlisted_players : 0
        };
      })
      .sort((a, b) => String(a.requested_start).localeCompare(String(b.requested_start)));

    return {
      ok:true,
      venue:{ venue_id:venueId, name:venue ? String(venue.name || "Venue") : "Venue" },
      bookings
    };
  } catch (error) {
    console.error("[DDD] venueBookingQueue_ failed", error);
    throw error;
  }
}
