import assert from "node:assert/strict";
import {
  applyUserDecision,
  formationProgress,
  normalizeResponse,
  OpportunityResponseStateError
} from "../netlify/functions/_lib/opportunity-response-state.mjs";
import {
  parseOpportunityDecision,
  publicNotification,
  PrivacyApiContractError
} from "../netlify/functions/_lib/privacy-api-contract.mjs";
import { publicVenueLocation } from "../netlify/functions/_lib/venue-location-kind.mjs";

function test(name, callback) {
  try {
    callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const future = "2030-08-24T03:00:00.000Z";
const now = "2030-08-23T20:00:00.000Z";
const base = (user_id, role, decision = "pending") => ({ user_id, role, decision, expires_at: future });

test("DM + Venue + two Players is not BOOM when minimum is three", () => {
  const progress = formationProgress([
    base("gm-1", "gm", "accepted"),
    base("venue-1", "venue_manager", "accepted"),
    base("p-1", "player", "accepted"),
    base("p-2", "player", "accepted"),
    base("p-3", "player", "pending")
  ], 3);
  assert.equal(progress.gmAccepted, true);
  assert.equal(progress.venueAccepted, true);
  assert.equal(progress.acceptedPlayers, 2);
  assert.equal(progress.formed, false);
});

test("third accepted Player triggers BOOM threshold", () => {
  const progress = formationProgress([
    base("gm-1", "gm", "accepted"),
    base("venue-1", "venue_manager", "accepted"),
    base("p-1", "player", "accepted"),
    base("p-2", "player", "accepted"),
    base("p-3", "player", "accepted")
  ], 3);
  assert.equal(progress.acceptedPlayers, 3);
  assert.equal(progress.formed, true);
});

test("formation never succeeds without the Venue", () => {
  const progress = formationProgress([
    base("gm-1", "gm", "accepted"),
    base("venue-1", "venue_manager", "pending"),
    base("p-1", "player", "accepted"),
    base("p-2", "player", "accepted"),
    base("p-3", "player", "accepted")
  ], 3);
  assert.equal(progress.formed, false);
});

test("multi-role opportunity requests require an explicit role", () => {
  assert.deepEqual(parseOpportunityDecision({ role: "gm", decision: "accepted" }), {
    role: "gm",
    decision: "accepted"
  });
  assert.throws(
    () => parseOpportunityDecision({ decision: "accepted" }),
    PrivacyApiContractError
  );
});

test("closed or expired responses cannot be reopened", () => {
  assert.throws(
    () => applyUserDecision(base("p-1", "player", "declined"), "accepted", now),
    OpportunityResponseStateError
  );
  assert.throws(
    () => applyUserDecision({ ...base("p-1", "player"), expires_at: "2030-08-23T19:00:00.000Z" }, "accepted", now),
    OpportunityResponseStateError
  );
});

test("safe notifications cannot contain private contact or location fields", () => {
  const safe = publicNotification({
    id: "n-1",
    type: "match_available",
    state: "queued",
    payload: { title: "A table fits your schedule", table_match_id: "match-1" }
  });
  assert.equal(safe.payload.title, "A table fits your schedule");
  for (const payload of [
    { email: "private@example.test" },
    { phone: "555-0100" },
    { postal_code: "29501" },
    { user_id: "private-user" },
    { private_notes: "secret" }
  ]) {
    assert.throws(
      () => publicNotification({ id: "n-2", type: "match_available", state: "queued", payload }),
      PrivacyApiContractError
    );
  }
});

test("opportunity Venue projection exposes locality but never street or contact data", () => {
  const venue = publicVenueLocation({
    name: "Browser Test Cafe",
    city: "Florence",
    state_region: "SC",
    address_line1: "123 Public Table Way",
    postal_code: "29501",
    contact_email: "manager@example.test",
    contact_phone: "555-0100"
  }, { formed: true });
  assert.deepEqual(venue, {
    name: "Browser Test Cafe",
    location_kind: "public_venue",
    location_label: "Public venue",
    city: "Florence",
    state_region: "SC"
  });
  assert.equal(Object.hasOwn(venue, "address_line1"), false);
  assert.equal(Object.hasOwn(venue, "postal_code"), false);
  assert.equal(Object.hasOwn(venue, "contact_email"), false);
  assert.equal(Object.hasOwn(venue, "contact_phone"), false);
});

test("response normalization rejects unsupported roles", () => {
  assert.throws(() => normalizeResponse(base("x", "moderator")), OpportunityResponseStateError);
});

console.log("All privacy matching tests passed.");
