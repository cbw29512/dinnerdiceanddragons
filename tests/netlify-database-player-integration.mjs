import assert from "node:assert/strict";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import {
  loadPlayerOnboarding,
  savePlayerOnboarding
} from "../netlify/functions/_lib/onboarding.mjs";

const goodUserId = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const badUserId = "dddddddd-dddd-4ddd-8ddd-ddddddddddd4";

await insertRows("users", [
  {
    id: goodUserId,
    auth_provider_user_id: "integration-player-good",
    email: "integration-player-good@example.test",
    status: "active"
  },
  {
    id: badUserId,
    auth_provider_user_id: "integration-player-bad",
    email: "integration-player-bad@example.test",
    status: "active"
  }
], { returning: false });

const availability = [{
  day_of_week: "friday",
  start_time: "18:00",
  end_time: "22:00",
  pattern_type: "weekly_interval",
  week_interval: 1,
  anchor_date: null,
  monthly_ordinal: null,
  month_interval: null,
  timezone: "America/New_York",
  starts_on: null,
  ends_on: null
}];

const validPayload = {
  display_name: "Integration Player",
  bio: null,
  postal_code: "29501",
  travel_radius_miles: 25,
  preferred_format: "one_shot",
  willing_to_learn_new_system: true,
  environment_preferences: [],
  accessibility_notes_private: null,
  systems: [{
    system_slug: "dnd-5e-2024",
    years_playing: 1,
    comfort_level: "learning",
    experience_notes: null
  }],
  availability
};

const saved = await savePlayerOnboarding(
  { id: goodUserId, display_name: null },
  validPayload
);
assert.equal(saved.role, "player");
assert.equal(saved.availability_count, 1);
assert.deepEqual(saved.system_slugs, ["dnd-5e-2024"]);

const savedUser = await selectOne("users", { id: eq(goodUserId) }, { required: true });
const loaded = await loadPlayerOnboarding(savedUser);
assert.equal(loaded.display_name, "Integration Player");
assert.equal(loaded.postal_code, "29501");
assert.equal(loaded.travel_radius_miles, 25);
assert.equal(loaded.systems.length, 1);
assert.equal(loaded.availability.length, 1);

const invalidPayload = {
  ...validPayload,
  display_name: "Rollback Player",
  systems: [
    validPayload.systems[0],
    {
      system_slug: "dnd-5e-2014",
      years_playing: 0,
      comfort_level: "not_a_real_comfort_level",
      experience_notes: null
    }
  ]
};

await assert.rejects(
  () => savePlayerOnboarding({ id: badUserId, display_name: null }, invalidPayload),
  /comfort_level is invalid/i
);

assert.equal(await selectOne("player_profiles", { user_id: eq(badUserId) }), null);
assert.equal(
  await selectOne("user_roles", { user_id: eq(badUserId), role: eq("player") }),
  null
);
const rolledBackUser = await selectOne("users", { id: eq(badUserId) }, { required: true });
assert.equal(rolledBackUser.display_name, null);
assert.equal(rolledBackUser.display_name_normalized, null);

console.log("Player onboarding Netlify Database integration and rollback checks passed.");
