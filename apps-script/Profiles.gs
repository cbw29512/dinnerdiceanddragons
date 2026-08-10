function savePlayerProfile_(payload) {
  try {
    const now = dddNow_();
    const userId = payload.user_id || dddId_("usr");
    const playerId = payload.player_id || dddId_("ply");
    dddAppend_("Users", {
      user_id: userId,
      email: payload.email || "",
      display_name: payload.display_name || "",
      status: "active",
      created_at: now,
      updated_at: now
    });
    dddAppend_("Players", {
      player_id: playerId,
      user_id: userId,
      postal_code: payload.postal_code || "",
      travel_radius_miles: payload.radius || "",
      availability_summary: payload.availability || "",
      preferred_format: payload.preferred_format || "",
      willing_to_learn_new_system: payload.willing_to_learn || "",
      created_at: now,
      updated_at: now
    });
    savePlayerSystems_(playerId, payload, now);
    return { ok: true, user_id: userId, player_id: playerId };
  } catch (error) {
    console.error("[DDD] savePlayerProfile_ failed", error);
    throw error;
  }
}

function savePlayerSystems_(playerId, payload, now) {
  try {
    const systems = Array.isArray(payload.player_system) ? payload.player_system : [payload.player_system].filter(Boolean);
    systems.forEach((system, index) => dddAppend_("PlayerSystems", {
      player_system_id: dddId_("psx"),
      player_id: playerId,
      system,
      edition: "",
      years_playing: valueAt_(payload.player_years, index),
      comfort_level: valueAt_(payload.player_comfort, index),
      experience_notes: valueAt_(payload.player_system_notes, index),
      created_at: now,
      updated_at: now
    }));
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
    dddAppend_("Users", { user_id:userId, email:payload.email||"", display_name:payload.display_name||"", status:"active", created_at:now, updated_at:now });
    dddAppend_("GMs", { gm_id:gmId, user_id:userId, postal_code:payload.postal_code||"", travel_radius_miles:payload.radius||"", beginner_friendly:"", created_at:now, updated_at:now });
    saveGMSystems_(gmId, payload, now);
    return { ok:true, user_id:userId, gm_id:gmId };
  } catch (error) {
    console.error("[DDD] saveGMProfile_ failed", error);
    throw error;
  }
}

function saveGMSystems_(gmId, payload, now) {
  try {
    const systems = Array.isArray(payload.gm_system) ? payload.gm_system : [payload.gm_system].filter(Boolean);
    systems.forEach((system, index) => dddAppend_("GMSystems", {
      gm_system_id: dddId_("gsx"), gm_id:gmId, system, edition:"",
      years_playing:valueAt_(payload.gm_years_playing,index), years_gming:valueAt_(payload.gm_years_gming,index),
      comfort_level:valueAt_(payload.gm_comfort,index), experience_notes:valueAt_(payload.gm_system_notes,index),
      created_at:now, updated_at:now
    }));
  } catch (error) {
    console.error("[DDD] saveGMSystems_ failed", error);
    throw error;
  }
}

function valueAt_(value, index) {
  return Array.isArray(value) ? (value[index] ?? "") : (index === 0 ? (value ?? "") : "");
}
