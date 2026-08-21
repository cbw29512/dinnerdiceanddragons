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

const inputs = source("netlify/functions/_lib/matching-inputs.mjs");
const engine = source("netlify/functions/_lib/matching-engine.mjs");
const onboarding = source("production-onboarding.js");

test("Venue managers can persist their own windows before verification", () => {
  assert.match(inputs, /managedVenue\(user\.id, safeVenueId, \{ verified: false \}\)/);
  assert.match(inputs, /matching_eligible: Boolean\(venue\.verified\)/);
});

test("matching still excludes unverified Venues", () => {
  assert.match(engine, /selectOne\("venues", \{ id: eq\(window\.venue_id\), active: "is\.true", verified: "is\.true" \}\)/);
});

test("Venue onboarding saves windows to the server immediately", () => {
  assert.match(onboarding, /venueWindows = await saveVenueWindows/);
  assert.match(onboarding, /postVenueTableWindow\(venueId, payload\)/);
  assert.doesNotMatch(onboarding, /localStorage/);
  assert.doesNotMatch(onboarding, /PENDING_VENUE_WINDOW_KEY/);
});

console.log("All pending Venue window contract tests passed.");
