function pilotDurationMinutes_(value) {
  try {
    if (Number.isFinite(Number(value))) return Number(value);
    const text = String(value || "").trim().toLowerCase();
    const hours = text.match(/^([0-9]+(?:\.[0-9]+)?)\s*hours?$/);
    if (hours) return Number(hours[1]) * 60;
    const minutes = text.match(/^([0-9]+)\s*minutes?$/);
    if (minutes) return Number(minutes[1]);
    return Number.NaN;
  } catch (error) {
    console.error("[DDD] pilotDurationMinutes_ failed", error);
    return Number.NaN;
  }
}

function validatePilotGamePayload_(payload) {
  try {
    const gmId = String(payload.gm_id || "");
    if (!gmId || !dddFindBy_("GMs", "gm_id", gmId).length) throw new Error("A saved GM pilot profile is required");

    const existing = payload.game_id ? latestGameById_(payload.game_id) : null;
    if (existing && String(existing.gm_id) !== gmId) throw new Error("GM does not control this existing Game");

    const venueId = String(payload.venue_id || "");
    const venueWindowId = String(payload.venue_window_id || "");
    if (!venueId || !venueWindowId) throw new Error("A matched public venue window is required");
    const venue = dddFindBy_("Venues", "venue_id", venueId)[0];
    if (!venue || !pilotActive_(venue.active)) throw new Error("Venue is not active in the pilot");
    const venueWindow = dddFindBy_("VenueWindows", "venue_window_id", venueWindowId)[0];
    if (!venueWindow || !pilotActive_(venueWindow.active) || String(venueWindow.venue_id) !== venueId) throw new Error("Selected venue window is invalid");

    const minimumPlayers = Number(payload.min_players || 0);
    const maximumPlayers = Number(payload.seats || payload.max_players || 0);
    const venuePlayerCapacity = Math.max(0, Number(venueWindow.max_people_per_table || 0) - 1);
    if (!Number.isFinite(minimumPlayers) || minimumPlayers < 1) throw new Error("Minimum Players must be at least 1");
    if (!Number.isFinite(maximumPlayers) || maximumPlayers < minimumPlayers) throw new Error("Maximum Player seats must be at least the minimum");
    if (maximumPlayers > venuePlayerCapacity) throw new Error(`Maximum Player seats exceed venue capacity of ${venuePlayerCapacity}`);

    const day = String(payload.day || "");
    if (day !== String(venueWindow.day_of_week || "")) throw new Error("Game day does not match the selected venue window");
    const start = pilotMinutes_(payload.start_time);
    const windowStart = pilotMinutes_(venueWindow.start_time);
    const windowEnd = pilotMinutes_(venueWindow.end_time);
    const duration = pilotDurationMinutes_(payload.duration);
    if (!Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) throw new Error("Valid game start and duration are required");
    if (start < windowStart || start + duration > windowEnd) throw new Error("Game time does not fit inside the selected venue window");

    return { gmId, venueId, venueWindowId, venueWindow, venue, minimumPlayers, maximumPlayers, venuePlayerCapacity, durationMinutes:duration };
  } catch (error) {
    console.error("[DDD] validatePilotGamePayload_ failed", error);
    throw error;
  }
}
