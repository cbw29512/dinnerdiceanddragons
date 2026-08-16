"use strict";

const assert = require("node:assert/strict");

global.window = globalThis;
require("../production-api-client.js");

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

  if (failures) {
    console.error(`\n${failures} production API client test${failures === 1 ? "" : "s"} failed.`);
    process.exit(1);
  }

  console.log("\nAll production API client tests passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
