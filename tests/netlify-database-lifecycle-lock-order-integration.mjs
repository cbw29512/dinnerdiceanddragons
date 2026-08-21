import assert from "node:assert/strict";
import { getDatabase } from "@netlify/database";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { requestRegistration } from "../netlify/functions/_lib/registration-lifecycle.mjs";
import { decideVenueBooking } from "../netlify/functions/_lib/venue-booking-lifecycle.mjs";

const SYSTEM_ID = "10000000-0000-0000-0000-000000000002";
const GM_USER_ID = "b1000000-0000-4000-8000-000000000001";
const VENUE_USER_ID = "b1000000-0000-4000-8000-000000000002";
const PLAYER_USER_ID = "b1000000-0000-4000-8000-000000000003";
const EVENT_ID = "b7000000-0000-4000-8000-000000000001";
const TABLE_ID = "b7000000-0000-4000-8000-000000000002";
const BOOKING_ID = "b7000000-0000-4000-8000-000000000003";
const START = "2026-11-14T23:00:00.000Z";
const END = "2026-11-15T03:00:00.000Z";
const NOW = "2026-08-21T23:45:00.000Z";

const gm = await selectOne("gm_profiles", { user_id: eq(GM_USER_ID) }, { required: true });
const player = await selectOne("player_profiles", { user_id: eq(PLAYER_USER_ID) }, { required: true });
const manager = await selectOne("venue_managers", { user_id: eq(VENUE_USER_ID), verified_at: "not.is.null" }, { required: true });
const window = await selectOne("venue_table_windows", { venue_id: eq(manager.venue_id), active: "is.true" }, { required: true });

await insertRows("game_tables", [{
  id: TABLE_ID, game_system_id: SYSTEM_ID, created_by_user_id: GM_USER_ID, source_table_match_id: null,
  title: "Registration Booking Lock Order", lifecycle_status: "forming", game_format: "one_shot",
  minimum_players: 1, maximum_players: 1, join_policy: "open", visibility: "public", table_style: null,
  minimum_age: null, gm_profile_id: gm.id, venue_id: manager.venue_id, venue_table_window_id: window.id,
  proposed_start: START, proposed_end: END, timezone: "America/New_York"
}], { returning: false });
await insertRows("events", [{
  id: EVENT_ID, game_series_id: null, game_table_id: TABLE_ID, table_match_id: null,
  slug: "registration-booking-lock-order", title: "Registration Booking Lock Order",
  description: "Concurrent registration and Venue approval lock-order proof.", gm_profile_id: gm.id,
  game_system_id: SYSTEM_ID, venue_id: manager.venue_id, event_type: "one_shot", join_mode: "instant_join",
  status: "venue_requested", starts_at: START, ends_at: END, min_players: 1, max_players: 1,
  minimum_age: null, beginner_friendly: true, updated_at: NOW
}], { returning: false });
await insertRows("game_table_players", [{
  game_table_id: TABLE_ID, player_profile_id: player.id, source_player_demand_signal_id: null,
  status: "invited", requested_at: NOW, responded_at: null, ended_at: null
}], { returning: false });
await insertRows("venue_booking_requests", [{
  id: BOOKING_ID, venue_table_window_id: window.id, gm_profile_id: gm.id, table_match_id: null,
  game_series_id: null, event_id: EVENT_ID, requested_start: START, requested_end: END,
  tables_requested: 1, expected_guests: 1, status: "requested", venue_message: null, gm_message: null, updated_at: NOW
}], { returning: false });

async function waitForActivity(client, where, label) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const result = await client.query(`SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND ${where} LIMIT 1`);
    if (result.rows.length) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

const database = getDatabase();
const monitor = await database.pool.connect();
try {
  await monitor.query(`
    CREATE OR REPLACE FUNCTION ddd_test_pause_registration() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.event_id = '${EVENT_ID}'::uuid THEN PERFORM pg_sleep(2.0); END IF;
      RETURN NEW;
    END;
    $$
  `);
  await monitor.query("DROP TRIGGER IF EXISTS ddd_test_pause_registration ON registrations");
  await monitor.query(`CREATE TRIGGER ddd_test_pause_registration BEFORE INSERT ON registrations FOR EACH ROW EXECUTE FUNCTION ddd_test_pause_registration()`);

  const registrationPromise = requestRegistration({ id: PLAYER_USER_ID }, EVENT_ID, true);
  await waitForActivity(monitor, `wait_event = 'PgSleep' AND query LIKE 'INSERT INTO "registrations"%'`, "paused registration");
  const bookingPromise = decideVenueBooking({ id: VENUE_USER_ID }, BOOKING_ID, "approve");
  await waitForActivity(monitor, `wait_event_type = 'Lock' AND query LIKE 'SELECT %FROM "events"%FOR UPDATE%'`, "Venue approval waiting on Event");

  const outcomes = await Promise.allSettled([registrationPromise, bookingPromise]);
  assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 2, "Registration and Venue approval must not deadlock.");
} finally {
  await monitor.query("DROP TRIGGER IF EXISTS ddd_test_pause_registration ON registrations");
  await monitor.query("DROP FUNCTION IF EXISTS ddd_test_pause_registration()");
  monitor.release();
}

assert.equal((await selectOne("registrations", { event_id: eq(EVENT_ID), player_profile_id: eq(player.id) }, { required: true })).status, "confirmed");
assert.equal((await selectOne("venue_booking_requests", { id: eq(BOOKING_ID) }, { required: true })).status, "approved");
assert.equal(Number((await selectOne("venue_booking_requests", { id: eq(BOOKING_ID) }, { required: true })).expected_guests), 2);
assert.equal((await selectOne("events", { id: eq(EVENT_ID) }, { required: true })).status, "full");

console.log("Registration and Venue booking lock-order concurrency check passed.");
