import assert from "node:assert/strict";

import api from "../netlify/functions/api.mjs";
import { normalizeAvailability } from "../netlify/functions/_lib/availability.mjs";
import { occurrenceDates, occurrences, intersect } from "../netlify/functions/_lib/matching-calendar.mjs";
import { pathParts } from "../netlify/functions/_lib/http.mjs";
import { secretKey } from "../netlify/functions/_lib/supabase-rest.mjs";

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

test("native API owns the same-origin health route", async () => {
  const response = await api(new Request("https://ddd-contract.netlify.app/api/v1/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    runtime: "netlify-functions",
    version: "v1"
  });
});

test("native API path parsing strips the version prefix", () => {
  const parts = pathParts(new Request("https://ddd-contract.netlify.app/api/v1/matching/opportunities/abc"));
  assert.deepEqual(parts, ["matching", "opportunities", "abc"]);
});

test("production secret key is server-only and fail-closed", () => {
  const previous = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  assert.throws(() => secretKey(), /SUPABASE_SECRET_KEY is not configured/);
  if (previous === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = previous;
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

await test("unauthenticated protected route stays closed", async () => {
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "invalid token" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
  try {
    const response = await api(new Request("https://ddd-contract.netlify.app/api/v1/me", {
      headers: { Authorization: "Bearer invalid" }
    }));
    assert.equal(response.status, 401);
  } finally {
    globalThis.fetch = priorFetch;
  }
});

if (failures) {
  console.error(`\n${failures} native Netlify API contract test${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}

console.log("\nAll native Netlify API contract tests passed.");
