import assert from "node:assert/strict";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { createVenueOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import { listManagedVenues } from "../netlify/functions/_lib/managed-venues.mjs";

const goodUserId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5";
const badUserId = "ffffffff-ffff-4fff-8fff-fffffffffff6";

await insertRows("users", [
  {
    id: goodUserId,
    auth_provider_user_id: "integration-venue-good",
    email: "integration-venue-good@example.test",
    status: "active"
  },
  {
    id: badUserId,
    auth_provider_user_id: "integration-venue-bad",
    email: "integration-venue-bad@example.test",
    status: "active"
  }
], { returning: false });

async function withUuidSequence(values, callback) {
  const original = globalThis.crypto.randomUUID;
  let index = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => values[index++] || original.call(globalThis.crypto)
  });
  try {
    return await callback();
  } finally {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: original
    });
  }
}

const venuePayload = {
  name: "Integration Community Center",
  venue_type: "community_center",
  address_line1: "100 Tabletop Way",
  address_line2: null,
  city: "Florence",
  state_region: "SC",
  postal_code: "29501",
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
};

const created = await createVenueOnboarding({ id: goodUserId }, venuePayload);
const venue = await selectOne("venues", { id: eq(created.venue_id) }, { required: true });
assert.equal(venue.venue_type, "community_center");
const managed = await listManagedVenues({ id: goodUserId });
assert.equal(
  managed.find((item) => item.id === created.venue_id).calendar_ready,
  false
);

const collisionVenueId = "33333333-3333-4333-8333-333333333339";
await withUuidSequence(
  [collisionVenueId, "44444444-4444-4444-8444-444444444440"],
  () => createVenueOnboarding({ id: goodUserId }, {
    ...venuePayload,
    name: "Rollback Hall",
    address_line1: "200 First Address",
    postal_code: "29502"
  })
);

await assert.rejects(() => withUuidSequence(
  [collisionVenueId, "55555555-5555-4555-8555-555555555551"],
  () => createVenueOnboarding({ id: badUserId }, {
    ...venuePayload,
    name: "Rollback Hall",
    address_line1: "300 Second Address",
    postal_code: "29503"
  })
));

assert.equal(
  await selectOne("user_roles", { user_id: eq(badUserId), role: eq("venue_manager") }),
  null
);
assert.equal(await selectOne("venues", { postal_code: eq("29503") }), null);
assert.equal(await selectOne("venue_managers", { user_id: eq(badUserId) }), null);

console.log("Venue onboarding transaction and canonical type checks passed.");
