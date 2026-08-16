"use strict";

const assert = require("node:assert/strict");

// Minimal browser globals for testing browser modules without third-party packages.
global.window = globalThis;
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); }
};
global.DDD_PLAYER_DEMAND = [];

require("../table-match.js");
require("../table-lifecycle-model.js");
require("../production-onboarding-adapters.js");

let failures = 0;

function test(name, callback) {
  try {
    callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

test("normalizes compatible system editions for matching", () => {
  assert.equal(DDDTableMatch.normalizeSystem("D&D 5e (2014)"), "D&D 5e");
  assert.equal(DDDTableMatch.normalizeSystem("D&D 5e (2024)"), "D&D 5e");
  assert.equal(DDDTableMatch.normalizeSystem("Call of Cthulhu 7e"), "Call of Cthulhu");
  assert.equal(DDDTableMatch.normalizeSystem("Pathfinder 2e"), "Pathfinder 2e");
});

test("enforces GM seat consumption in venue hard fit", () => {
  const fit = DDDTableMatch.hardFit(5, 6);
  assert.equal(fit.playerCapacity, 5);
  assert.equal(fit.usablePlayers, 5);
  assert.equal(fit.viable, true);
  assert.equal(fit.needsPlayers, 0);
});

test("caps usable demand at venue Player capacity", () => {
  const fit = DDDTableMatch.hardFit(8, 4);
  assert.equal(fit.playerCapacity, 3);
  assert.equal(fit.usablePlayers, 3);
  assert.equal(fit.viable, true);
});

test("does not call a table viable below minimum Player demand", () => {
  const fit = DDDTableMatch.hardFit(2, 6);
  assert.equal(fit.viable, false);
  assert.equal(fit.needsPlayers, 1);
});

test("keeps explained match score inside 0-100", () => {
  const best = DDDTableMatch.scoreMatch(5, 0, 25, 6);
  const edge = DDDTableMatch.scoreMatch(3, 25, 25, 6);
  assert.equal(best.total, 100);
  assert.ok(edge.total >= 0 && edge.total <= 100);
  assert.equal(best.demand + best.distance + best.schedule + best.capacity, best.total);
});

test("turns a saved local Player profile into normalized demand signals", () => {
  localStorage.setItem("ddd-preview-player", JSON.stringify({
    player_system: ["D&D 5e (2024)"],
    availability_day: ["Tuesday"],
    availability_start: ["18:00"],
    availability_end: ["22:00"],
    postal_code: "29501",
    radius: "25"
  }));
  const signals = DDDTableMatch.allSignals();
  assert.equal(signals.length, 1);
  assert.equal(signals[0].system, "D&D 5e");
  assert.equal(signals[0].local, true);
  localStorage.clear();
});

test("derives Forming until venue and minimum Players commit", () => {
  const state = DDDLifecycleModel.defaultState();
  state.venueApproved = true;
  state.confirmedPlayers = state.minPlayers - 1;
  assert.equal(DDDLifecycleModel.deriveStatus(state), "forming");
});

test("derives Confirmed only after venue and minimum Players commit", () => {
  const state = DDDLifecycleModel.defaultState();
  state.venueApproved = true;
  state.confirmedPlayers = state.minPlayers;
  assert.equal(DDDLifecycleModel.deriveStatus(state), "confirmed");
});

test("GM cancellation overrides confirmation", () => {
  const state = DDDLifecycleModel.defaultState();
  state.venueApproved = true;
  state.confirmedPlayers = state.minPlayers;
  state.gmAvailable = false;
  assert.equal(DDDLifecycleModel.deriveStatus(state), "cancelled");
});

test("Completed is terminal in lifecycle derivation", () => {
  const state = DDDLifecycleModel.defaultState();
  state.completed = true;
  state.gmAvailable = false;
  assert.equal(DDDLifecycleModel.deriveStatus(state), "completed");
});

test("production Player adapter strips pilot identity and separates future matching fields", () => {
  const mapped = DDDProductionOnboardingAdapters.player({
    user_id: "forged-user",
    player_id: "forged-player",
    email: "player@example.com",
    display_name: "Player One",
    postal_code: "29501",
    radius: "25",
    preferred_format: "One-shot",
    willing_to_learn: "Yes",
    style: "Roleplay-forward",
    notes: "Quieter venue preferred",
    player_system: ["D&D 5e (2024)"],
    player_years: ["2.5"],
    player_comfort: ["Comfortable"],
    player_system_notes: ["Returning player"],
    availability_day: ["Saturday"],
    availability_start: ["18:00"],
    availability_end: ["22:00"],
    availability_pattern: ["weekly"],
    availability_week_interval: ["2"],
    availability_anchor_date: ["2026-08-15"],
    availability_monthly_ordinal: ["First"],
    availability_month_interval: ["1"]
  }, { timezone: "America/New_York" });

  assert.equal(mapped.payload.systems[0].system_slug, "dnd-5e-2024");
  assert.equal(mapped.payload.systems[0].years_playing, 2.5);
  assert.equal(mapped.payload.availability[0].pattern_type, "weekly_interval");
  assert.equal(mapped.payload.availability[0].week_interval, 2);
  assert.equal(mapped.payload.availability[0].anchor_date, "2026-08-15");
  assert.equal(mapped.payload.preferred_format, "one_shot");
  assert.equal(mapped.payload.willing_to_learn_new_system, true);
  assert.equal(Object.hasOwn(mapped.payload, "user_id"), false);
  assert.equal(Object.hasOwn(mapped.payload, "player_id"), false);
  assert.equal(Object.hasOwn(mapped.payload, "email"), false);
  assert.equal(Object.hasOwn(mapped.payload, "style"), false);
  assert.equal(mapped.deferred.table_style_preference, "Roleplay-forward");
  assert.equal(mapped.deferred.matching_and_accessibility_notes, "Quieter venue preferred");
});

test("production GM adapter expands Any format and defers cadence and expectations", () => {
  const mapped = DDDProductionOnboardingAdapters.gm({
    user_id: "forged-user",
    gm_id: "forged-gm",
    email: "gm@example.com",
    display_name: "GM One",
    postal_code: "29501",
    radius: "25",
    cadence: "Weekly",
    style: "Tactical and roleplay-forward",
    welcome: "Beginners welcome",
    expectations: "No PvP",
    gm_system: ["Pathfinder 2e"],
    gm_play_years: ["4"],
    gm_run_years: ["2"],
    gm_comfort: ["Very Comfortable"],
    gm_format: ["Any format"],
    gm_system_notes: ["Teaching friendly"],
    availability_day: ["Sunday"],
    availability_start: ["13:00"],
    availability_end: ["18:00"],
    availability_pattern: ["monthly"],
    availability_week_interval: ["1"],
    availability_anchor_date: [""],
    availability_monthly_ordinal: ["Last"],
    availability_month_interval: ["1"]
  }, { timezone: "America/New_York" });

  assert.equal(mapped.payload.systems[0].system_slug, "pathfinder-2e");
  assert.equal(mapped.payload.systems[0].formats.length, 5);
  assert.equal(mapped.payload.availability[0].pattern_type, "monthly_ordinal_weekday");
  assert.equal(mapped.payload.availability[0].monthly_ordinal, "last");
  assert.equal(Object.hasOwn(mapped.payload, "cadence"), false);
  assert.equal(Object.hasOwn(mapped.payload, "expectations"), false);
  assert.equal(Object.hasOwn(mapped.payload, "email"), false);
  assert.equal(mapped.deferred.preferred_cadence, "Weekly");
  assert.equal(mapped.deferred.table_expectations, "No PvP");
});

test("production Venue adapter keeps table-window supply out of Step 2 payload", () => {
  const mapped = DDDProductionOnboardingAdapters.venue({
    user_id: "forged-user",
    venue_id: "forged-venue",
    email: "venue@example.com",
    business_name: "Florence Game Night Cafe",
    contact_name: "Manager One",
    address: "123 Game Night Way",
    city: "Florence",
    state: "sc",
    postal_code: "29501",
    window_day: "Tuesday",
    window_start: "18:00",
    window_end: "22:00",
    table_count: "1",
    seats_per_table: "6",
    recurrence: "Weekly",
    purchase_policy: "One purchase per guest",
    age_policy: "All ages until 9 PM",
    accessibility: "Accessible entrance and parking",
    approval_required: "on"
  });

  assert.equal(mapped.payload.name, "Florence Game Night Cafe");
  assert.equal(mapped.payload.state_region, "SC");
  assert.equal(mapped.payload.manager_role, "manager");
  assert.equal(Object.hasOwn(mapped.payload, "user_id"), false);
  assert.equal(Object.hasOwn(mapped.payload, "venue_id"), false);
  assert.equal(Object.hasOwn(mapped.payload, "email"), false);
  assert.equal(Object.hasOwn(mapped.payload, "table_count"), false);
  assert.equal(Object.hasOwn(mapped.payload, "approval_required"), false);
  assert.equal(mapped.deferred.table_count, "1");
  assert.equal(mapped.deferred.seats_per_table, "6");
  assert.equal(mapped.deferred.purchase_policy, "One purchase per guest");
  assert.equal(mapped.deferred.approval_required, true);
});

if (failures) {
  console.error(`\n${failures} test${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log("\nAll Dinner, Dice & Dragons unit tests passed.");
require("./production-api-client-tests.js");
