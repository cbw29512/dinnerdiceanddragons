import assert from "node:assert/strict";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { saveGMOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import { createGMSupply } from "../netlify/functions/_lib/matching-inputs.mjs";
import { weeklyAvailability, withUuidSequence } from "./netlify-database-test-helpers.mjs";

const userId = "88888888-8888-4888-8888-888888888884";
await insertRows("users", [{
  id: userId,
  auth_provider_user_id: "integration-gm-supply",
  email: "integration-gm-supply@example.test",
  status: "active"
}], { returning: false });

await saveGMOnboarding({ id: userId, display_name: null }, {
  display_name: "Supply GM",
  bio: null,
  postal_code: "29501",
  travel_radius_miles: 50,
  beginner_friendly: true,
  gm_style: "Balanced",
  systems: [{
    system_slug: "dnd-5e-2014",
    years_playing: 10,
    years_gming: 5,
    comfort_level: "expert",
    preferred_player_experience: "new_players",
    formats: ["one_shot"],
    experience_notes: null
  }],
  availability: [weeklyAvailability("saturday")]
});

const initial = await createGMSupply({ id: userId }, {
  system_slug: "dnd-5e-2014",
  availability: [weeklyAvailability("saturday")],
  preferred_format: "one_shot",
  preferred_cadence: "weekly",
  minimum_players: 15,
  maximum_players: 15,
  table_style: "Balanced"
});
assert.equal(initial.status, "active");
assert.equal(initial.minimum_players, 15);
assert.equal(initial.maximum_players, 15);

const failedSignalId = "80000000-0000-4000-8000-000000000001";
const duplicateRuleId = "80000000-0000-4000-8000-000000000002";
const firstLinkId = "80000000-0000-4000-8000-000000000003";
await assert.rejects(() => withUuidSequence(
  [failedSignalId, duplicateRuleId, duplicateRuleId, firstLinkId],
  () => createGMSupply({ id: userId }, {
    system_slug: "dnd-5e-2014",
    availability: [weeklyAvailability("sunday"), weeklyAvailability("monday")],
    preferred_format: "one_shot",
    preferred_cadence: "weekly",
    minimum_players: 6,
    maximum_players: 6,
    table_style: "Combat-forward"
  })
));

assert.equal(await selectOne("gm_supply_signals", { id: eq(failedSignalId) }), null);
assert.equal(await selectOne("recurring_availability_rules", { id: eq(duplicateRuleId) }), null);
assert.equal(await selectOne("gm_supply_availability_windows", { id: eq(firstLinkId) }), null);
const preserved = await selectOne("gm_supply_signals", { id: eq(initial.id) }, { required: true });
assert.equal(preserved.status, "active");
assert.equal(Number(preserved.minimum_players), 15);
assert.equal(Number(preserved.maximum_players), 15);

console.log("GM supply transaction and superseded-signal rollback checks passed.");
