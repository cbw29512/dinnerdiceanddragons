import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  try {
    return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  } catch (error) {
    console.error(`[DDD Test] Unable to read ${path}`, error);
    throw error;
  }
}

function test(name, callback) {
  try {
    callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const inputsFacade = source("netlify/functions/_lib/matching-inputs.mjs");
const venueInputs = source("netlify/functions/_lib/venue-matching-inputs.mjs");
const engine = source("netlify/functions/_lib/matching-engine.mjs");
const onboarding = source("production-onboarding.js");
const venueOnboarding = source("production-venue-onboarding.js");

test("Venue managers can persist their own windows before verification", () => {
  assert.match(inputsFacade, /createVenueTableWindow, listVenueTableWindows/);
  assert.match(venueInputs, /managedVenue\(user\.id, safeVenueId, \{ verified: false \}\)/);
  assert.match(venueInputs, /matching_eligible: Boolean\(venue\.verified\)/);
});

test("matching still excludes unverified Venues", () => {
  assert.match(engine, /selectOne\("venues", \{ id: eq\(window\.venue_id\), active: "is\.true", verified: "is\.true" \}\)/);
});

test("Venue onboarding saves the full calendar to the server immediately and atomically", () => {
  assert.match(onboarding, /venueWindows = await tools\.saveVenueWindows/);
  assert.match(venueOnboarding, /putVenueTableWindows\(/);
  assert.match(venueOnboarding, /calendarPayload\(payloads\)/);
  assert.doesNotMatch(onboarding, /localStorage/);
  assert.doesNotMatch(venueOnboarding, /localStorage/);
  assert.doesNotMatch(onboarding, /PENDING_VENUE_WINDOW_KEY/);
  assert.doesNotMatch(venueOnboarding, /PENDING_VENUE_WINDOW_KEY/);
});

console.log("All pending Venue window contract tests passed.");
