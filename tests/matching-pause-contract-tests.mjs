import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path) {
  try { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }
  catch (error) { console.error(`[DDD Test] Unable to read ${path}`, error); throw error; }
}

function test(name, callback) {
  try { callback(); console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}`); throw error; }
}

const facade = source("netlify/functions/_lib/matching-inputs.mjs");
const playerInputs = source("netlify/functions/_lib/player-matching-inputs.mjs");
const gmInputs = source("netlify/functions/_lib/gm-matching-inputs.mjs");
const participation = source("netlify/functions/_lib/matching-participation.mjs");
const privacy = source("netlify/functions/_lib/privacy-service-core.mjs");
const engine = source("netlify/functions/_lib/matching-engine.mjs");

test("new Player and DM signals inherit the saved pause preference", () => {
  assert.match(facade, /createPlayerDemand, listPlayerDemands/);
  assert.match(facade, /createGMSupply, listGMSupplies/);
  assert.match(playerInputs, /const status = await matchingSignalStatus\(user\.id\)/);
  assert.match(gmInputs, /const status = await matchingSignalStatus\(user\.id\)/);
  assert.match(participation, /return prefs\?\.matching_paused \? "paused" : "active"/);
});

test("saving preferences synchronizes existing Player and DM signals", () => {
  assert.match(privacy, /repository\.syncMatchingPause\(userId, values\.matching_paused\)/);
  assert.match(participation, /player_demand_signals/);
  assert.match(participation, /gm_supply_signals/);
  assert.match(participation, /const from = paused \? "active" : "paused"/);
});

test("matching continues to consume only active signals", () => {
  assert.match(engine, /selectMany\("gm_supply_signals", \{ status: eq\("active"\)/);
  assert.match(engine, /selectMany\("player_demand_signals", \{ status: eq\("active"\)/);
});

console.log("All matching pause contract tests passed.");
