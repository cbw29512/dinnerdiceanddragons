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

if (failures) {
  console.error(`\n${failures} test${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log("\nAll Dinner, Dice & Dragons unit tests passed.");
