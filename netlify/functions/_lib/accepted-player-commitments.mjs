import { eq, insertRows, selectMany, selectOne, updateRows } from "./supabase-rest.mjs";

export async function confirmAcceptedPlayers({ matchId, eventId, gameTableId }) {
  try {
    const responses = await selectMany("opportunity_responses", {
      table_match_id: eq(matchId), role: eq("player"), decision: eq("accepted"),
      order: "responded_at.asc,id.asc", limit: 100
    });
    const now = new Date().toISOString();
    let confirmed = 0;
    for (const response of responses) {
      const profile = await selectOne("player_profiles", { user_id: eq(response.user_id) });
      if (!profile) continue;
      const membership = await selectOne("game_table_players", {
        game_table_id: eq(gameTableId), player_profile_id: eq(profile.id)
      });
      if (!membership || ["declined", "removed", "left"].includes(membership.status)) continue;
      const existing = await selectOne("registrations", {
        event_id: eq(eventId), player_profile_id: eq(profile.id)
      });
      if (!existing) {
        await insertRows("registrations", [{
          id: crypto.randomUUID(), event_id: eventId, player_profile_id: profile.id,
          status: "confirmed", expectations_acknowledged_at: null,
          requested_at: response.responded_at || now, responded_at: now, cancelled_at: null
        }], { returning: false });
      } else if (!["cancelled", "declined", "removed"].includes(existing.status)) {
        await updateRows("registrations", { id: eq(existing.id) }, {
          status: "confirmed", responded_at: now, cancelled_at: null
        }, { returning: false });
      }
      await updateRows("game_table_players", {
        game_table_id: eq(gameTableId), player_profile_id: eq(profile.id)
      }, { status: "confirmed", responded_at: now, ended_at: null }, { returning: false });
      if (membership.source_player_demand_signal_id) {
        await updateRows("table_match_players", {
          table_match_id: eq(matchId),
          player_demand_signal_id: eq(membership.source_player_demand_signal_id)
        }, { status: "committed" }, { returning: false });
      }
      confirmed += 1;
    }
    return confirmed;
  } catch (error) {
    console.error("[DDD Formation] Unable to confirm accepted Players", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}
