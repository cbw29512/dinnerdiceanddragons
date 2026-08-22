import assert from "node:assert/strict";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { createVenueOnboarding } from "../netlify/functions/_lib/onboarding.mjs";
import {
  listManagedVenues,
  replaceVenueCalendar
} from "../netlify/functions/_lib/managed-venues.mjs";

const userId = "66666666-6666-4666-8666-666666666662";
await insertRows("users", [{
  id: userId,
  auth_provider_user_id: "integration-venue-calendar",
  email: "integration-venue-calendar@example.test",
  status: "active"
}], { returning: false });

const created = await createVenueOnboarding({ id: userId }, {
  name: "Calendar Test Cafe",
  venue_type: "cafe",
  address_line1: "400 Calendar Ave",
  address_line2: null,
  city: "Florence",
  state_region: "SC",
  postal_code: "29504",
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

const availability = {
  day_of_week: "saturday",
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
};

await replaceVenueCalendar({ id: userId }, created.venue_id, {
  availability: [availability],
  table_count: 2,
  max_people_per_table: 8,
  purchase_policy: "Each guest should purchase food or drink",
  environment_notes: "Accessible entrance"
});

let managed = await listManagedVenues({ id: userId });
assert.equal(
  managed.find((item) => item.id === created.venue_id).calendar_ready,
  true
);

const oldWindow = await selectOne("venue_table_windows", {
  venue_id: eq(created.venue_id),
  active: "is.true"
}, { required: true });

async function failWithDuplicateRuleIds(callback) {
  const original = globalThis.crypto.randomUUID;
  const values = [
    "11111111-1111-4111-8111-111111111117",
    "11111111-1111-4111-8111-111111111117",
    "22222222-2222-4222-8222-222222222228"
  ];
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

await assert.rejects(() => failWithDuplicateRuleIds(
  () => replaceVenueCalendar({ id: userId }, created.venue_id, {
    availability: [availability, { ...availability, day_of_week: "sunday" }],
    table_count: 3,
    max_people_per_table: 6,
    purchase_policy: "No minimum purchase",
    environment_notes: null
  })
));

assert.ok(await selectOne("venue_table_windows", {
  id: eq(oldWindow.id),
  active: "is.true"
}));
assert.equal(
  await selectOne("recurring_availability_rules", {
    id: eq("11111111-1111-4111-8111-111111111117")
  }),
  null
);
assert.equal(
  await selectOne("venue_table_windows", {
    id: eq("22222222-2222-4222-8222-222222222228")
  }),
  null
);

managed = await listManagedVenues({ id: userId });
assert.equal(
  managed.find((item) => item.id === created.venue_id).calendar_ready,
  true
);

console.log("Venue calendar transaction and recovery-state checks passed.");
