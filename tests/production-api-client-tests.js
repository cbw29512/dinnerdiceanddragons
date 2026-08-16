"use strict";

const assert = require("node:assert/strict");

global.window = globalThis;
if (!global.localStorage) {
  const authStorage = new Map();
  global.localStorage = {
    getItem(key) { return authStorage.has(key) ? authStorage.get(key) : null; },
    setItem(key, value) { authStorage.set(key, String(value)); },
    removeItem(key) { authStorage.delete(key); },
    clear() { authStorage.clear(); }
  };
}
require("../production-api-client.js");
require("../production-auth.js");

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
      return jsonResponse(200, {
        display_name: "Player One",
        systems: [],
        availability: []
      });
    };

    DDDProductionAPI.configure({
      baseUrl: "https://api.example.test/",
      accessTokenProvider: async () => "verified-jwt"
    });
    const body = await DDDProductionAPI.getPlayerOnboarding();

    assert.equal(captured.url, "https://api.example.test/api/v1/onboarding/player");
    assert.equal(captured.options.method, "GET");
    assert.equal(captured.options.headers.Authorization, "Bearer verified-jwt");
    assert.equal(captured.options.headers.Accept, "application/json");
    assert.equal(Object.hasOwn(captured.options, "body"), false);
    assert.equal(body.display_name, "Player One");
  });

  await test("production API serializes canonical onboarding PUT payload", async () => {
    let captured = null;
    global.fetch = async (url, options) => {
      captured = { url, options };
      return jsonResponse(200, { role: "gm" });
    };

    DDDProductionAPI.configure({
      baseUrl: "https://api.example.test",
      accessTokenProvider: async () => "verified-jwt"
    });
    const payload = {
      display_name: "GM One",
      postal_code: "29501",
      travel_radius_miles: 25,
      systems: [],
      availability: []
    };
    await DDDProductionAPI.putGMOnboarding(payload);

    assert.equal(captured.url, "https://api.example.test/api/v1/onboarding/gm");
    assert.equal(captured.options.method, "PUT");
    assert.equal(captured.options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(captured.options.body), payload);
  });

  await test("production API refuses requests without an authenticated session", async () => {
    let fetchCalled = false;
    global.fetch = async () => {
      fetchCalled = true;
      return jsonResponse(500, {});
    };

    DDDProductionAPI.configure({
      baseUrl: "https://api.example.test",
      accessTokenProvider: async () => ""
    });

    await assert.rejects(
      () => DDDProductionAPI.getMe(),
      (error) => {
        assert.equal(error.name, "ProductionApiError");
        assert.equal(error.status, 401);
        assert.match(error.message, /authenticated session/i);
        return true;
      }
    );
    assert.equal(fetchCalled, false);
  });

  await test("production API surfaces structured FastAPI errors", async () => {
    global.fetch = async () => jsonResponse(409, { detail: "That display name is already in use." });

    DDDProductionAPI.configure({
      baseUrl: "https://api.example.test",
      accessTokenProvider: async () => "verified-jwt"
    });

    await assert.rejects(
      () => DDDProductionAPI.putPlayerOnboarding({ display_name: "Taken" }),
      (error) => {
        assert.equal(error.name, "ProductionApiError");
        assert.equal(error.status, 409);
        assert.equal(error.detail, "That display name is already in use.");
        assert.equal(error.message, "That display name is already in use.");
        return true;
      }
    );
  });

  await test("production API rejects invalid JSON responses", async () => {
    global.fetch = async () => ({
      ok: true,
      status: 200,
      async text() {
        return "not-json";
      }
    });

    DDDProductionAPI.configure({
      baseUrl: "https://api.example.test",
      accessTokenProvider: async () => "verified-jwt"
    });

    await assert.rejects(
      () => DDDProductionAPI.getMe(),
      (error) => {
        assert.equal(error.name, "ProductionApiError");
        assert.equal(error.status, 200);
        assert.match(error.message, /invalid response/i);
        return true;
      }
    );
  });

  await test("production auth signs in with the public Supabase key and stores the session", async () => {
    localStorage.clear();
    const now = Math.floor(Date.now() / 1000);
    const token = fakeJwt({
      aud: "authenticated",
      exp: now + 3600,
      sub: "auth-user-1",
      email: "player@example.com",
      role: "authenticated"
    });
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
    assert.deepEqual(JSON.parse(captured.options.body), {
      email: "player@example.com",
      password: "test-password"
    });
    assert.equal(session.user.email, "player@example.com");
    assert.equal(await DDDProductionAuth.getAccessToken(), token);
    assert.ok(localStorage.getItem("ddd-production-auth-session"));
  });

  await test("production auth refreshes an expired access token before API use", async () => {
    localStorage.clear();
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = fakeJwt({
      aud: "authenticated",
      exp: now - 10,
      sub: "auth-user-2",
      email: "gm@example.com",
      role: "authenticated"
    });
    const freshToken = fakeJwt({
      aud: "authenticated",
      exp: now + 3600,
      sub: "auth-user-2",
      email: "gm@example.com",
      role: "authenticated"
    });
    let call = 0;
    let refreshRequest = null;
    global.fetch = async (url, options) => {
      call += 1;
      if (call === 1) {
        return jsonResponse(200, {
          access_token: expiredToken,
          refresh_token: "refresh-old",
          expires_in: 1
        });
      }
      refreshRequest = { url, options };
      return jsonResponse(200, {
        access_token: freshToken,
        refresh_token: "refresh-rotated",
        expires_in: 3600
      });
    };

    await DDDProductionAuth.signIn("gm@example.com", "test-password");
    const token = await DDDProductionAuth.getAccessToken();

    assert.equal(token, freshToken);
    assert.match(refreshRequest.url, /\/auth\/v1\/token\?grant_type=refresh_token$/);
    assert.deepEqual(JSON.parse(refreshRequest.options.body), { refresh_token: "refresh-old" });
    const stored = JSON.parse(localStorage.getItem("ddd-production-auth-session"));
    assert.equal(stored.refresh_token, "refresh-rotated");
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
