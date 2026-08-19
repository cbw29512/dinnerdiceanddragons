import { haversineMiles, postalCentroid } from "./geo.mjs";
import { addUtcDays, intersect, occurrences, utcDateString } from "./matching-calendar.mjs";
import {
  SupabaseRestError,
  deleteRows,
  eq,
  insertRows,
  selectMany,
  selectOne,
  updateRows
} from "./supabase-rest.mjs";

const MAX_ROWS = 500;
const MAX_WORK = 250000;
const REFRESHABLE = new Set(["potential", "expired"]);

async function activeRole(userId, role) {
  return Boolean(await selectOne("user_roles", { user_id: eq(userId), role: eq(role) }));
}

async function activeSystem(systemId) {
  const system = await selectOne("game_systems", { id: eq(systemId), active: "is.true" });
  return system || null;
}

async function rawRules({ specificTable, specificOwner, specificId, fallbackTable, fallbackOwner, fallbackId }) {
  const specificLinks = await selectMany(specificTable, { [specificOwner]: eq(specificId), active: "is.true", limit: 20 });
  const links = specificLinks.length
    ? specificLinks
    : await selectMany(fallbackTable, { [fallbackOwner]: eq(fallbackId), active: "is.true", limit: 20 });
  const rules = [];
  for (const link of links) {
    const rule = await selectOne("recurring_availability_rules", { id: eq(link.recurring_rule_id), active: "is.true" });
    if (rule) rules.push(rule);
  }
  return rules;
}

async function loadGMs() {
  const signals = await selectMany("gm_supply_signals", { status: eq("active"), order: "id.asc", limit: MAX_ROWS + 1 });
  if (signals.length > MAX_ROWS) throw new SupabaseRestError("Matching candidate volume exceeds the safe synchronous processing budget.", 503);
  const result = [];
  for (const signal of signals) {
    const profile = await selectOne("gm_profiles", { id: eq(signal.gm_profile_id) });
    if (!profile) continue;
    const user = await selectOne("users", { id: eq(profile.user_id), status: eq("active") });
    if (!user || !(await activeRole(user.id, "gm")) || !(await activeSystem(signal.game_system_id))) continue;
    const rules = await rawRules({
      specificTable: "gm_supply_availability_windows",
      specificOwner: "gm_supply_signal_id",
      specificId: signal.id,
      fallbackTable: "gm_availability_windows",
      fallbackOwner: "gm_profile_id",
      fallbackId: profile.id
    });
    for (const rule of rules) {
      result.push({
        signal,
        profile,
        rule,
        gameSystemId: signal.game_system_id,
        format: signal.preferred_format,
        minPlayers: Number(signal.minimum_players),
        maxPlayers: Number(signal.maximum_players),
        postalCode: profile.postal_code,
        radius: Number(profile.travel_radius_miles)
      });
    }
  }
  if (result.length > MAX_ROWS) throw new SupabaseRestError("Matching candidate volume exceeds the safe synchronous processing budget.", 503);
  return result;
}

async function loadPlayers() {
  const signals = await selectMany("player_demand_signals", { status: eq("active"), order: "id.asc", limit: MAX_ROWS + 1 });
  if (signals.length > MAX_ROWS) throw new SupabaseRestError("Matching candidate volume exceeds the safe synchronous processing budget.", 503);
  const result = [];
  for (const signal of signals) {
    const profile = await selectOne("player_profiles", { id: eq(signal.player_profile_id) });
    if (!profile) continue;
    const user = await selectOne("users", { id: eq(profile.user_id), status: eq("active") });
    if (!user || !(await activeRole(user.id, "player")) || !(await activeSystem(signal.game_system_id))) continue;
    const rules = await rawRules({
      specificTable: "player_demand_availability_windows",
      specificOwner: "player_demand_signal_id",
      specificId: signal.id,
      fallbackTable: "player_availability_windows",
      fallbackOwner: "player_profile_id",
      fallbackId: profile.id
    });
    for (const rule of rules) {
      result.push({
        signal,
        profile,
        rule,
        gameSystemId: signal.game_system_id,
        format: signal.preferred_format,
        postalCode: profile.postal_code,
        radius: Number(profile.travel_radius_miles)
      });
    }
  }
  if (result.length > MAX_ROWS) throw new SupabaseRestError("Matching candidate volume exceeds the safe synchronous processing budget.", 503);
  return result;
}

async function loadVenues() {
  const windows = await selectMany("venue_table_windows", { active: "is.true", order: "id.asc", limit: MAX_ROWS + 1 });
  if (windows.length > MAX_ROWS) throw new SupabaseRestError("Matching candidate volume exceeds the safe synchronous processing budget.", 503);
  const result = [];
  for (const window of windows) {
    const venue = await selectOne("venues", { id: eq(window.venue_id), active: "is.true", verified: "is.true" });
    if (!venue || venue.latitude == null || venue.longitude == null) continue;
    const rule = await selectOne("recurring_availability_rules", { id: eq(window.recurring_rule_id), active: "is.true" });
    if (!rule) continue;
    result.push({
      window,
      venue,
      rule,
      tableCount: Number(window.table_count),
      seatsPerTable: Number(window.max_people_per_table),
      point: { latitude: Number(venue.latitude), longitude: Number(venue.longitude) }
    });
  }
  return result;
}

function overlapDuration(overlap) {
  return overlap.endAt.getTime() - overlap.startAt.getTime();
}

function betterPlayer(candidate, current) {
  if (!current) return true;
  const candidateDuration = overlapDuration(candidate.overlap);
  const currentDuration = overlapDuration(current.overlap);
  if (candidateDuration !== currentDuration) return candidateDuration > currentDuration;
  if (candidate.overlap.startAt.getTime() !== current.overlap.startAt.getTime()) return candidate.overlap.startAt < current.overlap.startAt;
  return candidate.demandId < current.demandId;
}

async function compatiblePlayers({ gm, venue, tableOverlap, players, windowStart, windowEnd, distanceCache }) {
  const best = new Map();
  for (const player of players) {
    if (player.gameSystemId !== gm.gameSystemId) continue;
    if (!["any", gm.format].includes(player.format)) continue;
    let matchingOverlap = null;
    for (const occurrence of occurrences(player.rule, windowStart, windowEnd)) {
      const value = intersect(occurrence, tableOverlap);
      if (value && (!matchingOverlap || overlapDuration(value) > overlapDuration(matchingOverlap))) matchingOverlap = value;
    }
    if (!matchingOverlap) continue;
    const cacheKey = `${player.postalCode}:${venue.venue.id}`;
    let distance = distanceCache.get(cacheKey);
    if (distance == null) {
      distance = haversineMiles(await postalCentroid(player.postalCode), venue.point);
      distanceCache.set(cacheKey, distance);
    }
    if (distance < 0 || distance > player.radius) continue;
    const candidate = {
      demandId: player.signal.id,
      playerProfileId: player.profile.id,
      distanceMiles: distance,
      overlap: matchingOverlap,
      fitFlags: ["system", "player_state", "format", "schedule", "distance"]
    };
    const current = best.get(player.profile.id);
    if (betterPlayer(candidate, current)) best.set(player.profile.id, candidate);
  }
  return [...best.values()].sort((a, b) => a.playerProfileId.localeCompare(b.playerProfileId));
}

function matchKey(candidate) {
  return [candidate.gm.signal.id, candidate.venue.window.id, candidate.overlap.startAt.toISOString(), candidate.overlap.endAt.toISOString()].join("|");
}

function allocationKey(candidate) {
  return [candidate.venue.window.id, candidate.venueOccurrence.startAt.toISOString(), candidate.venueOccurrence.endAt.toISOString()].join("|");
}

function allocateVenueTables(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = allocationKey(candidate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(candidate);
  }
  const selected = new Map();
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key);
    const bestByGm = new Map();
    for (const candidate of group) {
      const gmId = candidate.gm.signal.id;
      const current = bestByGm.get(gmId);
      if (!current || candidate.players.length > current.players.length || (candidate.players.length === current.players.length && matchKey(candidate) < matchKey(current))) {
        bestByGm.set(gmId, candidate);
      }
    }
    const tableCount = Math.min(...group.map((candidate) => candidate.venue.tableCount));
    const ranked = [...bestByGm.values()].sort((a, b) => b.players.length - a.players.length || a.gm.signal.id.localeCompare(b.gm.signal.id) || a.overlap.startAt - b.overlap.startAt);
    for (const candidate of ranked.slice(0, tableCount)) {
      const candidateKey = matchKey(candidate);
      const current = selected.get(candidateKey);
      if (!current || candidate.players.length > current.players.length) selected.set(candidateKey, candidate);
    }
  }
  return [...selected.values()].sort((a, b) => matchKey(a).localeCompare(matchKey(b)));
}

async function compute(windowStart, windowEnd) {
  const [gms, venues, players] = await Promise.all([loadGMs(), loadVenues(), loadPlayers()]);
  const work = gms.length * venues.length * (players.length + 1);
  if (work > MAX_WORK) throw new SupabaseRestError("Matching candidate volume exceeds the safe synchronous processing budget.", 503);
  const candidates = [];
  const distanceCache = new Map();

  for (const gm of gms) {
    const gmOccurrences = occurrences(gm.rule, windowStart, windowEnd);
    for (const venue of venues) {
      const effectiveMax = Math.min(gm.maxPlayers, Math.max(venue.seatsPerTable - 1, 0));
      if (effectiveMax < gm.minPlayers) continue;
      const gmDistanceKey = `gm:${gm.postalCode}:${venue.venue.id}`;
      let gmDistance = distanceCache.get(gmDistanceKey);
      if (gmDistance == null) {
        gmDistance = haversineMiles(await postalCentroid(gm.postalCode), venue.point);
        distanceCache.set(gmDistanceKey, gmDistance);
      }
      if (gmDistance < 0 || gmDistance > gm.radius) continue;

      const venueOccurrences = occurrences(venue.rule, windowStart, windowEnd);
      for (const gmOccurrence of gmOccurrences) {
        for (const venueOccurrence of venueOccurrences) {
          const tableOverlap = intersect(gmOccurrence, venueOccurrence);
          if (!tableOverlap) continue;
          const eligiblePlayers = await compatiblePlayers({
            gm,
            venue,
            tableOverlap,
            players,
            windowStart,
            windowEnd,
            distanceCache
          });
          if (eligiblePlayers.length < gm.minPlayers) continue;
          candidates.push({
            gm,
            venue,
            venueOccurrence,
            overlap: tableOverlap,
            effectiveMax,
            gmDistance,
            players: eligiblePlayers,
            explanations: [
              { criterion: "gm_state", result: "pass", summary: "GM supply signal is active." },
              { criterion: "venue_state", result: "pass", summary: "Venue is active and verified." },
              { criterion: "schedule", result: "pass", summary: "GM and Venue recurrence occurrences overlap." },
              { criterion: "gm_distance", result: "pass", summary: "Venue is within the GM's configured travel radius." },
              { criterion: "venue_capacity", result: "pass", summary: "Venue capacity includes the GM seat and supports the GM Player range." },
              { criterion: "player_threshold", result: "pass", summary: `${eligiblePlayers.length} compatible Players satisfy the GM minimum of ${gm.minPlayers}.` }
            ]
          });
        }
      }
    }
  }
  return allocateVenueTables(candidates);
}

async function persistOne(candidate) {
  const start = candidate.overlap.startAt.toISOString();
  const end = candidate.overlap.endAt.toISOString();
  let match = await selectOne("table_matches", {
    gm_supply_signal_id: eq(candidate.gm.signal.id),
    venue_table_window_id: eq(candidate.venue.window.id),
    proposed_start: eq(start),
    proposed_end: eq(end)
  });
  const created = !match;
  if (!match) {
    const id = crypto.randomUUID();
    const rows = await insertRows("table_matches", [{
      id,
      gm_supply_signal_id: candidate.gm.signal.id,
      venue_table_window_id: candidate.venue.window.id,
      game_system_id: candidate.gm.gameSystemId,
      proposed_start: start,
      proposed_end: end,
      timezone: candidate.venue.rule.timezone,
      minimum_players: candidate.gm.minPlayers,
      maximum_players: candidate.effectiveMax,
      compatible_player_count: candidate.players.length,
      distance_summary: distanceSummary(candidate),
      fit_score: 0,
      status: "potential",
      updated_at: new Date().toISOString()
    }]);
    match = rows[0];
  }
  if (!REFRESHABLE.has(match.status)) return { match, created: false, refreshed: false, tableCreated: false };

  const updated = await updateRows("table_matches", { id: eq(match.id) }, {
    game_system_id: candidate.gm.gameSystemId,
    timezone: candidate.venue.rule.timezone,
    minimum_players: candidate.gm.minPlayers,
    maximum_players: candidate.effectiveMax,
    compatible_player_count: candidate.players.length,
    distance_summary: distanceSummary(candidate),
    fit_score: 0,
    status: "potential",
    updated_at: new Date().toISOString()
  });
  match = updated[0] || match;

  await deleteRows("table_match_players", { table_match_id: eq(match.id) });
  await deleteRows("match_explanations", { table_match_id: eq(match.id) });
  if (candidate.players.length) {
    await insertRows("table_match_players", candidate.players.map((player) => ({
      table_match_id: match.id,
      player_demand_signal_id: player.demandId,
      fit_flags: player.fitFlags,
      distance_miles: Number(player.distanceMiles.toFixed(2)),
      availability_overlap: {
        start: player.overlap.startAt.toISOString(),
        end: player.overlap.endAt.toISOString()
      },
      status: "eligible"
    })), { returning: false });
  }
  await insertRows("match_explanations", candidate.explanations.map((item) => ({
    id: crypto.randomUUID(),
    table_match_id: match.id,
    criterion: item.criterion,
    result: item.result,
    summary: item.summary,
    weight: null
  })), { returning: false });

  const tableCreated = await materializeTable(match, candidate);
  return { match, created, refreshed: true, tableCreated };
}

function distanceSummary(candidate) {
  const distances = candidate.players.map((player) => player.distanceMiles);
  return {
    distance_type: "approximate_straight_line",
    gm_miles: Number(candidate.gmDistance.toFixed(2)),
    nearest_player_miles: Number(Math.min(...distances).toFixed(2)),
    furthest_player_miles: Number(Math.max(...distances).toFixed(2))
  };
}

async function materializeTable(match, candidate) {
  let table = await selectOne("game_tables", { source_table_match_id: eq(match.id) });
  const created = !table;
  const system = await activeSystem(match.game_system_id);
  const values = {
    game_system_id: match.game_system_id,
    game_format: candidate.gm.format,
    minimum_players: Number(match.minimum_players),
    maximum_players: Number(match.maximum_players),
    table_style: candidate.gm.signal.table_style || null,
    gm_profile_id: candidate.gm.profile.id,
    venue_id: candidate.venue.venue.id,
    venue_table_window_id: candidate.venue.window.id,
    proposed_start: match.proposed_start,
    proposed_end: match.proposed_end,
    timezone: match.timezone,
    updated_at: new Date().toISOString()
  };
  if (!table) {
    const id = crypto.randomUUID();
    const date = String(match.proposed_start).slice(0, 10);
    const rows = await insertRows("game_tables", [{
      id,
      created_by_user_id: candidate.gm.profile.user_id,
      source_table_match_id: match.id,
      title: `${system?.name || "Tabletop RPG"} — ${date}`.slice(0, 200),
      lifecycle_status: "forming",
      join_policy: "request",
      visibility: "public",
      minimum_age: null,
      ...values
    }]);
    table = rows[0];
  } else if (["draft", "forming", "ready"].includes(table.lifecycle_status)) {
    const rows = await updateRows("game_tables", { id: eq(table.id) }, values);
    table = rows[0] || { ...table, ...values };
  }
  await syncTableInvitations(table, candidate.players);
  return created;
}

async function syncTableInvitations(table, players) {
  const eligible = new Map();
  for (const player of players) eligible.set(player.playerProfileId, player.demandId);
  const existing = await selectMany("game_table_players", { game_table_id: eq(table.id) });
  const existingMap = new Map(existing.map((row) => [row.player_profile_id, row]));
  for (const [profileId, demandId] of eligible) {
    const row = existingMap.get(profileId);
    if (!row) {
      await insertRows("game_table_players", [{
        game_table_id: table.id,
        player_profile_id: profileId,
        source_player_demand_signal_id: demandId,
        status: "invited",
        requested_at: new Date().toISOString()
      }], { returning: false });
    } else if (row.status === "invited" && row.source_player_demand_signal_id !== demandId) {
      await updateRows("game_table_players", {
        game_table_id: eq(table.id),
        player_profile_id: eq(profileId)
      }, { source_player_demand_signal_id: demandId }, { returning: false });
    }
  }
  for (const row of existing) {
    if (!eligible.has(row.player_profile_id) && row.status === "invited") {
      await updateRows("game_table_players", {
        game_table_id: eq(table.id),
        player_profile_id: eq(row.player_profile_id)
      }, { status: "removed", ended_at: new Date().toISOString() }, { returning: false });
    }
  }
}

async function expireStale(windowStart, windowEnd, selected) {
  const selectedKeys = new Set(selected.map(matchKey));
  const rows = await selectMany("table_matches", {
    status: eq("potential"),
    proposed_start: `gte.${windowStart}T00:00:00.000Z`,
    proposed_end: `lte.${addUtcDays(windowEnd, 1)}T00:00:00.000Z`,
    limit: MAX_ROWS
  });
  let expired = 0;
  for (const match of rows) {
    const key = [match.gm_supply_signal_id, match.venue_table_window_id, new Date(match.proposed_start).toISOString(), new Date(match.proposed_end).toISOString()].join("|");
    if (!selectedKeys.has(key)) {
      await updateRows("table_matches", { id: eq(match.id) }, { status: "expired", updated_at: new Date().toISOString() }, { returning: false });
      expired += 1;
    }
  }
  return expired;
}

export async function runMatching({ horizonDays = 60 } = {}) {
  const horizon = Number(horizonDays);
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 90) throw new SupabaseRestError("horizon_days must be between 1 and 90.", 422);
  const windowStart = utcDateString();
  const windowEnd = addUtcDays(windowStart, horizon - 1);
  const opportunities = await compute(windowStart, windowEnd);
  const persisted = [];
  for (const opportunity of opportunities) persisted.push(await persistOne(opportunity));
  const expiredCount = await expireStale(windowStart, windowEnd, opportunities);
  return {
    computed_opportunities: opportunities.length,
    persisted_count: persisted.length,
    created_count: persisted.filter((item) => item.created).length,
    refreshed_count: persisted.filter((item) => item.refreshed).length,
    materialized_table_count: persisted.filter((item) => item.tableCreated).length,
    expired_count: expiredCount
  };
}
