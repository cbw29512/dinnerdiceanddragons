import assert from "node:assert/strict";

import {
  classifyDatabaseError,
  databaseErrorCode,
  eq,
  insertRows,
  selectOne
} from "../netlify/functions/_lib/database.mjs";
import { loadGMOnboarding, saveGMOnboarding } from "../netlify/functions/_lib/onboarding.mjs";

function wrappedPostgresError(code) {
  const postgres = Object.assign(new Error("database rejected query"), { code });
  return new Error("wrapped database query failed", { cause: postgres });
}

const nested = wrappedPostgresError("23505");
assert.equal(databaseErrorCode(nested), "23505");
const classified = classifyDatabaseError(nested);
assert.equal(classified.status, 409);
assert.deepEqual(classified.detail, { code: "23505" });
const schemaFailure = classifyDatabaseError(wrappedPostgresError("42P01"));
assert.equal(schemaFailure.status, 503);
assert.deepEqual(schemaFailure.detail, { code: "42P01" });

const goodUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const badUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
await insertRows("users", [
  { id: goodUserId, auth_provider_user_id: "integration-gm-good", email: "integration-gm-good@example.test", status: "active" },
  { id: badUserId, auth_provider_user_id: "integration-gm-bad", email: "integration-gm-bad@example.test", status: "active" }
], { returning: false });

const availability = [
  { day_of_week: "saturday", start_time: "18:00", end_time: "22:00", pattern_type: "weekly_interval", week_interval: 1, anchor_date: null, monthly_ordinal: null, month_interval: null, timezone: "America/New_York", starts_on: null, ends_on: null },
  { day_of_week: "sunday", start_time: "18:00", end_time: "22:00", pattern_type: "weekly_interval", week_interval: 1, anchor_date: null, monthly_ordinal: null, month_interval: null, timezone: "America/New_York", starts_on: null, ends_on: null }
];
const validPayload = {
  display_name: "Integration GM", bio: null, postal_code: "29501", travel_radius_miles: 50, beginner_friendly: false,
  gm_style: "Balanced mix of roleplay and combat",
  systems: [{ system_slug: "dnd-5e-2014", years_playing: 0, years_gming: 0, comfort_level: "comfortable", preferred_player_experience: "new_players", formats: ["one_shot"], experience_notes: null }],
  availability
};
const saved = await saveGMOnboarding({ id: goodUserId, display_name: null }, validPayload);
assert.equal(saved.role, "gm");
assert.equal(saved.availability_count, 2);
assert.deepEqual(saved.system_slugs, ["dnd-5e-2014"]);
const savedUser = await selectOne("users", { id: eq(goodUserId) }, { required: true });
const loaded = await loadGMOnboarding(savedUser);
assert.equal(loaded.display_name, "Integration GM");
assert.equal(loaded.postal_code, "29501");
assert.equal(loaded.travel_radius_miles, 50);
assert.equal(loaded.systems.length, 1);
assert.deepEqual(loaded.systems[0].formats, ["one_shot"]);
assert.equal(loaded.systems[0].preferred_player_experience, "new_players");
assert.equal(loaded.availability.length, 2);

const invalidPayload = { ...validPayload, display_name: "Rollback GM", systems: [validPayload.systems[0], { ...validPayload.systems[0], system_slug: "dnd-5e-2024", formats: ["not_a_real_format"] }] };
await assert.rejects(() => saveGMOnboarding({ id: badUserId, display_name: null }, invalidPayload), /format is invalid/i);
assert.equal(await selectOne("gm_profiles", { user_id: eq(badUserId) }), null);
assert.equal(await selectOne("user_roles", { user_id: eq(badUserId), role: eq("gm") }), null);
const rolledBackUser = await selectOne("users", { id: eq(badUserId) }, { required: true });
assert.equal(rolledBackUser.display_name, null);
assert.equal(rolledBackUser.display_name_normalized, null);
console.log("GM onboarding Netlify Database integration and rollback checks passed.");

await import("./netlify-database-player-integration.mjs");
await import("./netlify-database-venue-onboarding-integration.mjs");
await import("./netlify-database-venue-calendar-integration.mjs");
await import("./netlify-database-matching-inputs-integration.mjs");
await import("./netlify-database-game-on-integration.mjs");
await import("./netlify-database-game-on-concurrency-integration.mjs");
await import("./netlify-database-lifecycle-integration.mjs");
await import("./netlify-database-lifecycle-lock-order-integration.mjs");
