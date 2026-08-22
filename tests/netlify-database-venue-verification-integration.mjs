import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { eq, insertRows, selectOne, updateRows } from "../netlify/functions/_lib/database.mjs";
import { listPendingVenueClaims, verifyVenueClaim } from "../netlify/functions/_lib/venue-verification.mjs";
import { withUuidSequence } from "./netlify-database-test-helpers.mjs";

const adminId = "d1000000-0000-4000-8000-000000000001";
const managerUserId = "d1000000-0000-4000-8000-000000000002";
const venueId = "d2000000-0000-4000-8000-000000000001";
const managerId = "d3000000-0000-4000-8000-000000000001";
const collisionAuditId = "d4000000-0000-4000-8000-000000000001";
const successAuditId = "d4000000-0000-4000-8000-000000000002";

await insertRows("users", [
  { id: adminId, auth_provider_user_id: "integration-venue-admin", email: "venue-admin@example.test", display_name: "Venue Admin", status: "active" },
  { id: managerUserId, auth_provider_user_id: "integration-venue-manager", email: "venue-manager@example.test", display_name: "Venue Manager", status: "active" }
], { returning: false });
await insertRows("user_roles", [{ user_id: adminId, role: "admin", verified_at: new Date().toISOString() }], { returning: false });
await insertRows("venues", [{
  id: venueId,
  name: "Verification Test Cafe",
  slug: "verification-test-cafe-d2000000",
  venue_type: "cafe",
  address_line1: "100 West Evans Street",
  address_line2: null,
  city: "Florence",
  state_region: "SC",
  postal_code: "29501",
  latitude: null,
  longitude: null,
  website_url: null,
  phone: "843-555-0100",
  verified: false,
  amenities: [],
  accessibility_notes: null,
  parking_notes: null,
  noise_notes: null,
  lighting_notes: null,
  active: true
}], { returning: false });
await insertRows("venue_managers", [{
  id: managerId,
  venue_id: venueId,
  user_id: managerUserId,
  role: "manager",
  verified_at: null
}], { returning: false });

const pending = await listPendingVenueClaims({ id: adminId });
assert.equal(pending.length, 1);
assert.equal(pending[0].venue_id, venueId);
assert.equal(pending[0].venue_manager_id, managerId);
assert.equal(pending[0].name, "Verification Test Cafe");
assert.equal(pending[0].manager_email, "venue-manager@example.test");
assert.equal(pending[0].manager_account_status, "active");
assert.equal(Object.hasOwn(pending[0], "user_id"), false);
await assert.rejects(() => listPendingVenueClaims({ id: managerUserId }), /permission/i);
await updateRows("users", { id: eq(managerUserId) }, { status: "suspended" });
await assert.rejects(() => verifyVenueClaim({ id: adminId }, venueId, managerId), /not active/i);
await updateRows("users", { id: eq(managerUserId) }, { status: "active" });

await insertRows("privileged_audit_events", [{
  id: collisionAuditId,
  actor_user_id: adminId,
  actor_role: "admin",
  action: "integration.collision",
  target_type: "venue_manager",
  target_id: managerId,
  outcome: "success",
  reason_code: "fixture"
}], { returning: false });

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  assert.match(String(url), /geocoding\.geo\.census\.gov/);
  return new Response(JSON.stringify({
    result: { addressMatches: [{ coordinates: { x: -79.7626, y: 34.1954 } }] }
  }), { status: 200, headers: { "content-type": "application/json" } });
};

try {
  await assert.rejects(
    () => withUuidSequence([collisionAuditId], () => verifyVenueClaim({ id: adminId }, venueId, managerId)),
    /already exists/i
  );

  const rolledBackVenue = await selectOne("venues", { id: eq(venueId) }, { required: true });
  const rolledBackManager = await selectOne("venue_managers", { id: eq(managerId) }, { required: true });
  assert.equal(rolledBackVenue.verified, false);
  assert.equal(rolledBackVenue.latitude, null);
  assert.equal(rolledBackVenue.longitude, null);
  assert.equal(rolledBackManager.verified_at, null);

  await withUuidSequence([successAuditId], () => verifyVenueClaim({ id: adminId }, venueId, managerId));

  const verifiedVenue = await selectOne("venues", { id: eq(venueId) }, { required: true });
  const verifiedManager = await selectOne("venue_managers", { id: eq(managerId) }, { required: true });
  const audit = await selectOne("privileged_audit_events", { id: eq(successAuditId) }, { required: true });
  assert.equal(verifiedVenue.verified, true);
  assert.equal(Number(verifiedVenue.latitude), 34.1954);
  assert.equal(Number(verifiedVenue.longitude), -79.7626);
  assert.ok(verifiedManager.verified_at);
  assert.equal(audit.action, "venue.verify_initial_claim");
  assert.equal((await listPendingVenueClaims({ id: adminId })).length, 0);

} finally {
  globalThis.fetch = originalFetch;
}

const [apiSource, clientSource, adminPage] = await Promise.all([
  readFile(new URL("../netlify/functions/api.mjs", import.meta.url), "utf8"),
  readFile(new URL("../production-api-client.js", import.meta.url), "utf8"),
  readFile(new URL("../admin-venues.html", import.meta.url), "utf8")
]);
assert.match(apiSource, /listPendingVenueClaims/);
assert.match(apiSource, /pending-claims/);
assert.match(clientSource, /getPendingVenueClaims/);
assert.match(clientSource, /verifyVenueClaim/);
assert.match(adminPage, /id="pending-venue-list"/);

console.log("Admin Venue queue and atomic verification rollback checks passed.");
