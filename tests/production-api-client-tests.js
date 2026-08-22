"use strict";

const assert = require("node:assert/strict");

global.window = globalThis;
global.window.location = { origin: "https://dinnerdiceanddragons.netlify.app", hash: "", pathname: "/play.html", search: "" };
global.history = { replaced: null, replaceState(_state, _title, url) { this.replaced = url; } };

require("../production-config.js");
require("../production-api-client.js");
require("../production-auth.js");

let failures = 0;
async function test(name, callback) {
  try { await callback(); console.log(`✓ ${name}`); }
  catch (error) { failures += 1; console.error(`✗ ${name}`); console.error(error); }
}
function jsonResponse(status, payload) {
  return { ok: status >= 200 && status < 300, status, async text() { return payload === null ? "" : JSON.stringify(payload); } };
}

async function run() {
  await test("production config is same-origin Netlify", () => {
    assert.equal(DDDProductionConfig.apiBaseUrl, "https://dinnerdiceanddragons.netlify.app");
  });

  await test("production API sends secure same-origin cookies without bearer tokens", async () => {
    let captured = null;
    global.fetch = async (url, options) => { captured = { url, options }; return jsonResponse(200, { display_name: "Player One", systems: [], availability: [] }); };
    DDDProductionAPI.configure({ baseUrl: DDDProductionConfig.apiBaseUrl });
    const body = await DDDProductionAPI.getPlayerOnboarding();
    assert.equal(captured.url, "https://dinnerdiceanddragons.netlify.app/api/v1/onboarding/player");
    assert.equal(captured.options.method, "GET");
    assert.equal(captured.options.credentials, "same-origin");
    assert.equal(captured.options.headers.Authorization, undefined);
    assert.equal(body.display_name, "Player One");
  });

  await test("production API serializes canonical onboarding PUT payload", async () => {
    let captured = null;
    global.fetch = async (url, options) => { captured = { url, options }; return jsonResponse(200, { role: "gm" }); };
    DDDProductionAPI.configure({ baseUrl: DDDProductionConfig.apiBaseUrl });
    const payload = { display_name: "GM One", postal_code: "29501", travel_radius_miles: 25, systems: [], availability: [] };
    await DDDProductionAPI.putGMOnboarding(payload);
    assert.equal(captured.url, "https://dinnerdiceanddragons.netlify.app/api/v1/onboarding/gm");
    assert.equal(captured.options.method, "PUT");
    assert.equal(captured.options.credentials, "same-origin");
    assert.deepEqual(JSON.parse(captured.options.body), payload);
  });

  await test("production API exposes matching inputs, BOOM refresh, and formation routes", async () => {
    const calls = [];
    global.fetch = async (url, options) => { calls.push({ url, options }); return jsonResponse(200, { ok: true }); };
    DDDProductionAPI.configure({ baseUrl: DDDProductionConfig.apiBaseUrl });
    const availability = [{ day_of_week: "tuesday", start_time: "18:00", end_time: "22:00", pattern_type: "weekly_interval", week_interval: 1, anchor_date: null, monthly_ordinal: null, month_interval: null, timezone: "America/New_York", starts_on: null, ends_on: null }];
    const playerDemand = { system_slug: "dnd-5e-2024", availability, preferred_format: "any" };
    const gmSupply = { system_slug: "dnd-5e-2024", availability, preferred_format: "one_shot", minimum_players: 3, maximum_players: 5 };
    const venueWindow = { availability: availability[0], table_count: 1, max_people_per_table: 6, approval_required: false };
    const formation = { title: "Tuesday D&D", description: "A production table test.", event_type: "one_shot", join_mode: "request", beginner_friendly: true, expected_sessions: 1, expectations: {} };

    await DDDProductionAPI.postPlayerDemand(playerDemand);
    await DDDProductionAPI.postGMSupply(gmSupply);
    await DDDProductionAPI.postVenueTableWindow("venue-1", venueWindow);
    await DDDProductionAPI.findMyTable(45);
    await DDDProductionAPI.getMatchingOpportunities();
    await DDDProductionAPI.formTableMatch("match-1", formation);

    assert.equal(calls[0].url, "https://dinnerdiceanddragons.netlify.app/api/v1/matching/player-demands");
    assert.deepEqual(JSON.parse(calls[0].options.body), playerDemand);
    assert.equal(calls[1].url, "https://dinnerdiceanddragons.netlify.app/api/v1/matching/gm-supplies");
    assert.deepEqual(JSON.parse(calls[1].options.body), gmSupply);
    assert.equal(calls[2].url, "https://dinnerdiceanddragons.netlify.app/api/v1/matching/venues/venue-1/table-windows");
    assert.deepEqual(JSON.parse(calls[2].options.body), venueWindow);
    assert.equal(calls[3].url, "https://dinnerdiceanddragons.netlify.app/api/v1/matching/find-my-table");
    assert.deepEqual(JSON.parse(calls[3].options.body), { horizon_days: 45 });
    assert.equal(calls[4].url, "https://dinnerdiceanddragons.netlify.app/api/v1/matching/opportunities");
    assert.equal(calls[4].options.method, "GET");
    assert.equal(calls[5].url, "https://dinnerdiceanddragons.netlify.app/api/v1/matching/opportunities/match-1/form");
    assert.deepEqual(JSON.parse(calls[5].options.body), formation);
    calls.forEach(({ options }) => assert.equal(options.credentials, "same-origin"));
  });

  await test("production API surfaces server authentication errors", async () => {
    global.fetch = async () => jsonResponse(401, { detail: "An authenticated session is required." });
    DDDProductionAPI.configure({ baseUrl: DDDProductionConfig.apiBaseUrl });
    await assert.rejects(() => DDDProductionAPI.getMe(), (error) => {
      assert.equal(error.name, "ProductionApiError"); assert.equal(error.status, 401); assert.match(error.message, /authenticated session/i); return true;
    });
  });

  await test("production API surfaces structured lifecycle errors", async () => {
    global.fetch = async () => jsonResponse(409, { detail: "That display name is already in use." });
    DDDProductionAPI.configure({ baseUrl: DDDProductionConfig.apiBaseUrl });
    await assert.rejects(() => DDDProductionAPI.putPlayerOnboarding({ display_name: "Taken" }), (error) => {
      assert.equal(error.name, "ProductionApiError"); assert.equal(error.status, 409); assert.equal(error.detail, "That display name is already in use."); return true;
    });
  });

  await test("Netlify Identity sign-in is server-side and cookie-backed", async () => {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/api/v1/auth/login")) return jsonResponse(200, { authenticated: true, id: "identity-1", email: "player@example.com" });
      if (url.endsWith("/api/v1/auth/session")) return jsonResponse(200, { authenticated: true, id: "identity-1", email: "player@example.com" });
      return jsonResponse(404, {});
    };
    const session = await DDDProductionAuth.signIn("player@example.com", "test-password");
    assert.equal(session.user.email, "player@example.com");
    assert.equal(session.access_token, "netlify-identity-cookie");
    assert.equal(await DDDProductionAuth.getAccessToken(), "");
    assert.equal(calls[0].url, "https://dinnerdiceanddragons.netlify.app/api/v1/auth/login");
    assert.equal(calls[0].options.credentials, "same-origin");
    assert.deepEqual(JSON.parse(calls[0].options.body), { email: "player@example.com", password: "test-password" });
    assert.equal(calls[1].url, "https://dinnerdiceanddragons.netlify.app/api/v1/auth/session");
  });

  await test("Netlify Identity signup returns confirmation-required account", async () => {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/api/v1/auth/signup")) return jsonResponse(201, { status: "confirmation_required", email: "new@example.com" });
      if (url.endsWith("/api/v1/auth/session")) return jsonResponse(200, { authenticated: false });
      return jsonResponse(404, {});
    };
    const result = await DDDProductionAuth.signUp("new@example.com", "test-password");
    assert.equal(result.session, null);
    assert.equal(result.user.email, "new@example.com");
    assert.equal(calls[0].options.credentials, "same-origin");
  });

  await test("confirmation is consumed without assuming a browser session", async () => {
    window.location.hash = "#confirmation_token=one-time-token";
    history.replaced = null;
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("/api/v1/auth/confirm")) return jsonResponse(200, { confirmed: true, id: "identity-2", email: "confirmed@example.com" });
      throw new Error(`Unexpected auth request after confirmation: ${url}`);
    };
    const session = await DDDProductionAuth.getSession();
    assert.equal(history.replaced, "/play.html");
    assert.equal(session, null);
    assert.equal(DDDProductionAuth.didConfirmEmail(), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://dinnerdiceanddragons.netlify.app/api/v1/auth/confirm");
    assert.deepEqual(JSON.parse(calls[0].options.body), { token: "one-time-token" });
    window.location.hash = "";
  });

  await test("sign-out clears the server Identity session", async () => {
    let captured = null;
    global.fetch = async (url, options) => { captured = { url, options }; return jsonResponse(204, null); };
    await DDDProductionAuth.signOut();
    assert.equal(captured.url, "https://dinnerdiceanddragons.netlify.app/api/v1/auth/logout");
    assert.equal(captured.options.method, "POST");
    assert.equal(captured.options.credentials, "same-origin");
  });

  if (failures) {
    console.error(`\n${failures} production API/auth test${failures === 1 ? "" : "s"} failed.`);
    process.exit(1);
  }
  console.log("\nAll production API and Netlify Identity browser tests passed.");
}

run().catch((error) => { console.error(error); process.exit(1); });