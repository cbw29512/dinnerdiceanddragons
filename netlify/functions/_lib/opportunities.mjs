import { gameSystemById } from "./catalog.mjs";
import { userRoles } from "./auth.mjs";
import { SupabaseRestError, eq, inList, selectMany, selectOne } from "./supabase-rest.mjs";

const VISIBLE_MATCH = new Set(["potential", "invited", "forming", "converted"]);
const VISIBLE_PLAYER = new Set(["eligible", "notified", "interested", "committed"]);

async function viewerContext(user, match, roles) {
  const viewerRoles = [];
  let playerDistance = null;
  let gmDistance = null;
  let playerFitFlags = [];
  let playerOverlap = null;

  if (roles.includes("player")) {
    const profile = await selectOne("player_profiles", { user_id: eq(user.id) });
    if (profile) {
      const demands = await selectMany("player_demand_signals", { player_profile_id: eq(profile.id), limit: 100 });
      if (demands.length) {
        const demandIds = new Set(demands.map((row) => row.id));
        const matchPlayers = await selectMany("table_match_players", { table_match_id: eq(match.id), limit: 100 });
        const own = matchPlayers.find((row) => demandIds.has(row.player_demand_signal_id) && VISIBLE_PLAYER.has(row.status));
        if (own) {
          viewerRoles.push("player");
          playerDistance = Number(own.distance_miles);
          playerFitFlags = own.fit_flags || [];
          playerOverlap = own.availability_overlap || null;
        }
      }
    }
  }

  if (roles.includes("gm")) {
    const supply = await selectOne("gm_supply_signals", { id: eq(match.gm_supply_signal_id) });
    if (supply) {
      const profile = await selectOne("gm_profiles", { id: eq(supply.gm_profile_id), user_id: eq(user.id) });
      if (profile) {
        viewerRoles.push("gm");
        const value = match.distance_summary?.gm_miles;
        gmDistance = Number.isFinite(Number(value)) ? Number(value) : null;
      }
    }
  }

  if (roles.includes("venue_manager")) {
    const window = await selectOne("venue_table_windows", { id: eq(match.venue_table_window_id) });
    if (window) {
      const manager = await selectOne("venue_managers", {
        venue_id: eq(window.venue_id),
        user_id: eq(user.id),
        verified_at: "not.is.null"
      });
      if (manager) viewerRoles.push("venue_manager");
    }
  }

  return {
    visible: viewerRoles.length > 0,
    roles: viewerRoles,
    playerDistance,
    gmDistance,
    playerFitFlags,
    playerOverlap
  };
}

async function summary(user, match, roles, { detail = false } = {}) {
  const context = await viewerContext(user, match, roles);
  if (!context.visible) return null;
  const system = await gameSystemById(match.game_system_id);
  const window = await selectOne("venue_table_windows", { id: eq(match.venue_table_window_id) });
  const venue = window ? await selectOne("venues", { id: eq(window.venue_id) }) : null;
  if (!system || !venue) return null;
  const table = await selectOne("game_tables", { source_table_match_id: eq(match.id) });
  const event = await selectOne("events", { table_match_id: eq(match.id) });
  const result = {
    id: match.id,
    game_table_id: table?.id || null,
    event_id: event?.id || null,
    event_status: event?.status || null,
    status: match.status,
    proposed_start: match.proposed_start,
    proposed_end: match.proposed_end,
    timezone: match.timezone,
    minimum_players: Number(match.minimum_players),
    maximum_players: Number(match.maximum_players),
    compatible_player_count: Number(match.compatible_player_count),
    system: { slug: system.slug, name: system.name, edition: system.edition || null },
    venue: { id: venue.id, name: venue.name, city: venue.city, state_region: venue.state_region },
    viewer_roles: context.roles,
    your_player_distance_miles: context.playerDistance,
    your_gm_distance_miles: context.gmDistance
  };
  if (detail) {
    const explanations = await selectMany("match_explanations", { table_match_id: eq(match.id), order: "criterion.asc" });
    result.your_player_fit_flags = context.playerFitFlags;
    result.your_player_availability_overlap = context.playerOverlap;
    result.explanations = explanations.map((item) => ({ criterion: item.criterion, result: item.result, summary: item.summary }));
  }
  return result;
}

export async function listOpportunities(user) {
  const roles = await userRoles(user.id);
  if (!roles.length) return [];
  const rows = await selectMany("table_matches", { order: "proposed_start.asc,id.asc", limit: 100 });
  const results = [];
  for (const match of rows) {
    if (!VISIBLE_MATCH.has(match.status)) continue;
    const item = await summary(user, match, roles);
    if (item) results.push(item);
  }
  return results;
}

export async function getOpportunity(user, matchId) {
  const match = await selectOne("table_matches", { id: eq(matchId) });
  if (!match || !VISIBLE_MATCH.has(match.status)) throw new SupabaseRestError("Opportunity not found.", 404);
  const roles = await userRoles(user.id);
  const result = await summary(user, match, roles, { detail: true });
  if (!result) throw new SupabaseRestError("Opportunity not found.", 404);
  return result;
}

export async function findMyTable(user, run) {
  const opportunities = (await listOpportunities(user)).filter((item) => ["potential", "invited", "forming"].includes(item.status));
  return { boom: opportunities.length > 0, run, opportunities };
}
