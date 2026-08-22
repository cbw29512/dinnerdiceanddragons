import assert from "node:assert/strict";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { savePlayerOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import { createPlayerDemand } from "../netlify/functions/_lib/matching-inputs.mjs";
import { weeklyAvailability, withUuidSequence } from "./netlify-database-test-helpers.mjs";

const userId = "77777777-7777-4777-8777-777777777773";
await insertRows("users", [{
  id: userId,
  auth_provider_user_id: "integration-player-demand",
  email: "integration-player-demand@example.test",
  status: "active"
}], { returning: false });

await savePlayerOnboarding({ id: userId, display_name: null }, {
  display_name: "Demand Player",
  bio: null,
  postal_code: "29501",
  travel_radius_miles: 25,
  preferred_format: "any",
  willing_to_learn_new_system: true,
  environment_preferences: [],
  accessibility_notes_private: null,
  systems: [{
    system_slug: "dnd-5e-2024",
    years_playing: 1,
    comfort_level: "learning",
    experience_notes: null
  }],
  availability: [weeklyAvailability("friday")]
});

const initial = await createPlayerDemand({ id: userId }, {
  system_slug: "dnd-5e-2024",
  availability: [weeklyAvailability("friday")],
  preferred_format: "any",
  preferred_cadence: "weekly",
  minimum_age_preference: null,
  table_style_preferences: [],
  environment_preferences: []
});
assert.equal(initial.status, "active");

const failedSignalId = "70000000-0000-4000-8000-000000000001";
const duplicateRuleId = "70000000-0000-4000-8000-000000000002";
const firstLinkId = "70000000-0000-4000-8000-000000000003";
await assert.rejects(() => withUuidSequence(
  [failedSignalId, duplicateRuleId, duplicateRuleId, firstLinkId],
  () => createPlayerDemand({ id: userId }, {
    system_slug: "dnd-5e-2024",
    availability: [weeklyAvailability("saturday"), weeklyAvailability("sunday")],
    preferred_format: "one_shot",
    preferred_cadence: "weekly",
    minimum_age_preference: null,
    table_style_preferences: [],
    environment_preferences: []
  })
));

assert.equal(await selectOne("player_demand_signals", { id: eq(failedSignalId) }), null);
assert.equal(await selectOne("recurring_availability_rules", { id: eq(duplicateRuleId) }), null);
assert.equal(await selectOne("player_demand_availability_windows", { id: eq(firstLinkId) }), null);
const preserved = await selectOne("player_demand_signals", { id: eq(initial.id) }, { required: true });
assert.equal(preserved.status, "active");

console.log("Player demand transaction and superseded-signal rollback checks passed.");
