import { SupabaseRestError, eq, insertRows, selectMany, selectOne, selectOneForUpdate, updateRows, withTransaction } from "./supabase-rest.mjs";

const TERMINAL_TABLE = new Set(["in_progress", "completed", "cancelled", "archived"]);

export async function confirmedCount(eventId) {
  const rows = await selectMany("registrations", { event_id: eq(eventId), status: eq("confirmed"), limit: 100 });
  return rows.length;
}

export async function playerIsMatched(event, profileId) {
  if (event.game_table_id) {
    const membership = await selectOne("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) });
    if (membership && !["declined", "removed", "left"].includes(membership.status)) return true;
  }
  if (!event.table_match_id) return false;
  const demands = await selectMany("player_demand_signals", { player_profile_id: eq(profileId), limit: 100 });
  if (!demands.length) return false;
  const eligible = await selectMany("table_match_players", { table_match_id: eq(event.table_match_id), limit: 100 });
  const ids = new Set(demands.map((item) => item.id));
  return eligible.some((item) => ids.has(item.player_demand_signal_id) && ["eligible", "notified", "interested", "committed"].includes(item.status));
}

export async function syncMembership(event, profileId, confirmed) {
  if (!event.game_table_id) return;
  const membership = await selectOne("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) });
  const now = new Date().toISOString();
  if (confirmed) {
    if (membership) {
      if (!["left", "declined"].includes(membership.status)) {
        await updateRows("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) }, { status: "confirmed", responded_at: now, ended_at: null }, { returning: false });
      }
    } else {
      await insertRows("game_table_players", [{ game_table_id: event.game_table_id, player_profile_id: profileId, source_player_demand_signal_id: null, status: "confirmed", requested_at: now, responded_at: now }], { returning: false });
    }
  } else if (membership && ["requested", "invited", "confirmed"].includes(membership.status)) {
    await updateRows("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) }, { status: "removed", ended_at: now }, { returning: false });
  }
}

export async function synchronizeEvent(event) {
  return withTransaction(async () => {
    const lockedEvent = await selectOneForUpdate("events", { id: eq(event.id) }, { required: true });
    const booking = await selectOne("venue_booking_requests", { event_id: eq(lockedEvent.id) });
    if (!booking) throw new SupabaseRestError("Event is missing Venue booking state.", 409);
    const confirmed = await confirmedCount(lockedEvent.id);
    const now = new Date().toISOString();
    await updateRows("venue_booking_requests", { id: eq(booking.id) }, { expected_guests: 1 + confirmed, updated_at: now }, { returning: false });
    let status = lockedEvent.status;
    if (status !== "completed") {
      if (["declined", "cancelled"].includes(booking.status)) status = "cancelled";
      else if (booking.status !== "approved") status = "venue_requested";
      else if (confirmed >= Number(lockedEvent.max_players)) status = "full";
      else if (confirmed >= Number(lockedEvent.min_players)) status = "confirmed";
      else status = "forming";
    }
    if (status !== lockedEvent.status) await updateRows("events", { id: eq(lockedEvent.id) }, { status, updated_at: now }, { returning: false });
    if (lockedEvent.game_table_id) {
      const table = await selectOne("game_tables", { id: eq(lockedEvent.game_table_id) });
      if (table && !TERMINAL_TABLE.has(table.lifecycle_status)) {
        const tableStatus = ["confirmed", "full"].includes(status) ? "confirmed" : "forming";
        if (tableStatus !== table.lifecycle_status) await updateRows("game_tables", { id: eq(table.id) }, { lifecycle_status: tableStatus, updated_at: now }, { returning: false });
      }
    }
    return { event: lockedEvent, confirmed, status, booking: { ...booking, expected_guests: 1 + confirmed } };
  });
}
