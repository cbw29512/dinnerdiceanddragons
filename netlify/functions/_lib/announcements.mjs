import { requireRole } from "./auth.mjs";
import { getGameHub } from "./event-location-view.mjs";
import { asString, requireUuid } from "./http.mjs";
import { eq, insertRows, selectMany, selectOne } from "./supabase-rest.mjs";

function publicAnnouncement(row) {
  return Object.freeze({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    author_role: "gm"
  });
}

export async function listAnnouncements(user, eventId) {
  try {
    const safeEventId = requireUuid(eventId, "event_id");
    await getGameHub(user, safeEventId);
    const rows = await selectMany("messages", {
      event_id: eq(safeEventId),
      channel_type: eq("table_announcement"),
      moderation_status: eq("visible"),
      order: "created_at.desc,id.desc",
      limit: 50
    });
    return rows.map(publicAnnouncement);
  } catch (error) {
    console.error("[DDD Announcements] Unable to list announcements", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

export async function postAnnouncement(user, eventId, payload) {
  try {
    await requireRole(user.id, "gm");
    const safeEventId = requireUuid(eventId, "event_id");
    const event = await selectOne("events", { id: eq(safeEventId) });
    const gm = event ? await selectOne("gm_profiles", { id: eq(event.gm_profile_id), user_id: eq(user.id) }) : null;
    if (!event || !gm) throw Object.assign(new Error("Event not found."), { status: 404 });
    const body = asString(payload?.body, "body", { min: 1, max: 2000 });
    const rows = await insertRows("messages", [{
      id: crypto.randomUUID(),
      event_id: event.id,
      sender_user_id: user.id,
      channel_type: "table_announcement",
      recipient_user_id: null,
      venue_id: null,
      category: null,
      body,
      moderation_status: "visible"
    }]);
    return publicAnnouncement(rows[0]);
  } catch (error) {
    console.error("[DDD Announcements] Unable to post announcement", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
