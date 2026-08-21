import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import api from "../netlify/functions/api.mjs";
import authApi from "../netlify/functions/auth-api.mjs";
import { normalizeAvailability } from "../netlify/functions/_lib/availability.mjs";
import { occurrenceDates, occurrences, intersect } from "../netlify/functions/_lib/matching-calendar.mjs";
import { pathParts } from "../netlify/functions/_lib/http.mjs";

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

await test("native API health fails closed when Netlify Database is unavailable", async () => {
  const response = await api(new Request("https://ddd-contract.netlify.app/api/v1/health"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "degraded",
    runtime: "netlify-functions",
    database: "netlify-database",
    identity: "netlify-identity",
    version: "v1"
  });
});

await test("dedicated auth route returns JSON validation errors instead of HTML", async () => {
  const response = await authApi(new Request("https://ddd-contract.netlify.app/auth-api/v1/auth/login", {
    method: "POST",
    headers: {
      Origin: "https://ddd-contract.netlify.app",
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ email: "not-an-email", password: "password123" })
  }));
  assert.equal(response.status, 422);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  const payload = await response.json();
  assert.match(String(payload?.detail || ""), /valid email/i);
});

test("native API path parsing strips the version prefix", () => {
  const parts = pathParts(new Request("https://ddd-contract.netlify.app/api/v1/matching/opportunities/abc"));
  assert.deepEqual(parts, ["matching", "opportunities", "abc"]);
});

await test("production runtime is Netlify-native and provider-clean", async () => {
  const [apiSource, authProxySource, authSource, databaseSource, browserAuthSource, configSource] = await Promise.all([
    readFile(new URL("../netlify/functions/api.mjs", import.meta.url), "utf8"),
    readFile(new URL("../netlify/functions/auth-api.mjs", import.meta.url), "utf8"),
    readFile(new URL("../netlify/functions/_lib/auth.mjs", import.meta.url), "utf8"),
    readFile(new URL("../netlify/functions/_lib/database.mjs", import.meta.url), "utf8"),
    readFile(new URL("../production-auth.js", import.meta.url), "utf8"),
    readFile(new URL("../production-config.js", import.meta.url), "utf8")
  ]);

  assert.match(databaseSource, /@netlify\/database/);
  assert.match(authSource, /@netlify\/identity/);
  assert.match(apiSource, /verifyRequestOrigin/);
  assert.match(apiSource, /confirmEmail/);
  assert.match(authProxySource, /path:\s*"\/auth-api\/\*"/);
  assert.match(authProxySource, /content-type.*application\/json/is);
  assert.match(browserAuthSource, /credentials:\s*"same-origin"/);
  assert.match(browserAuthSource, /confirmation_token/);
  assert.match(configSource, /apiBaseUrl:\s*window\.location\.origin/);

  for (const source of [apiSource, authProxySource, authSource, databaseSource, browserAuthSource, configSource]) {
    assert.doesNotMatch(source, /supabase\.co|sb_publishable_|SUPABASE_SECRET_KEY/);
  }
});

test("weekly recurrence expands deterministically", () => {
  const rule = {
    active: true,
    day_of_week: "friday",
    start_time: "18:00:00",
    end_time: "22:00:00",
    pattern_type: "weekly_interval",
    week_interval: 1,
    anchor_date: null,
    monthly_ordinal: null,
    month_interval: null,
    timezone: "America/New_York",
    starts_on: null,
    ends_on: null
  };
  assert.deepEqual(occurrenceDates(rule, "2026-08-19", "2026-09-05"), [
    "2026-08-21",
    "2026-08-28",
    "2026-09-04"
  ]);
});

test("alternating weekly recurrence honors its anchor", () => {
  const rule = {
    active: true,
    day_of_week: "saturday",
    start_time: "18:00:00",
    end_time: "22:00:00",
    pattern_type: "weekly_interval",
    week_interval: 2,
    anchor_date: "2026-08-15",
    monthly_ordinal: null,
    month_interval: null,
    timezone: "America/New_York",
    starts_on: null,
    ends_on: null
  };
  assert.deepEqual(occurrenceDates(rule, "2026-08-15", "2026-09-12"), [
    "2026-08-15",
    "2026-08-29",
    "2026-09-12"
  ]);
});

test("monthly ordinal recurrence expands deterministically", () => {
  const rule = {
    active: true,
    day_of_week: "sunday",
    start_time: "13:00:00",
    end_time: "18:00:00",
    pattern_type: "monthly_ordinal_weekday",
    week_interval: null,
    anchor_date: null,
    monthly_ordinal: "last",
    month_interval: 1,
    timezone: "America/New_York",
    starts_on: null,
    ends_on: null
  };
  assert.deepEqual(occurrenceDates(rule, "2026-08-01", "2026-10-31"), [
    "2026-08-30",
    "2026-09-27",
    "2026-10-25"
  ]);
});

test("timezone conversion produces real UTC instants and overlap", () => {
  const base = {
    active: true,
    day_of_week: "friday",
    pattern_type: "weekly_interval",
    week_interval: 1,
    anchor_date: null,
    monthly_ordinal: null,
    month_interval: null,
    timezone: "America/New_York",
    starts_on: null,
    ends_on: null
  };
  const gm = occurrences({ ...base, start_time: "18:00:00", end_time: "22:00:00" }, "2026-08-21", "2026-08-21")[0];
  const venue = occurrences({ ...base, start_time: "17:00:00", end_time: "23:00:00" }, "2026-08-21", "2026-08-21")[0];
  const overlap = intersect(gm, venue);
  assert.ok(overlap);
  assert.equal(overlap.startAt.toISOString(), "2026-08-21T22:00:00.000Z");
  assert.equal(overlap.endAt.toISOString(), "2026-08-22T02:00:00.000Z");
});

test("availability validation rejects overlapping clock reversal", () => {
  assert.throws(() => normalizeAvailability({
    day_of_week: "friday",
    start_time: "22:00",
    end_time: "18:00",
    pattern_type: "weekly_interval",
    week_interval: 1,
    timezone: "America/New_York"
  }), /start time must be before end time/i);
});

if (failures) {
  console.error(`\n${failures} native Netlify API contract test${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log("\nAll native Netlify API contract tests passed.");