function savePlayerProfile_(payload) {
  try {
    const now = dddNow_();
    const userId = payload.user_id || dddId_("usr");
    const playerId = payload.player_id || dddId_("ply");
    dddUpsert_("Users", "user_id", userId, {
      user_id: userId,
      email: payload.email || "",
      display_name: payload.display_name || "",
      status: "active",
      created_at: now,
      updated_at: now
    });
    dddUpsert_("Players", "player_id", playerId, {
      player_id: playerId,
      user_id: userId,
      postal_code: payload.postal_code || "",
      travel_radius_miles: payload.radius || "",
      availability_summary: summarizeAvailability_(payload),
      preferred_format: payload.preferred_format || "",
      willing_to_learn_new_system: payload.willing_to_learn || "",
      created_at: now,
      updated_at: now
    });
    savePlayerSystems_(playerId, payload, now);
    const availability_count = saveAvailabilityRules_("player", playerId, payload, now);
    const demand_signal_count = savePlayerDemandSignals_(playerId, payload, now);
    return { ok:true, user_id:userId, player_id:playerId, availability_count, demand_signal_count };
  } catch (error) {
    console.error("[DDD] savePlayerProfile_ failed", error);
    throw error;
  }
}

function savePlayerSystems_(playerId, payload, now) {
  try {
    const systems = pilotArray_(payload.player_system);
    systems.forEach((system, index) => {
      const normalized = normalizePilotSystem_(system);
      if (!normalized) return;
      const key = `${playerId}::${normalized.toLowerCase()}`;
      dddUpsert_("PlayerSystems", "player_system_id", key, {
        player_system_id: key,
        player_id: playerId,
        system: normalized,
        edition: String(system || "") === normalized ? "" : String(system || ""),
        years_playing: valueAt_(payload.player_years, index),
        comfort_level: valueAt_(payload.player_comfort, index),
        experience_notes: valueAt_(payload.player_system_notes, index),
        created_at: now,
        updated_at: now
      });
    });
  } catch (error) {
    console.error("[DDD] savePlayerSystems_ failed", error);
    throw error;
  }
}

function saveGMProfile_(payload) {
  try {
    const now = dddNow_();
    const userId = payload.user_id || dddId_("usr");
    const gmId = payload.gm_id || dddId_("gm");
    dddUpsert_("Users", "user_id", userId, {
      user_id:userId,
      email:payload.email || "",
      display_name:payload.display_name || "",
      status:"active",
      created_at:now,
      updated_at:now
    });
    dddUpsert_("GMs", "gm_id", gmId, {
      gm_id:gmId,
      user_id:userId,
      postal_code:payload.postal_code || "",
      travel_radius_miles:payload.radius || "",
      beginner_friendly:String(payload.welcome || "").toLowerCase().includes("beginner") ? "yes" : "",
      created_at:now,
      updated_at:now
    });
    saveGMSystems_(gmId, payload, now);
    const availability_count = saveAvailabilityRules_("gm", gmId, payload, now);
    const supply_signal_count = saveGMSupplySignals_(gmId, payload, now);
    return { ok:true, user_id:userId, gm_id:gmId, availability_count, supply_signal_count };
  } catch (error) {
    console.error("[DDD] saveGMProfile_ failed", error);
    throw error;
  }
}

function saveGMSystems_(gmId, payload, now) {
  try {
    const systems = pilotArray_(payload.gm_system);
    systems.forEach((system, index) => {
      const normalized = normalizePilotSystem_(system);
      if (!normalized) return;
      const key = `${gmId}::${normalized.toLowerCase()}`;
      dddUpsert_("GMSystems", "gm_system_id", key, {
        gm_system_id:key,
        gm_id:gmId,
        system:normalized,
        edition:String(system || "") === normalized ? "" : String(system || ""),
        years_playing:valueAt_(payload.gm_play_years,index),
        years_gming:valueAt_(payload.gm_run_years,index),
        comfort_level:valueAt_(payload.gm_comfort,index),
        experience_notes:valueAt_(payload.gm_system_notes,index),
        created_at:now,
        updated_at:now
      });
    });
  } catch (error) {
    console.error("[DDD] saveGMSystems_ failed", error);
    throw error;
  }
}

function summarizeAvailability_(payload) {
  try {
    const days = pilotArray_(payload.availability_day);
    const starts = pilotArray_(payload.availability_start);
    const ends = pilotArray_(payload.availability_end);
    return days.map((day, index) => `${day} ${starts[index] || ""}-${ends[index] || ""}`.trim()).join("; ");
  } catch (error) {
    console.error("[DDD] summarizeAvailability_ failed", error);
    return "";
  }
}

function valueAt_(value, index) {
  try {
    return Array.isArray(value) ? (value[index] ?? "") : (index === 0 ? (value ?? "") : "");
  } catch (error) {
    console.error("[DDD] valueAt_ failed", error);
    return "";
  }
}
