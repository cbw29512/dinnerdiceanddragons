import { requireRole } from "./auth.mjs";
import { confirmedCount, playerIsMatched, syncMembership, synchronizeEvent } from "./event-participation-state.mjs";
import { SupabaseRestError, eq, insertRows, selectMany, selectOne, selectOneForUpdate, updateRows, withTransaction } from "./supabase-rest.mjs";
import { requireUuid } from "./http.mjs";

const REG_ACTIVE = new Set(["requested", "confirmed", "waitlisted"]);
const REG_CLOSED = new Set(["declined", "removed"]);

function response(registration) {
  return {
    id: registration.id, event_id: registration.event_id, status: registration.status,
    expectations_acknowledged_at: registration.expectations_acknowledged_at || null,
    requested_at: registration.requested_at, responded_at: registration.responded_at || null,
    cancelled_at: registration.cancelled_at || null
  };
}

async function promoteWaitlist(event) {
  if (await confirmedCount(event.id) >= Number(event.max_players)) return;
  const waiting = await selectMany("registrations", { event_id: eq(event.id), status: eq("waitlisted"), order: "requested_at.asc,id.asc", limit: 1 });
  const next = waiting[0];
  if (!next || !(await playerIsMatched(event, next.player_profile_id))) return;
  await updateRows("registrations", { id: eq(next.id) }, { status: "confirmed", responded_at: new Date().toISOString() }, { returning: false });
  await syncMembership(event, next.player_profile_id, true);
}

export async function requestRegistration(user, eventId, acknowledged) {
  return withTransaction(async () => {
    await requireRole(user.id, "player");
    if (acknowledged !== true) throw new SupabaseRestError("Table expectations must be acknowledged.", 422);
    const event = await selectOneForUpdate("events", { id: eq(requireUuid(eventId, "event_id")) });
    if (!event) throw new SupabaseRestError("Event not found.", 404);
    if (["cancelled", "completed"].includes(event.status)) throw new SupabaseRestError("Event is not accepting registrations.", 409);
    const profile = await selectOne("player_profiles", { user_id: eq(user.id) });
    if (!profile || !(await playerIsMatched(event, profile.id))) throw new SupabaseRestError("This Player is not eligible for the matched table.", 403);
    let registration = await selectOne("registrations", { event_id: eq(event.id), player_profile_id: eq(profile.id) });
    if (registration && REG_ACTIVE.has(registration.status)) return response(registration);
    if (registration && REG_CLOSED.has(registration.status)) throw new SupabaseRestError("Registration cannot be reopened after a GM decision.", 409);
    const status = await confirmedCount(event.id) >= Number(event.max_players) ? "waitlisted" : event.join_mode === "instant_join" ? "confirmed" : "requested";
    const now = new Date().toISOString();
    if (!registration) {
      const rows = await insertRows("registrations", [{ id: crypto.randomUUID(), event_id: event.id, player_profile_id: profile.id, status, expectations_acknowledged_at: now, requested_at: now, responded_at: status === "confirmed" ? now : null, cancelled_at: null }]);
      registration = rows[0];
    } else {
      const rows = await updateRows("registrations", { id: eq(registration.id) }, { status, expectations_acknowledged_at: now, requested_at: now, responded_at: status === "confirmed" ? now : null, cancelled_at: null });
      registration = rows[0] || registration;
    }
    if (status === "confirmed") await syncMembership(event, profile.id, true);
    await synchronizeEvent(event);
    return response(registration);
  });
}

export async function cancelMyRegistration(user, eventId) {
  return withTransaction(async () => {
    await requireRole(user.id, "player");
    const event = await selectOneForUpdate("events", { id: eq(requireUuid(eventId, "event_id")) });
    const profile = event ? await selectOne("player_profiles", { user_id: eq(user.id) }) : null;
    const registration = profile ? await selectOne("registrations", { event_id: eq(event.id), player_profile_id: eq(profile.id) }) : null;
    if (!event || !registration) throw new SupabaseRestError("Registration was not found.", 404);
    if (registration.status === "cancelled") return response(registration);
    if (REG_CLOSED.has(registration.status)) throw new SupabaseRestError("Registration is already closed.", 409);
    const released = registration.status === "confirmed";
    const rows = await updateRows("registrations", { id: eq(registration.id) }, { status: "cancelled", cancelled_at: new Date().toISOString() });
    if (released) {
      await syncMembership(event, profile.id, false);
      await promoteWaitlist(event);
    }
    await synchronizeEvent(event);
    return response(rows[0] || registration);
  });
}

export async function decideRegistration(user, eventId, registrationId, action) {
  return withTransaction(async () => {
    await requireRole(user.id, "gm");
    const event = await selectOneForUpdate("events", { id: eq(requireUuid(eventId, "event_id")) });
    const gm = event ? await selectOne("gm_profiles", { id: eq(event.gm_profile_id), user_id: eq(user.id) }) : null;
    if (!event || !gm) throw new SupabaseRestError("Event not found.", 404);
    let registration = await selectOne("registrations", { id: eq(requireUuid(registrationId, "registration_id")), event_id: eq(event.id) });
    if (!registration) throw new SupabaseRestError("Registration was not found.", 404);
    const prior = registration.status;
    const now = new Date().toISOString();
    if (action === "confirm") {
      if (registration.status === "confirmed") return response(registration);
      if (["cancelled", "declined", "removed"].includes(registration.status)) throw new SupabaseRestError("Closed registration cannot be confirmed.", 409);
      if (!(await playerIsMatched(event, registration.player_profile_id))) throw new SupabaseRestError("Player is no longer eligible for this matched table.", 409);
      if (await confirmedCount(event.id) >= Number(event.max_players)) throw new SupabaseRestError("No confirmed Player seat remains.", 409);
      const rows = await updateRows("registrations", { id: eq(registration.id) }, { status: "confirmed", responded_at: now });
      registration = rows[0] || registration;
      await syncMembership(event, registration.player_profile_id, true);
    } else if (action === "decline" || action === "remove") {
      const target = action === "decline" ? "declined" : "removed";
      if (registration.status === target) return response(registration);
      if (registration.status === "cancelled") throw new SupabaseRestError("Cancelled registration is already closed.", 409);
      const rows = await updateRows("registrations", { id: eq(registration.id) }, { status: target, responded_at: now });
      registration = rows[0] || registration;
      if (prior === "confirmed") {
        await syncMembership(event, registration.player_profile_id, false);
        await promoteWaitlist(event);
      }
    } else throw new SupabaseRestError("Unsupported GM registration action.", 409);
    await synchronizeEvent(event);
    return response(registration);
  });
}
