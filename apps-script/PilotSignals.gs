function pilotArray_(value) {
  try {
    if (Array.isArray(value)) return value.filter((item) => item !== "" && item !== null && item !== undefined);
    return value === "" || value === null || value === undefined ? [] : [value];
  } catch (error) {
    console.error("[DDD] pilotArray_ failed", error);
    return [];
  }
}

function normalizePilotSystem_(value) {
  try {
    const system = String(value || "").trim();
    if (system.indexOf("D&D 5e") === 0) return "D&D 5e";
    if (system.indexOf("Call of Cthulhu") === 0) return "Call of Cthulhu";
    return system;
  } catch (error) {
    console.error("[DDD] normalizePilotSystem_ failed", error);
    return "";
  }
}

function saveAvailabilityRules_(ownerType, ownerId, payload, now) {
  try {
    if (!ownerType || !ownerId) throw new Error("ownerType and ownerId are required");
    dddDeactivateBy_("AvailabilityRules", { owner_type: ownerType, owner_id: ownerId }, now);

    const days = pilotArray_(payload.availability_day);
    const starts = pilotArray_(payload.availability_start);
    const ends = pilotArray_(payload.availability_end);
    const patterns = pilotArray_(payload.availability_pattern);
    const weekIntervals = pilotArray_(payload.availability_week_interval);
    const anchors = pilotArray_(payload.availability_anchor_date);
    const ordinals = pilotArray_(payload.availability_monthly_ordinal);
    const monthIntervals = pilotArray_(payload.availability_month_interval);
    let written = 0;

    days.forEach((day, index) => {
      const start = starts[index] || "";
      const end = ends[index] || "";
      if (!day || !start || !end) return;
      const rawPattern = String(patterns[index] || "weekly");
      const patternType = rawPattern === "monthly" ? "monthly_ordinal_weekday" : "weekly_interval";
      dddAppend_("AvailabilityRules", {
        availability_id: dddId_("avl"),
        owner_type: ownerType,
        owner_id: ownerId,
        day_of_week: day,
        start_time: start,
        end_time: end,
        pattern_type: patternType,
        week_interval: patternType === "weekly_interval" ? (weekIntervals[index] || "1") : "",
        anchor_date: anchors[index] || "",
        monthly_ordinal: patternType === "monthly_ordinal_weekday" ? (ordinals[index] || "Last") : "",
        month_interval: patternType === "monthly_ordinal_weekday" ? (monthIntervals[index] || "1") : "",
        active: true,
        created_at: now,
        updated_at: now
      });
      written += 1;
    });
    return written;
  } catch (error) {
    console.error(`[DDD] saveAvailabilityRules_ failed for ${ownerType}`, error);
    throw error;
  }
}

function savePlayerDemandSignals_(playerId, payload, now) {
  try {
    if (!playerId) throw new Error("playerId is required");
    dddPatchBy_("PlayerDemandSignals", { player_id: playerId, status: "active" }, { status: "paused", updated_at: now });
    const systems = [...new Set(pilotArray_(payload.player_system).map(normalizePilotSystem_).filter(Boolean))];
    systems.forEach((system) => {
      const signalKey = `${playerId}::${system.toLowerCase()}`;
      dddUpsert_("PlayerDemandSignals", "signal_key", signalKey, {
        demand_id: dddId_("dem"),
        signal_key: signalKey,
        player_id: playerId,
        system,
        preferred_format: payload.preferred_format || "",
        preferred_cadence: payload.preferred_cadence || "",
        status: "active",
        created_at: now,
        updated_at: now
      });
    });
    return systems.length;
  } catch (error) {
    console.error("[DDD] savePlayerDemandSignals_ failed", error);
    throw error;
  }
}

function saveGMSupplySignals_(gmId, payload, now) {
  try {
    if (!gmId) throw new Error("gmId is required");
    dddPatchBy_("GMSupplySignals", { gm_id: gmId, status: "active" }, { status: "paused", updated_at: now });
    const systems = [...new Set(pilotArray_(payload.gm_system).map(normalizePilotSystem_).filter(Boolean))];
    systems.forEach((system, index) => {
      const signalKey = `${gmId}::${system.toLowerCase()}`;
      dddUpsert_("GMSupplySignals", "signal_key", signalKey, {
        supply_id: dddId_("sup"),
        signal_key: signalKey,
        gm_id: gmId,
        system,
        preferred_format: valueAt_(payload.gm_format, index),
        preferred_cadence: payload.cadence || "",
        minimum_players: payload.minimum_players || "3",
        maximum_players: payload.maximum_players || "5",
        table_style: payload.style || "",
        status: "active",
        created_at: now,
        updated_at: now
      });
    });
    return systems.length;
  } catch (error) {
    console.error("[DDD] saveGMSupplySignals_ failed", error);
    throw error;
  }
}

function listDemandSummary_() {
  try {
    const activeSignals = dddRows_("PlayerDemandSignals").filter((row) => String(row.status) === "active");
    const activeAvailability = dddRows_("AvailabilityRules").filter((row) => String(row.owner_type) === "player" && pilotActive_(row.active));
    const daysByPlayer = {};
    activeAvailability.forEach((rule) => {
      const playerId = String(rule.owner_id || "");
      if (!playerId || !rule.day_of_week) return;
      if (!daysByPlayer[playerId]) daysByPlayer[playerId] = new Set();
      daysByPlayer[playerId].add(String(rule.day_of_week));
    });

    const groups = {};
    activeSignals.forEach((signal) => {
      const playerId = String(signal.player_id || "");
      const system = normalizePilotSystem_(signal.system);
      const days = daysByPlayer[playerId] ? [...daysByPlayer[playerId]] : [];
      days.forEach((day) => {
        const key = `${system}::${day}`;
        if (!groups[key]) groups[key] = { system, day, player_ids: new Set() };
        groups[key].player_ids.add(playerId);
      });
    });

    return Object.values(groups)
      .map((group) => ({ system: group.system, day: group.day, count: group.player_ids.size }))
      .sort((a, b) => b.count - a.count || String(a.system).localeCompare(String(b.system)) || String(a.day).localeCompare(String(b.day)));
  } catch (error) {
    console.error("[DDD] listDemandSummary_ failed", error);
    throw error;
  }
}
