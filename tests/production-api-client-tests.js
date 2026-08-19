"use strict";

const assert = require("node:assert/strict");

global.window = globalThis;

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); }
  };
}

global.localStorage = memoryStorage();
global.sessionStorage = memoryStorage();

require("../production-config.js");
require("../production-api-client.js");
require("../production-session-store.js");
require("../production-auth.js");

const SESSION_KEY = "ddd-production-auth-session";
let failures = 0;

async function test(name, callback) {
  try {
    await callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

function clearAuthStorage() {
  localStorage.clear();
  sessionStorage.clear();
}

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload === null ? "" : JSON.stringify(payload);
    }
  };
}

function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

async function run() {
  await test("production API sends bearer token on owner-scoped GET", async () => {
    let captured = null;
    global.fetch = async (url, options) => {
      captured = { url, options };
      return jsonResponse(200, { display_name: "Player One", systems: [], availability: [] });
    };
    DDDProductionAPI.configure({ baseUrl: "https://api.example.test/", accessTokenProvider: async () => "verified-jwt" });
    const body = await DDDProductionAPI.getPlayerOnboarding();
    assert.equal(captured.url, "https://api.example.test/api/v1/onboarding/player");
    assert.equal(captured.options.method, "GET");
    assert.equal(captured.options.headers.Authorization, "Bearer verified-jwt");
    assert.equal(body.display_name, "Player One");
  });

  await test("production API serializes canonical onboarding PUT payload", async () => {
    let captured = null;
    global.fetch = async (url, options) => {
      captured = { url, options };
      return jsonResponse(200, { role: "gm" });
    };
    DDDProductionAPI.configure({ baseUrl: "https://api.example.test", accessTokenProvider: async () => "verified-jwt" });
    const payload = { display_name: "GM One", postal_code: "29501", travel_radius_miles: 25, systems: [], availability: [] };
    await DDDProductionAPI.putGMOnboarding(payload);
    assert.equal(captured.url, "https://api.example.test/api/v1/onboarding/gm");
    assert.equal(captured.options.method, "PUT");
    assert.deepEqual(JSON.parse(captured.options.body), payload);
  });

  await test("production API exposes matching inputs, BOOM refresh, and formation routes", async () => {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(200, { ok: true });
    };
    DDDProductionAPI.configure({ baseUrl: "https://api.example.test", accessTokenProvider: async () => "verified-jwt" });

    const availability = [{
      day_of_week: "tuesday",
      start_time: "18:00",
      end_time: "22:00",
      pattern_type: "weekly_interval",
      week_interval: 1,
      anchor_date: null,
      monthly_ordinal: null,
      month_interval: null,
      timezone: "America/New_York",
      starts_on: null,
      ends_on: null
    }];
    const playerDemand = { system_slug: "dnd-5e-2024", availability, preferred_format: "any" };
    const gmSupply = {
      system_slug: "dnd-5e-2024",
      availability,
      preferred_format: "one_shot",
      minimum_players: 3,
      maximum_players: 5
    };
    const venueWindow = {
      availability: availability[0],
      table_count: 1,
      max_people_per_table: 6,
      approval_required: true
    };
    const formation = {
      title: "Tuesday D&D",
      description: "A production table test.",
      event_type: "one_shot",
      join_mode: "request",
      beginner_friendly: true,
      expected_sessions: 1,
      expectations: {}
    };

    await DDDProductionAPI.postPlayerDemand(playerDemand);
    await DDDProductionAPI.postGMSupply(gmSupply);
    await DDDProductionAPI.postVenueTableWindow("venue-1", venueWindow);
    await DDDProductionAPI.findMyTable(45);
    await DDDProductionAPI.getMatchingOpportunities();
    await DDDProductionAPI.formTableMatch("match-1", formation);

    assert.equal(calls[0].url, "https://api.example.test/api/v1/matching/player-demands");
    assert.deepEqual(JSON.parse(calls[0].options.body), playerDemand);
    assert.equal(calls[1].url, "https://api.example.test/api/v1/matching/gm-supplies");
    assert.deepEqual(JSON.parse(calls[1].options.body), gmSupply);
    assert.equal(calls[2].url, "https://api.example.test/api/v1/matching/venues/venue-1/table-windows");
    assert.deepEqual(JSON.parse(calls[2].options.body), venueWindow);
    assert.equal(calls[3].url, "https://api.example.test/api/v1/matching/find-my-table");
    assert.deepEqual(JSON.parse(calls[3].options.body), { horizon_days: 45 });
    assert.equal(calls[4].url, "https://api.example.test/api/v1/matching/opportunities");
    assert.equal(calls[4].options.method, "GET");
    assert.equal(calls[5].url, "https://api.example.test/api/v1/matching/opportunities/match-1/form");
    assert.deepEqual(JSON.parse(calls[5].options.body), formation);
    calls.forEach(({ options }) => assert.equal(options.headers.Authorization, "Bearer verified-jwt"));
  });

  await test("production API refuses requests without an authenticated session", async () => {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return jsonResponse(500, {});
    };
    DDDProductionAPI.configure({ baseUrl: "https://api.example.test", accessTokenProvider: async () => "" });
    await assert.rejects(() => DDDProductionAPI.getMe(), (error) => {
      assert.equal(error.name, "ProductionApiError");
      assert.equal(error.status, 401);
      assert.match(error.message, /authenticated session/i);
      return true;
    });
    assert.equal(fetchCalled, false);
  });

  await test("production API surfaces structured FastAPI errors", async () => {
    global.fetch = async () => jsonResponse(409, { detail: "That display name is already in use." });
    DDDProductionAPI.configure({ baseUrl: "https://api.example.test", accessTokenProvider: async () => "verified-jwt" });
    await assert.rejects(() => DDDProductionAPI.putPlayerOnboarding({ display_name: "Taken" }), (error) => {
      assert.equal(error.name, "ProductionApiError");
      assert.equal(error.status, 409);
      assert.equal(error.detail, "That display name is already in use.");
      return true;
    });
  });

  await test("production auth fails closed when browser production config is missing", async () => {
    const savedConfig = DDDProductionConfig;
    global.DDDProductionConfig = null;
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return jsonResponse(500, {});
    };
    await assert.rejects(() => DDDProductionAuth.init(), (error) => {
      assert.equal(error.name, "ProductionAuthError");
      assert.match(error.message, /configuration is unavailable/i);
      return true;
    });
    assert.equal(fetchCalled, false);
    global.DDDProductionConfig = savedConfig;
  });

  await test("legacy localStorage session migrates into tab-scoped sessionStorage", async () => {
    clearAuthStorage();
    const now = Math.floor(Date.now() / 1000);
    const token = fakeJwt({ aud: "authenticated", exp: now + 3600, sub: "legacy-user", email: "legacy@example.com" });
    localStorage.setItem(SESSION_KEY, JSON.stringify({ access_token: token, refresh_token: "legacy-refresh", expires_at: now + 3600 }));
    const accessToken = await DDDProductionAuth.getAccessToken();
    assert.equal(accessToken, token);
    assert.equal(localStorage.getItem(SESSION_KEY), null);
    assert.ok(sessionStorage.getItem(SESSION_KEY));
  });

  await test("production auth stores new sessions only in tab-scoped storage", async () => {
    clearAuthStorage();
    const now = Math.floor(Date.now() / 1000);
    const token = fakeJwt({ aud: "authenticated", exp: now + 3600, sub: "auth-user-1", email: "player@example.com" });
    let captured = null;
    global.fetch = async (url, options) => {
      captured = { url, options };
      return jsonResponse(200, {
        access_token: token,
        refresh_token: "refresh-one",
        expires_in: 3600,
        user: { id: "auth-user-1", email: "player@example.com" }
      });
    };
    const session = await DDDProductionAuth.signIn("player@example.com", "test-password");
    assert.match(captured.url, /\/auth\/v1\/token\?grant_type=password$/);
    assert.match(captured.options.headers.apikey, /^sb_publishable_/);
    assert.equal(session.user.email, "player@example.com");
    assert.equal(await DDDProductionAuth.getAccessToken(), token);
    assert.ok(sessionStorage.getItem(SESSION_KEY));
    assert.equal(localStorage.getItem(SESSION_KEY), null);
  });

  await test("production auth keeps rotated refresh token in tab-scoped storage", async () => {
    clearAuthStorage();
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = fakeJwt({ aud: "authenticated", exp: now - 10, sub: "auth-user-2", email: "gm@example.com" });
    const freshToken = fakeJwt({ aud: "authenticated", exp: now + 3600, sub: "auth-user-2", email: "gm@example.com" });
    let call = 0;
    let refreshRequest = null;
    global.fetch = async (url, options) => {
      call += 1;
      if (call === 1) return jsonResponse(200, { access_token: expiredToken, refresh_token: "refresh-old", expires_in: 1 });
      refreshRequest = { url, options };
      return jsonResponse(200, { access_token: freshToken, refresh_token: "refresh-rotated", expires_in: 3600 });
    };
    await DDDProductionAuth.signIn("gm@example.com", "test-password");
    const token = await DDDProductionAuth.getAccessToken();
    assert.equal(token, freshToken);
    assert.match(refreshRequest.url, /\/auth\/v1\/token\?grant_type=refresh_token$/);
    assert.deepEqual(JSON.parse(refreshRequest.options.body), { refresh_token: "refresh-old" });
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    assert.equal(stored.refresh_token, "refresh-rotated");
    assert.equal(localStorage.getItem(SESSION_KEY), null);
  });

  if (failures) {
    console.error(`\n${failures} production API/auth test${failures === 1 ? "" : "s"} failed.`);
    process.exit(1);
  }
  console.log("\nAll production API and browser-auth tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
