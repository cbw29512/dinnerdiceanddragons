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

const facade = source("netlify/functions/_lib/matching-inputs.mjs");
const playerInputs = source("netlify/functions/_lib/player-matching-inputs.mjs");
const gmInputs = source("netlify/functions/_lib/gm-matching-inputs.mjs");
const replacement = source("netlify/functions/_lib/signal-replacement.mjs");
const engine = source("netlify/functions/_lib/matching-engine.mjs");

test("Player demand replacement expires older same-system active signals", () => {
  assert.match(facade, /createPlayerDemand, listPlayerDemands/);
  assert.match(playerInputs, /table: "player_demand_signals"/);
  assert.match(playerInputs, /ownerColumn: "player_profile_id"/);
  assert.match(playerInputs, /keepId: id/);
  assert.match(playerInputs, /return withTransaction\(async \(\) =>/);
});

test("GM supply replacement expires older same-system active signals", () => {
  assert.match(facade, /createGMSupply, listGMSupplies/);
  assert.match(gmInputs, /table: "gm_supply_signals"/);
  assert.match(gmInputs, /ownerColumn: "gm_profile_id"/);
  assert.match(gmInputs, /keepId: id/);
  assert.match(gmInputs, /return withTransaction\(async \(\) =>/);
});

test("superseded signals become expired only after replacement exists", () => {
  assert.match(replacement, /row\.id === keepId/);
  assert.match(replacement, /!REPLACEABLE\.has\(row\.status\)/);
  assert.match(replacement, /status: "expired"/);

  const playerInsert = playerInputs.indexOf('insertRows("player_demand_signals"');
  const playerExpire = playerInputs.indexOf('table: "player_demand_signals"');
  const gmInsert = gmInputs.indexOf('insertRows("gm_supply_signals"');
  const gmExpire = gmInputs.indexOf('table: "gm_supply_signals"');
  assert.ok(playerInsert >= 0 && playerExpire > playerInsert);
  assert.ok(gmInsert >= 0 && gmExpire > gmInsert);
});

test("matching refresh expires potential opportunities no longer selected", () => {
  assert.match(engine, /async function expireStale/);
  assert.match(engine, /status: "expired"/);
  assert.match(engine, /await expireStale\(windowStart, windowEnd, opportunities\)/);
});

console.log("All signal replacement contract tests passed.");
