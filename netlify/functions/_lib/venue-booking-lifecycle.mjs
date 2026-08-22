import { managedVenue, requireRole } from "./auth.mjs";
import { synchronizeEvent } from "./event-participation-state.mjs";
import { SupabaseRestError, eq, selectMany, selectOne, selectOneForUpdate, updateRows, withTransaction } from "./supabase-rest.mjs";
import { asString, requireUuid } from "./http.mjs";

function optionalText(value, name, max = 4000) {
  if (value === undefined || value === null || value === "") return null;
  return asString(value, name, { min: 0, max, nullable: true });
}

async function bookingCapacityAvailable(booking, window) {
  const approved = await selectMany("venue_booking_requests", { venue_table_window_id: eq(window.id), status: eq("approved"), limit: 200 });
  const start = new Date(booking.requested_start);
  const end = new Date(booking.requested_end);
  const simultaneous = approved.filter((item) => item.id !== booking.id && new Date(item.requested_start) < end && new Date(item.requested_end) > start);
  const used = simultaneous.reduce((sum, item) => sum + Number(item.tables_requested || 1), 0);
  return used + Number(booking.tables_requested || 1) <= Number(window.table_count);
}

function response(booking) {
  return {
    id: booking.id, event_id: booking.event_id || null, status: booking.status,
    expected_guests: Number(booking.expected_guests), requested_start: booking.requested_start,
    requested_end: booking.requested_end, venue_message: booking.venue_message || null
  };
}

export async function decideVenueBooking(user, bookingId, action, message = null) {
  return withTransaction(async () => {
    await requireRole(user.id, "venue_manager");
    const safeBookingId = requireUuid(bookingId, "booking_id");
    let booking = await selectOne("venue_booking_requests", { id: eq(safeBookingId) });
    if (!booking?.event_id) throw new SupabaseRestError("Venue booking was not found.", 404);
    const eventId = booking.event_id;
    const windowId = booking.venue_table_window_id;
    const window = await selectOneForUpdate("venue_table_windows", { id: eq(windowId), active: "is.true" });
    if (!window) throw new SupabaseRestError("Venue table window is no longer available.", 409);
    const event = await selectOneForUpdate("events", { id: eq(eventId) });
    if (!event) throw new SupabaseRestError("Venue booking was not found.", 404);
    booking = await selectOneForUpdate("venue_booking_requests", { id: eq(safeBookingId) });
    if (!booking || booking.event_id !== eventId || booking.venue_table_window_id !== windowId) {
      throw new SupabaseRestError("Venue booking state changed while the decision was being processed.", 409);
    }
    await managedVenue(user.id, event.venue_id, { verified: true });
    const current = booking.status;
    let status;
    if (action === "approve") {
      if (current === "approved") return response(booking);
      if (!["requested", "question"].includes(current)) throw new SupabaseRestError("Venue booking cannot be approved from its current state.", 409);
      if (Number(event.max_players) + 1 > Number(window.max_people_per_table)) throw new SupabaseRestError("Venue table capacity no longer supports the Event headcount.", 409);
      if (!(await bookingCapacityAvailable(booking, window))) throw new SupabaseRestError("Venue table capacity is already committed for that time.", 409);
      status = "approved";
    } else if (action === "question") {
      if (!["requested", "question"].includes(current)) throw new SupabaseRestError("Venue booking cannot be questioned from its current state.", 409);
      status = "question";
    } else if (action === "decline") {
      if (current === "declined") return response(booking);
      if (!["requested", "question"].includes(current)) throw new SupabaseRestError("Venue booking cannot be declined from its current state.", 409);
      status = "declined";
    } else if (action === "cancel") {
      if (current === "cancelled") return response(booking);
      if (!["requested", "question", "approved"].includes(current)) throw new SupabaseRestError("Venue booking cannot be cancelled from its current state.", 409);
      status = "cancelled";
    } else throw new SupabaseRestError("Unsupported Venue booking action.", 409);
    const rows = await updateRows("venue_booking_requests", { id: eq(booking.id) }, { status, ...(message !== undefined ? { venue_message: optionalText(message, "message") } : {}), updated_at: new Date().toISOString() });
    booking = rows[0] || { ...booking, status };
    await synchronizeEvent(event);
    return response(booking);
  });
}
