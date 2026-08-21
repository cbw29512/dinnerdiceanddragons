import assert from "node:assert/strict";

import { eq, insertRows, selectMany, selectOne, updateRows } from "../netlify/functions/_lib/database.mjs";
import { cancelMyRegistration, decideRegistration, requestRegistration } from "../netlify/functions/_lib/registration-lifecycle.mjs";
import { decideVenueBooking } from "../netlify/functions/_lib/venue-booking-lifecycle.mjs";
import { createVenueTableWindow } from "../netlify/functions/_lib/matching-inputs.mjs";
import { createVenueOnboarding, saveGMOnboarding, savePlayerOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import { weeklyAvailability } from "./netlify-database-test-helpers.mjs";

const SYSTEM_ID = "10000000-0000-0000-0000-000000000002";
const gmUserId = "b1000000-0000-4000-8000-000000000001";
const venueUserId = "b1000000-0000-4000-8000-000000000002";
const playerOneUserId = "b1000000-0000-4000-8000-000000000003";
const playerTwoUserId = "b1000000-0000-4000-8000-000000000004";
const now = "2026-08-21T22:50:00.000Z";

await insertRows("users", [
  { id: gmUserId, auth_provider_user_id: "integration-lifecycle-gm", email: "lifecycle-gm@example.test", status: "active" },
  { id: venueUserId, auth_provider_user_id: "integration-lifecycle-venue", email: "lifecycle-venue@example.test", status: "active" },
  { id: playerOneUserId, auth_provider_user_id: "integration-lifecycle-player-1", email: "lifecycle-player-1@example.test", status: "active" },
  { id: playerTwoUserId, auth_provider_user_id: "integration-lifecycle-player-2", email: "lifecycle-player-2@example.test", status: "active" }
], { returning: false });

await saveGMOnboarding({ id: gmUserId, display_name: null }, {
  display_name: "Lifecycle GM", bio: null, postal_code: "29501", travel_radius_miles: 25, beginner_friendly: true, gm_style: "Balanced",
  systems: [{ system_slug: "dnd-5e-2024", years_playing: 5, years_gming: 3, comfort_level: "expert", preferred_player_experience: "any", formats: ["one_shot"], experience_notes: null }],
  availability: [weeklyAvailability("saturday")]
});
for (const [userId, name] of [[playerOneUserId, "Lifecycle Player One"], [playerTwoUserId, "Lifecycle Player Two"]]) {
  await savePlayerOnboarding({ id: userId, display_name: null }, {
    display_name: name, bio: null, postal_code: "29501", travel_radius_miles: 25, preferred_format: "any", willing_to_learn_new_system: true,
    environment_preferences: [], accessibility_notes_private: null,
    systems: [{ system_slug: "dnd-5e-2024", years_playing: 1, comfort_level: "learning", experience_notes: null }], availability: [weeklyAvailability("saturday")]
  });
}
const venue = await createVenueOnboarding({ id: venueUserId }, {
  name: "Lifecycle Library", venue_type: "library", address_line1: "100 Atomic Ave", address_line2: null, city: "Florence", state_region: "SC", postal_code: "29501",
  website_url: null, phone: null, amenities: [], host_support_offerings: [], host_support_notes: null, accessibility_notes: null, parking_notes: null, noise_notes: null, lighting_notes: null, manager_role: "manager"
});
await updateRows("venue_managers", { user_id: eq(venueUserId), venue_id: eq(venue.venue_id) }, { verified_at: now }, { returning: false });
const window = await createVenueTableWindow({ id: venueUserId }, venue.venue_id, {
  availability: weeklyAvailability("saturday"), table_count: 1, max_people_per_table: 6, purchase_policy: "No minimum purchase", approval_required: false,
  special_support_offerings: [], special_support_notes: null, environment_notes: null
});
const gmProfile = await selectOne("gm_profiles", { user_id: eq(gmUserId) }, { required: true });
const p1 = await selectOne("player_profiles", { user_id: eq(playerOneUserId) }, { required: true });
const p2 = await selectOne("player_profiles", { user_id: eq(playerTwoUserId) }, { required: true });

async function createEvent({ eventId, tableId = null, title, joinMode = "instant_join", status = "forming", min = 1, max = 1, start, end }) {
  if (tableId) {
    await insertRows("game_tables", [{ id: tableId, game_system_id: SYSTEM_ID, created_by_user_id: gmUserId, source_table_match_id: null, title, lifecycle_status: "forming", game_format: "one_shot", minimum_players: min, maximum_players: max, join_policy: joinMode === "instant_join" ? "open" : "request", visibility: "public", table_style: null, minimum_age: null, gm_profile_id: gmProfile.id, venue_id: venue.venue_id, venue_table_window_id: window.id, proposed_start: start, proposed_end: end, timezone: "America/New_York" }], { returning: false });
  }
  await insertRows("events", [{ id: eventId, game_series_id: null, game_table_id: tableId, table_match_id: null, slug: `${eventId.slice(0, 8)}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, title, description: "Lifecycle transaction integration Event", gm_profile_id: gmProfile.id, game_system_id: SYSTEM_ID, venue_id: venue.venue_id, event_type: "one_shot", join_mode: joinMode, status, starts_at: start, ends_at: end, min_players: min, max_players: max, minimum_age: null, beginner_friendly: true, updated_at: now }], { returning: false });
}

async function addMembership(tableId, profile, status = "invited") {
  await insertRows("game_table_players", [{ game_table_id: tableId, player_profile_id: profile.id, source_player_demand_signal_id: null, status, requested_at: now, responded_at: status === "confirmed" ? now : null, ended_at: null }], { returning: false });
}

async function addBooking(id, eventId, start, end, status = "approved") {
  await insertRows("venue_booking_requests", [{ id, venue_table_window_id: window.id, gm_profile_id: gmProfile.id, table_match_id: null, game_series_id: null, event_id: eventId, requested_start: start, requested_end: end, tables_requested: 1, expected_guests: 1, status, venue_message: null, gm_message: null, updated_at: now }], { returning: false });
}

// A failed late Event synchronization must roll back the new registration and membership change.
const rollbackEvent = "b2000000-0000-4000-8000-000000000001";
const rollbackTable = "b2000000-0000-4000-8000-000000000002";
await createEvent({ eventId: rollbackEvent, tableId: rollbackTable, title: "Request Rollback", start: "2026-10-03T22:00:00Z", end: "2026-10-04T02:00:00Z" });
await addMembership(rollbackTable, p1);
await assert.rejects(() => requestRegistration({ id: playerOneUserId }, rollbackEvent, true), /missing Venue booking/i);
assert.equal(await selectOne("registrations", { event_id: eq(rollbackEvent), player_profile_id: eq(p1.id) }), null);
assert.equal((await selectOne("game_table_players", { game_table_id: eq(rollbackTable), player_profile_id: eq(p1.id) }, { required: true })).status, "invited");

// Two Players racing for one instant-join seat serialize on the Event row: one confirms, one waitlists.
const raceEvent = "b3000000-0000-4000-8000-000000000001";
const raceTable = "b3000000-0000-4000-8000-000000000002";
await createEvent({ eventId: raceEvent, tableId: raceTable, title: "Last Seat Race", max: 1, start: "2026-10-10T22:00:00Z", end: "2026-10-11T02:00:00Z" });
await addMembership(raceTable, p1);
await addMembership(raceTable, p2);
await addBooking("b3000000-0000-4000-8000-000000000003", raceEvent, "2026-10-10T22:00:00Z", "2026-10-11T02:00:00Z", "approved");
const seatRace = await Promise.all([
  requestRegistration({ id: playerOneUserId }, raceEvent, true),
  requestRegistration({ id: playerTwoUserId }, raceEvent, true)
]);
assert.deepEqual(seatRace.map((item) => item.status).sort(), ["confirmed", "waitlisted"]);
const raceRegistrations = await selectMany("registrations", { event_id: eq(raceEvent), limit: 10 });
assert.equal(raceRegistrations.filter((item) => item.status === "confirmed").length, 1);
assert.equal(raceRegistrations.filter((item) => item.status === "waitlisted").length, 1);
assert.equal((await selectOne("events", { id: eq(raceEvent) }, { required: true })).status, "full");

// A GM confirmation that cannot synchronize must roll back both registration and table membership.
const gmEvent = "b4000000-0000-4000-8000-000000000001";
const gmTable = "b4000000-0000-4000-8000-000000000002";
const gmRegistration = "b4000000-0000-4000-8000-000000000003";
await createEvent({ eventId: gmEvent, tableId: gmTable, title: "GM Decision Rollback", joinMode: "request_to_join", start: "2026-10-17T22:00:00Z", end: "2026-10-18T02:00:00Z" });
await addMembership(gmTable, p2);
await insertRows("registrations", [{ id: gmRegistration, event_id: gmEvent, player_profile_id: p2.id, status: "requested", expectations_acknowledged_at: now, requested_at: now, responded_at: null, cancelled_at: null }], { returning: false });
await assert.rejects(() => decideRegistration({ id: gmUserId }, gmEvent, gmRegistration, "confirm"), /missing Venue booking/i);
assert.equal((await selectOne("registrations", { id: eq(gmRegistration) }, { required: true })).status, "requested");
assert.equal((await selectOne("game_table_players", { game_table_id: eq(gmTable), player_profile_id: eq(p2.id) }, { required: true })).status, "invited");

// A Player cancellation that cannot synchronize must also roll back.
const cancelEvent = "b5000000-0000-4000-8000-000000000001";
const cancelTable = "b5000000-0000-4000-8000-000000000002";
const cancelRegistration = "b5000000-0000-4000-8000-000000000003";
await createEvent({ eventId: cancelEvent, tableId: cancelTable, title: "Cancellation Rollback", start: "2026-10-24T22:00:00Z", end: "2026-10-25T02:00:00Z" });
await addMembership(cancelTable, p1, "confirmed");
await insertRows("registrations", [{ id: cancelRegistration, event_id: cancelEvent, player_profile_id: p1.id, status: "confirmed", expectations_acknowledged_at: now, requested_at: now, responded_at: now, cancelled_at: null }], { returning: false });
await assert.rejects(() => cancelMyRegistration({ id: playerOneUserId }, cancelEvent), /missing Venue booking/i);
assert.equal((await selectOne("registrations", { id: eq(cancelRegistration) }, { required: true })).status, "confirmed");
assert.equal((await selectOne("game_table_players", { game_table_id: eq(cancelTable), player_profile_id: eq(p1.id) }, { required: true })).status, "confirmed");

// Competing Venue approvals for the same one-table window serialize on the Venue-window row.
const bookingEventOne = "b6000000-0000-4000-8000-000000000001";
const bookingEventTwo = "b6000000-0000-4000-8000-000000000002";
const bookingOne = "b6000000-0000-4000-8000-000000000003";
const bookingTwo = "b6000000-0000-4000-8000-000000000004";
const bookingStart = "2026-10-31T22:00:00Z";
const bookingEnd = "2026-11-01T02:00:00Z";
await createEvent({ eventId: bookingEventOne, title: "Venue Race One", joinMode: "request_to_join", status: "venue_requested", start: bookingStart, end: bookingEnd });
await createEvent({ eventId: bookingEventTwo, title: "Venue Race Two", joinMode: "request_to_join", status: "venue_requested", start: bookingStart, end: bookingEnd });
await addBooking(bookingOne, bookingEventOne, bookingStart, bookingEnd, "requested");
await addBooking(bookingTwo, bookingEventTwo, bookingStart, bookingEnd, "requested");
const bookingRace = await Promise.allSettled([
  decideVenueBooking({ id: venueUserId }, bookingOne, "approve"),
  decideVenueBooking({ id: venueUserId }, bookingTwo, "approve")
]);
assert.equal(bookingRace.filter((item) => item.status === "fulfilled").length, 1);
assert.equal(bookingRace.filter((item) => item.status === "rejected").length, 1);
const bookingRows = [
  await selectOne("venue_booking_requests", { id: eq(bookingOne) }, { required: true }),
  await selectOne("venue_booking_requests", { id: eq(bookingTwo) }, { required: true })
];
assert.deepEqual(bookingRows.map((item) => item.status).sort(), ["approved", "requested"]);

console.log("Registration, cancellation, GM decision, and Venue capacity transaction/concurrency checks passed.");
