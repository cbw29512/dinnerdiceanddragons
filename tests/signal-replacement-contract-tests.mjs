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
const replacement = source("netlify/functions/_lib/signal-replacement.mjs");
const engine = source("netlify/functions/_lib/matching-engine.mjs");

test("Player demand replacement expires older same-system active signals", () => {
  assert.match(inputs, /table: "player_demand_signals"/);
  assert.match(inputs, /ownerColumn: "player_profile_id"/);
  assert.match(inputs, /keepId: id/);
});

test("GM supply replacement expires older same-system active signals", () => {
  assert.match(inputs, /table: "gm_supply_signals"/);
  assert.match(inputs, /ownerColumn: "gm_profile_id"/);
});

test("superseded signals become expired only after replacement exists", () => {
  assert.match(replacement, /if \(row\.id === keepId\) continue/);
  assert.match(replacement, /status: "expired"/);
  const playerInsert = inputs.indexOf('insertRows("player_demand_signals"');
  const playerExpire = inputs.indexOf('table: "player_demand_signals"');
  const gmInsert = inputs.indexOf('insertRows("gm_supply_signals"');
  const gmExpire = inputs.indexOf('table: "gm_supply_signals"');
  assert.ok(playerInsert >= 0 && playerExpire > playerInsert);
  assert.ok(gmInsert >= 0 && gmExpire > gmInsert);
});

test("matching refresh expires potential opportunities no longer selected", () => {
  assert.match(engine, /async function expireStale/);
  assert.match(engine, /status: "expired"/);
  assert.match(engine, /await expireStale\(windowStart, windowEnd, opportunities\)/);
});

console.log("All signal replacement contract tests passed.");
