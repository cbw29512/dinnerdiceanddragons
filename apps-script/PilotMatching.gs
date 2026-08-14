function pilotMatchRequest_(payload) {
  try {
    const system = normalizePilotSystem_(payload.system);
    const day = String(payload.day || "");
    const startText = String(payload.start || payload.start_time || "");
    const start = pilotMinutes_(startText);
    const duration = Number(payload.duration || 240);
    const gmZip = String(payload.gm_zip || "").trim();
    const gmRadius = Number(payload.gm_radius || 25);
    const minimumPlayers = Number(payload.min_players || 3);
    const maximumPlayers = Number(payload.max_players || 5);
    if (!system || !day || !Number.isFinite(start) || !Number.isFinite(duration) || duration <= 0) throw new Error("system, day, valid start, and duration are required");
    if (!/^\d{5}$/.test(gmZip)) throw new Error("A five-digit GM ZIP code is required");
    if (!Number.isFinite(gmRadius) || gmRadius <= 0) throw new Error("A positive GM travel radius is required");
    return { system, day, startText, start, end:start + duration, duration, gmZip, gmRadius, minimumPlayers, maximumPlayers };
  } catch (error) {
    console.error("[DDD] pilotMatchRequest_ failed", error);
    throw error;
  }
}

function pilotCandidatePlayerIds_(system) {
  try {
    return [...new Set(dddRows_("PlayerDemandSignals")
      .filter((signal) => String(signal.status) === "active" && normalizePilotSystem_(signal.system) === system)
      .map((signal) => String(signal.player_id || ""))
      .filter(Boolean))];
  } catch (error) {
    console.error("[DDD] pilotCandidatePlayerIds_ failed", error);
    throw error;
  }
}

function pilotBestVenueWindows_(request) {
  try {
    const bestByVenue = {};
    dddRows_("VenueWindows").forEach((windowRow) => {
      if (!pilotActive_(windowRow.active)) return;
      if (String(windowRow.day_of_week) !== request.day) return;
      const windowStart = pilotMinutes_(windowRow.start_time);
      const windowEnd = pilotMinutes_(windowRow.end_time);
      if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowStart > request.start || windowEnd < request.end) return;
      const venueId = String(windowRow.venue_id || "");
      if (!venueId) return;
      const current = bestByVenue[venueId];
      if (!current || Number(windowRow.max_people_per_table || 0) > Number(current.max_people_per_table || 0)) bestByVenue[venueId] = windowRow;
    });
    return bestByVenue;
  } catch (error) {
    console.error("[DDD] pilotBestVenueWindows_ failed", error);
    throw error;
  }
}

function pilotCompatiblePlayerCount_(playerIds, venuePoint, request, playersById, availabilityByPlayer) {
  try {
    let compatible = 0;
    playerIds.forEach((playerId) => {
      try {
        const player = playersById[playerId];
        if (!player || !player.postal_code) return;
        const rules = availabilityByPlayer[playerId] || [];
        if (!rules.some((rule) => pilotCoversSession_(rule, request.day, request.start, request.end))) return;
        const radius = Number(player.travel_radius_miles || 0);
        if (!Number.isFinite(radius) || radius <= 0) return;
        const playerPoint = pilotZipPoint_(player.postal_code);
        const distance = pilotDistanceMiles_(playerPoint, venuePoint);
        if (Number.isFinite(distance) && distance <= radius) compatible += 1;
      } catch (error) {
        console.error(`[DDD] Unable to evaluate private Player compatibility for ${playerId}`, error);
      }
    });
    return compatible;
  } catch (error) {
    console.error("[DDD] pilotCompatiblePlayerCount_ failed", error);
    throw error;
  }
}

function tableMatchQuery_(payload) {
  try {
    const request = pilotMatchRequest_(payload || {});
    const gmPoint = pilotZipPoint_(request.gmZip);
    const playerIds = pilotCandidatePlayerIds_(request.system);
    const playersById = Object.fromEntries(dddRows_("Players").map((player) => [String(player.player_id), player]));
    const availabilityByPlayer = {};
    dddRows_("AvailabilityRules")
      .filter((rule) => String(rule.owner_type) === "player" && pilotActive_(rule.active))
      .forEach((rule) => {
        const playerId = String(rule.owner_id || "");
        if (!availabilityByPlayer[playerId]) availabilityByPlayer[playerId] = [];
        availabilityByPlayer[playerId].push(rule);
      });

    const venuesById = Object.fromEntries(dddRows_("Venues")
      .filter((venue) => pilotActive_(venue.active))
      .map((venue) => [String(venue.venue_id), venue]));
    const windows = pilotBestVenueWindows_(request);
    const matches = [];

    Object.entries(windows).forEach(([venueId, venueWindow]) => {
      try {
        const venue = venuesById[venueId];
        if (!venue || !venue.postal_code) return;
        const venuePoint = pilotZipPoint_(venue.postal_code);
        const gmDistance = pilotDistanceMiles_(gmPoint, venuePoint);
        if (!Number.isFinite(gmDistance) || gmDistance > request.gmRadius) return;

        const compatiblePlayerCount = pilotCompatiblePlayerCount_(playerIds, venuePoint, request, playersById, availabilityByPlayer);
        if (compatiblePlayerCount <= 0) return;
        const hardFit = pilotHardFit_(compatiblePlayerCount, venueWindow.max_people_per_table, request.minimumPlayers, request.maximumPlayers);
        const score = pilotScoreMatch_(hardFit.usablePlayers, gmDistance, request.gmRadius, venueWindow.max_people_per_table, request.maximumPlayers);
        const match = {
          mode:"shared",
          system:request.system,
          day:request.day,
          startText:request.startText,
          duration:request.duration,
          gmRadius:request.gmRadius,
          distance:gmDistance,
          eligiblePlayerCount:compatiblePlayerCount,
          seatsPerTable:Number(venueWindow.max_people_per_table || 0),
          venueWindowId:String(venueWindow.venue_window_id || ""),
          venue:{
            id:venueId,
            name:String(venue.name || "Partner Venue"),
            city:String(venue.city || ""),
            state:String(venue.state || ""),
            postalCode:String(venue.postal_code || ""),
            policy:String(venueWindow.purchase_policy || venue.purchase_policy || ""),
            approvalRequired:pilotActive_(venueWindow.approval_required)
          },
          hardFit,
          score
        };
        match.explanations = pilotMatchExplanations_(match);
        matches.push(match);
      } catch (error) {
        console.error(`[DDD] Unable to evaluate shared venue ${venueId}`, error);
      }
    });

    matches.sort((a, b) => Number(b.hardFit.viable) - Number(a.hardFit.viable) || b.score.total - a.score.total);
    return { ok:true, mode:"shared", matches, candidate_player_count:playerIds.length };
  } catch (error) {
    console.error("[DDD] tableMatchQuery_ failed", error);
    throw error;
  }
}
