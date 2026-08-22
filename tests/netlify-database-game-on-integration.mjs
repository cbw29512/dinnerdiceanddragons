import assert from "node:assert/strict";

import { deleteRows, eq, insertRows, selectMany, selectOne } from "../netlify/functions/_lib/database.mjs";
import { replaceGameReminders } from "../netlify/functions/_lib/game-reminders.mjs";
import { formAcceptedTableMatch } from "../netlify/functions/_lib/matched-event-formation.mjs";
import { createGMSupply, createPlayerDemand, createVenueTableWindow } from "../netlify/functions/_lib/matching-inputs.mjs";
import { createVenueOnboarding, saveGMOnboarding, savePlayerOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import { privacyService } from "../netlify/functions/_lib/privacy-service.mjs";
import { weeklyAvailability, withUuidSequence } from "./netlify-database-test-helpers.mjs";

const SYSTEM_ID = "10000000-0000-0000-0000-000000000002";
const gmUserId = "a1000000-0000-4000-8000-000000000001";
const venueUserId = "a1000000-0000-4000-8000-000000000002";
const playerOneUserId = "a1000000-0000-4000-8000-000000000003";
const playerTwoUserId = "a1000000-0000-4000-8000-000000000004";

await insertRows("users", [
  { id: gmUserId, auth_provider_user_id: "integration-game-on-gm", email: "game-on-gm@example.test", status: "active" },
  { id: venueUserId, auth_provider_user_id: "integration-game-on-venue", email: "game-on-venue@example.test", status: "active" },
  { id: playerOneUserId, auth_provider_user_id: "integration-game-on-player-1", email: "game-on-player-1@example.test", status: "active" },
  { id: playerTwoUserId, auth_provider_user_id: "integration-game-on-player-2", email: "game-on-player-2@example.test", status: "active" }
], { returning: false });

await saveGMOnboarding({ id: gmUserId, display_name: null }, {
  display_name: "GAME ON GM", bio: null, postal_code: "29501", travel_radius_miles: 25,
  beginner_friendly: true, gm_style: "Balanced",
  systems: [{ system_slug: "dnd-5e-2024", years_playing: 5, years_gming: 3, comfort_level: "expert", preferred_player_experience: "any", formats: ["one_shot"], experience_notes: null }],
  availability: [weeklyAvailability("saturday")]
});

for (const [userId, name] of [[playerOneUserId, "GAME ON Player One"], [playerTwoUserId, "GAME ON Player Two"]]) {
  await savePlayerOnboarding({ id: userId, display_name: null }, {
    display_name: name, bio: null, postal_code: "29501", travel_radius_miles: 25,
    preferred_format: "any", willing_to_learn_new_system: true,
    environment_preferences: [], accessibility_notes_private: null,
    systems: [{ system_slug: "dnd-5e-2024", years_playing: 1, comfort_level: "learning", experience_notes: null }],
    availability: [weeklyAvailability("saturday")]
  });
}

const venue = await createVenueOnboarding({ id: venueUserId }, {
  name: "GAME ON Library", venue_type: "library", address_line1: "900 Game On Way", address_line2: null,
  city: "Florence", state_region: "SC", postal_code: "29501", website_url: null, phone: null,
  amenities: [], host_support_offerings: [], host_support_notes: null, accessibility_notes: null,
  parking_notes: null, noise_notes: null, lighting_notes: null, manager_role: "manager"
});
const window = await createVenueTableWindow({ id: venueUserId }, venue.venue_id, {
  availability: weeklyAvailability("saturday"), table_count: 1, max_people_per_table: 6,
  purchase_policy: "No minimum purchase", approval_required: false,
  special_support_offerings: [], special_support_notes: null, environment_notes: null
});
const supply = await createGMSupply({ id: gmUserId }, {
  system_slug: "dnd-5e-2024", availability: [weeklyAvailability("saturday")], preferred_format: "one_shot",
  preferred_cadence: "weekly", minimum_players: 2, maximum_players: 2, table_style: "Balanced"
});
const demandOne = await createPlayerDemand({ id: playerOneUserId }, {
  system_slug: "dnd-5e-2024", availability: [weeklyAvailability("saturday")], preferred_format: "any",
  preferred_cadence: "weekly", minimum_age_preference: null, table_style_preferences: [], environment_preferences: []
});
const demandTwo = await createPlayerDemand({ id: playerTwoUserId }, {
  system_slug: "dnd-5e-2024", availability: [weeklyAvailability("saturday")], preferred_format: "any",
  preferred_cadence: "weekly", minimum_age_preference: null, table_style_preferences: [], environment_preferences: []
});

const gmProfile = await selectOne("gm_profiles", { user_id: eq(gmUserId) }, { required: true });
const playerOneProfile = await selectOne("player_profiles", { user_id: eq(playerOneUserId) }, { required: true });
const playerTwoProfile = await selectOne("player_profiles", { user_id: eq(playerTwoUserId) }, { required: true });
const matchId = "a2000000-0000-4000-8000-000000000001";
const gameTableId = "a2000000-0000-4000-8000-000000000002";
const proposedStart = "2026-09-05T22:00:00.000Z";
const proposedEnd = "2026-09-06T02:00:00.000Z";

await insertRows("table_matches", [{
  id: matchId, gm_supply_signal_id: supply.id, venue_table_window_id: window.id, game_system_id: SYSTEM_ID,
  proposed_start: proposedStart, proposed_end: proposedEnd, timezone: "America/New_York",
  minimum_players: 2, maximum_players: 2, compatible_player_count: 2,
  distance_summary: {}, fit_score: 100, status: "potential"
}], { returning: false });
await insertRows("table_match_players", [
  { table_match_id: matchId, player_demand_signal_id: demandOne.id, fit_flags: [], distance_miles: 1, availability_overlap: {}, status: "notified" },
  { table_match_id: matchId, player_demand_signal_id: demandTwo.id, fit_flags: [], distance_miles: 1, availability_overlap: {}, status: "notified" }
], { returning: false });
await insertRows("game_tables", [{
  id: gameTableId, game_system_id: SYSTEM_ID, created_by_user_id: gmUserId, source_table_match_id: matchId,
  title: "Pre-Formation Table", lifecycle_status: "forming", game_format: "one_shot",
  minimum_players: 2, maximum_players: 2, join_policy: "request", visibility: "public", table_style: "Balanced",
  minimum_age: null, gm_profile_id: gmProfile.id, venue_id: venue.venue_id, venue_table_window_id: window.id,
  proposed_start: proposedStart, proposed_end: proposedEnd, timezone: "America/New_York"
}], { returning: false });
await insertRows("game_table_players", [
  { game_table_id: gameTableId, player_profile_id: playerOneProfile.id, source_player_demand_signal_id: demandOne.id, status: "invited", requested_at: proposedStart, responded_at: null, ended_at: null },
  { game_table_id: gameTableId, player_profile_id: playerTwoProfile.id, source_player_demand_signal_id: demandTwo.id, status: "invited", requested_at: proposedStart, responded_at: null, ended_at: null }
], { returning: false });

const offeredAt = "2026-08-21T20:00:00.000Z";
const expiresAt = "2027-01-01T00:00:00.000Z";
await insertRows("opportunity_responses", [
  { id: "a3000000-0000-4000-8000-000000000001", table_match_id: matchId, user_id: gmUserId, role: "gm", decision: "accepted", offered_at: offeredAt, responded_at: offeredAt, expires_at: expiresAt, updated_at: offeredAt },
  { id: "a3000000-0000-4000-8000-000000000002", table_match_id: matchId, user_id: venueUserId, role: "venue_manager", decision: "accepted", offered_at: offeredAt, responded_at: offeredAt, expires_at: expiresAt, updated_at: offeredAt },
  { id: "a3000000-0000-4000-8000-000000000003", table_match_id: matchId, user_id: playerTwoUserId, role: "player", decision: "accepted", offered_at: offeredAt, responded_at: offeredAt, expires_at: expiresAt, updated_at: offeredAt },
  { id: "a3000000-0000-4000-8000-000000000004", table_match_id: matchId, user_id: playerOneUserId, role: "player", decision: "pending", offered_at: offeredAt, responded_at: null, expires_at: expiresAt, updated_at: offeredAt }
], { returning: false });

const duplicateNotificationId = "a4000000-0000-4000-8000-000000000001";
await insertRows("notifications", [{
  id: duplicateNotificationId, user_id: gmUserId, table_match_id: matchId, event_id: null,
  type: "table_formed", state: "queued", channel: "in_app", payload: { fixture: true }, expires_at: null
}], { returning: false });

await assert.rejects(() => withUuidSequence(
  [duplicateNotificationId],
  () => privacyService.respond(playerOneUserId, matchId, "player", "accepted")
));
let playerOneResponse = await selectOne("opportunity_responses", { table_match_id: eq(matchId), user_id: eq(playerOneUserId), role: eq("player") }, { required: true });
assert.equal(playerOneResponse.decision, "pending");
let match = await selectOne("table_matches", { id: eq(matchId) }, { required: true });
assert.equal(match.status, "potential");
await deleteRows("notifications", { id: eq(duplicateNotificationId) });

const accepted = await privacyService.respond(playerOneUserId, matchId, "player", "accepted");
assert.equal(accepted.table_status, "forming");
playerOneResponse = await selectOne("opportunity_responses", { table_match_id: eq(matchId), user_id: eq(playerOneUserId), role: eq("player") }, { required: true });
assert.equal(playerOneResponse.decision, "accepted");
match = await selectOne("table_matches", { id: eq(matchId) }, { required: true });
assert.equal(match.status, "forming");
assert.ok((await selectMany("notifications", { table_match_id: eq(matchId), type: eq("table_formed"), limit: 20 })).length >= 4);

const playerOriginalReminders = await selectMany("game_reminders", { user_id: eq(playerOneUserId), table_match_id: eq(matchId), order: "minutes_before.desc" });
assert.deepEqual(playerOriginalReminders.map((row) => Number(row.minutes_before)), [1440, 60]);
const gmReminder = await selectOne("game_reminders", { user_id: eq(gmUserId), table_match_id: eq(matchId) }, { required: true });
await assert.rejects(() => withUuidSequence(
  [gmReminder.id, "a4000000-0000-4000-8000-000000000099"],
  () => replaceGameReminders({ id: playerOneUserId }, matchId, [120, 60])
));
const playerRemindersAfterFailure = await selectMany("game_reminders", { user_id: eq(playerOneUserId), table_match_id: eq(matchId), order: "minutes_before.desc" });
assert.deepEqual(playerRemindersAfterFailure.map((row) => Number(row.minutes_before)), [1440, 60]);

const dummyEventId = "a5000000-0000-4000-8000-000000000001";
const duplicateRegistrationId = "a5000000-0000-4000-8000-000000000002";
await insertRows("events", [{
  id: dummyEventId, game_series_id: null, game_table_id: null, table_match_id: null, slug: "game-on-rollback-fixture",
  title: "Rollback Fixture", description: "Fixture Event", gm_profile_id: gmProfile.id, game_system_id: SYSTEM_ID,
  venue_id: venue.venue_id, event_type: "one_shot", join_mode: "request_to_join", status: "forming",
  starts_at: "2026-09-12T22:00:00.000Z", ends_at: "2026-09-13T02:00:00.000Z",
  min_players: 1, max_players: 1, minimum_age: null, beginner_friendly: true, updated_at: offeredAt
}], { returning: false });
await insertRows("registrations", [{
  id: duplicateRegistrationId, event_id: dummyEventId, player_profile_id: playerOneProfile.id,
  status: "requested", expectations_acknowledged_at: null, requested_at: offeredAt, responded_at: null, cancelled_at: null
}], { returning: false });

const failedEventId = "a6000000-0000-4000-8000-000000000001";
const failedExpectationId = "a6000000-0000-4000-8000-000000000002";
const failedBookingId = "a6000000-0000-4000-8000-000000000003";
const firstRegistrationId = "a6000000-0000-4000-8000-000000000004";
await assert.rejects(() => withUuidSequence(
  [failedEventId, failedExpectationId, failedBookingId, firstRegistrationId, duplicateRegistrationId],
  () => formAcceptedTableMatch({ id: gmUserId }, matchId, {
    title: "Atomic GAME ON", description: "This Event must be all or nothing.",
    event_type: "one_shot", join_mode: "request_to_join", minimum_age: null,
    beginner_friendly: true, expected_sessions: 1, gm_message: null,
    expectations: { play_style: "Balanced cooperative play", boundaries: "Respect table boundaries." }
  })
));

assert.equal(await selectOne("events", { id: eq(failedEventId) }), null);
assert.equal(await selectOne("events", { table_match_id: eq(matchId) }), null);
assert.equal(await selectOne("table_expectations", { id: eq(failedExpectationId) }), null);
assert.equal(await selectOne("venue_booking_requests", { id: eq(failedBookingId) }), null);
assert.equal(await selectOne("registrations", { id: eq(firstRegistrationId) }), null);
const preservedTable = await selectOne("game_tables", { id: eq(gameTableId) }, { required: true });
assert.equal(preservedTable.title, "Pre-Formation Table");
assert.equal(preservedTable.lifecycle_status, "forming");
match = await selectOne("table_matches", { id: eq(matchId) }, { required: true });
assert.equal(match.status, "forming");
const playerOneMembership = await selectOne("game_table_players", { game_table_id: eq(gameTableId), player_profile_id: eq(playerOneProfile.id) }, { required: true });
const playerTwoMembership = await selectOne("game_table_players", { game_table_id: eq(gameTableId), player_profile_id: eq(playerTwoProfile.id) }, { required: true });
assert.equal(playerOneMembership.status, "invited");
assert.equal(playerTwoMembership.status, "invited");
const matchPlayerOne = await selectOne("table_match_players", { table_match_id: eq(matchId), player_demand_signal_id: eq(demandOne.id) }, { required: true });
const matchPlayerTwo = await selectOne("table_match_players", { table_match_id: eq(matchId), player_demand_signal_id: eq(demandTwo.id) }, { required: true });
assert.equal(matchPlayerOne.status, "notified");
assert.equal(matchPlayerTwo.status, "notified");
assert.equal((await selectOne("registrations", { id: eq(duplicateRegistrationId) }, { required: true })).event_id, dummyEventId);

console.log("GAME ON response, reminder, and Event formation transaction rollback checks passed.");
