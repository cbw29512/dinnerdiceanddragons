import { opportunityAlerts } from "./opportunity-alerts.mjs";
import { eq, selectMany, selectOne } from "./supabase-rest.mjs";

async function gmParticipant(match) {
  const supply = await selectOne("gm_supply_signals", { id: eq(match.gm_supply_signal_id) });
  const profile = supply ? await selectOne("gm_profiles", { id: eq(supply.gm_profile_id) }) : null;
  if (!profile?.user_id) return null;
  return {
    user_id: profile.user_id,
    role: "gm",
    payload: {
      match_id: match.id,
      role: "gm",
      starts_at: match.proposed_start,
      ends_at: match.proposed_end,
      timezone: match.timezone,
      compatible_player_count: Number(match.compatible_player_count)
    }
  };
}

async function venueParticipants(match) {
  const window = await selectOne("venue_table_windows", { id: eq(match.venue_table_window_id) });
  if (!window) return [];
  const managers = await selectMany("venue_managers", {
    venue_id: eq(window.venue_id), verified_at: "not.is.null", limit: 50
  });
  return managers.map((manager) => ({
    user_id: manager.user_id,
    role: "venue_manager",
    preapproved: true,
    payload: {
      match_id: match.id,
      role: "venue_manager",
      starts_at: match.proposed_start,
      ends_at: match.proposed_end,
      timezone: match.timezone,
      expected_guests: 1 + Number(match.minimum_players),
      venue_preapproved: true
    }
  }));
}

async function playerParticipants(match) {
  const links = await selectMany("table_match_players", {
    table_match_id: eq(match.id), status: eq("eligible"), limit: 100
  });
  const participants = [];
  for (const link of links) {
    const demand = await selectOne("player_demand_signals", { id: eq(link.player_demand_signal_id) });
    const profile = demand ? await selectOne("player_profiles", { id: eq(demand.player_profile_id) }) : null;
    if (!profile?.user_id) continue;
    participants.push({
      user_id: profile.user_id,
      role: "player",
      payload: {
        match_id: match.id,
        role: "player",
        starts_at: match.proposed_start,
        ends_at: match.proposed_end,
        timezone: match.timezone
      }
    });
  }
  return participants;
}

export async function reconcileOpportunityAlerts() {
  try {
    const matches = await selectMany("table_matches", {
      status: eq("potential"), order: "proposed_start.asc,id.asc", limit: 100
    });
    let created = 0;
    for (const match of matches) {
      const gm = await gmParticipant(match);
      const participants = [
        ...(gm ? [gm] : []),
        ...(await venueParticipants(match)),
        ...(await playerParticipants(match))
      ];
      if (!participants.length) continue;
      const result = await opportunityAlerts.reconcile({ match, participants });
      created += result.created;
    }
    return Object.freeze({ matches: matches.length, created });
  } catch (error) {
    console.error("[DDD Alerts] Unable to seed persisted opportunities", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
