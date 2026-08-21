import assert from "node:assert/strict";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { createVenueOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import { createVenueTableWindow } from "../netlify/functions/_lib/matching-inputs.mjs";
import { weeklyAvailability, withUuidSequence } from "./netlify-database-test-helpers.mjs";

const userId = "99999999-9999-4999-8999-999999999995";
await insertRows("users", [{
  id: userId,
  auth_provider_user_id: "integration-venue-window",
  email: "integration-venue-window@example.test",
  status: "active"
}], { returning: false });

const venue = await createVenueOnboarding({ id: userId }, {
  name: "Window Test Library",
  venue_type: "library",
  address_line1: "500 Window St",
  address_line2: null,
  city: "Florence",
  state_region: "SC",
  postal_code: "29505",
  website_url: null,
  phone: null,
  amenities: [],
  host_support_offerings: [],
  host_support_notes: null,
  accessibility_notes: null,
  parking_notes: null,
  noise_notes: null,
  lighting_notes: null,
  manager_role: "manager"
});

const initial = await createVenueTableWindow({ id: userId }, venue.venue_id, {
  availability: weeklyAvailability("thursday"),
  table_count: 1,
  max_people_per_table: 6,
  purchase_policy: "No minimum purchase",
  approval_required: false,
  special_support_offerings: [],
  special_support_notes: null,
  environment_notes: null
});
assert.equal(initial.active, true);

const failedRuleId = "90000000-0000-4000-8000-000000000001";
await assert.rejects(() => withUuidSequence(
  [failedRuleId, initial.id],
  () => createVenueTableWindow({ id: userId }, venue.venue_id, {
    availability: weeklyAvailability("friday"),
    table_count: 2,
    max_people_per_table: 8,
    purchase_policy: "No minimum purchase",
    approval_required: false,
    special_support_offerings: [],
    special_support_notes: null,
    environment_notes: null
  })
));

assert.equal(await selectOne("recurring_availability_rules", { id: eq(failedRuleId) }), null);
const preserved = await selectOne("venue_table_windows", { id: eq(initial.id) }, { required: true });
assert.equal(Boolean(preserved.active), true);
assert.equal(Number(preserved.table_count), 1);

console.log("Venue single-window transaction rollback checks passed.");
