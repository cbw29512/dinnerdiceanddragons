const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

const API_BASE = "https://dinnerdiceanddragons.vercel.app";
const MATCH_ID = "11111111-1111-4111-8111-111111111111";
const TABLE_ID = "22222222-2222-4222-8222-222222222222";
const VENUE_ID = "33333333-3333-4333-8333-333333333333";
const EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function opportunity(overrides = {}) {
  return {
    id: MATCH_ID,
    game_table_id: TABLE_ID,
    event_id: null,
    event_status: null,
    status: "potential",
    proposed_start: "2030-08-19T22:00:00Z",
    proposed_end: "2030-08-20T02:00:00Z",
    timezone: "America/New_York",
    minimum_players: 3,
    maximum_players: 5,
    compatible_player_count: 4,
    system: {
      slug: "dnd-5e-2014",
      name: "Dungeons & Dragons",
      edition: "5e (2014)"
    },
    venue: {
      id: VENUE_ID,
      name: "Browser Test Cafe",
      city: "Florence",
      state_region: "SC"
    },
    viewer_roles: ["gm"],
    your_player_distance_miles: null,
    your_gm_distance_miles: 4.2,
    ...overrides
  };
}

function matcherResponse(item) {
  return {
    boom: true,
    run: {
      computed_opportunities: 1,
      persisted_count: 1,
      created_count: 1,
      refreshed_count: 0,
      materialized_table_count: 1,
      expired_count: 0
    },
    opportunities: [item]
  };
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installGmApi(page) {
  const item = opportunity();
  await page.route(`${API_BASE}/api/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/v1/me") {
      await fulfillJson(route, { display_name: "Browser GM", roles: ["gm"] });
      return;
    }
    if (path === "/api/v1/onboarding/gm" && request.method() === "PUT") {
      await fulfillJson(route, { role: "gm", display_name: "Browser GM" });
      return;
    }
    if (path === "/api/v1/matching/gm-supplies" && request.method() === "GET") {
      await fulfillJson(route, []);
      return;
    }
    if (path === "/api/v1/matching/gm-supplies" && request.method() === "POST") {
      await fulfillJson(route, { id: "44444444-4444-4444-8444-444444444444", status: "active", ...request.postDataJSON() });
      return;
    }
    if (path === "/api/v1/matching/find-my-table" && request.method() === "POST") {
      await fulfillJson(route, matcherResponse(item));
      return;
    }
    if (path === "/api/v1/matching/opportunities" && request.method() === "GET") {
      await fulfillJson(route, [item]);
      return;
    }
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}` && request.method() === "GET") {
      await fulfillJson(route, { ...item, your_player_fit_flags: [], your_player_availability_overlap: null, explanations: [] });
      return;
    }
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}/form` && request.method() === "POST") {
      await fulfillJson(route, {
        event_id: EVENT_ID,
        event_slug: "browser-test-adventure",
        table_match_id: MATCH_ID,
        game_table_id: TABLE_ID,
        event_status: "venue_requested",
        created: true,
        venue_booking_request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      });
      return;
    }
    await fulfillJson(route, { detail: `Unhandled browser fixture: ${request.method()} ${path}` }, 404);
  });
}

test("GM signup enters production matching and forms the real Event", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "gm-browser@example.test" });
  await installGmApi(page);
  await page.goto("/join.html#gm");

  const form = page.locator("#gm-form");
  await form.locator('[name="display_name"]').fill("Browser GM");
  await expect(form.locator('[name="email"]')).toHaveValue("gm-browser@example.test");
  await expect(form.locator('[name="email"]')).toHaveAttribute("readonly", "");
  await form.locator('[name="postal_code"]').fill("29501");
  await form.locator('[name="style"]').fill("Friendly roleplay with tactical combat.");
  await form.locator('[name="expectations"]').fill("Respectful table, no PvP, use safety tools.");
  await form.locator('.check-label input[type="checkbox"]').check();
  await form.getByRole("button", { name: "Find Players + Venue" }).click();

  await expect(form.locator(".form-status")).toContainText("Saved and matched");
  const build = page.getByRole("link", { name: "Build This Table" });
  await expect(build).toBeVisible();
  await build.click();
  await expect(page).toHaveURL(new RegExp(`create-game\\.html\\?table_match_id=${MATCH_ID}$`));

  const eventForm = page.locator("#game-form");
  await expect(eventForm).toBeVisible();
  await expect(eventForm.locator("#game-venue")).toHaveValue(/Browser Test Cafe/);
  await expect(eventForm.locator("#game-system")).toHaveValue(/Dungeons & Dragons/);
  await eventForm.locator('[name="title"]').fill("Browser Test Adventure");
  await eventForm.locator('[name="description"]').fill("A welcoming local D&D adventure used to verify the production Table flow.");
  await eventForm.locator('[name="play_style"]').fill("Friendly roleplay with tactical combat.");
  await eventForm.locator('[name="boundaries"]').fill("Respectful table, no PvP, use safety tools.");
  await eventForm.locator('[name="accuracy_confirmed"]').check();
  await eventForm.getByRole("button", { name: "Create This Event" }).click();

  await expect(page.locator("#game-next-step")).toBeVisible();
  await expect(page.locator("#create-game-page-status")).toContainText("Event created successfully");
  await expect(page.locator("#game-hub-link")).toHaveAttribute("href", `game-hub.html?event=${EVENT_ID}`);
});

test("matched Player can request a real Event seat from signup results", async ({ page }) => {
  const converted = opportunity({
    status: "converted",
    event_id: EVENT_ID,
    event_status: "venue_requested",
    viewer_roles: ["player"],
    your_player_distance_miles: 3.1,
    your_gm_distance_miles: null
  });

  await installAuthenticatedSession(page, { email: "player-browser@example.test" });
  await page.route(`${API_BASE}/api/v1/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/me") return fulfillJson(route, { display_name: "Browser Player", roles: ["player"] });
    if (path === "/api/v1/onboarding/player" && request.method() === "PUT") return fulfillJson(route, { role: "player" });
    if (path === "/api/v1/matching/player-demands" && request.method() === "GET") return fulfillJson(route, []);
    if (path === "/api/v1/matching/player-demands" && request.method() === "POST") return fulfillJson(route, { id: "55555555-5555-4555-8555-555555555555", status: "active", ...request.postDataJSON() });
    if (path === "/api/v1/matching/find-my-table" && request.method() === "POST") return fulfillJson(route, matcherResponse(converted));
    if (path === "/api/v1/matching/opportunities" && request.method() === "GET") return fulfillJson(route, [converted]);
    if (path === `/api/v1/events/${EVENT_ID}` && request.method() === "GET") return fulfillJson(route, { id: EVENT_ID, your_registration: null });
    if (path === `/api/v1/events/${EVENT_ID}/registrations` && request.method() === "POST") {
      return fulfillJson(route, {
        id: "66666666-6666-4666-8666-666666666666",
        event_id: EVENT_ID,
        status: "requested",
        expectations_acknowledged_at: "2030-08-01T12:00:00Z",
        requested_at: "2030-08-01T12:00:00Z",
        responded_at: null,
        cancelled_at: null
      });
    }
    return fulfillJson(route, { detail: `Unhandled browser fixture: ${request.method()} ${path}` }, 404);
  });

  await page.goto("/join.html#player");
  const form = page.locator("#player-form");
  await form.locator('[name="display_name"]').fill("Browser Player");
  await expect(form.locator('[name="email"]')).toHaveValue("player-browser@example.test");
  await expect(form.locator('[name="email"]')).toHaveAttribute("readonly", "");
  await form.locator('[name="postal_code"]').fill("29501");
  await form.locator('.check-label input[type="checkbox"]').check();
  await form.getByRole("button", { name: "Find My Table" }).click();

  const seatButton = page.getByRole("button", { name: "Request My Seat" });
  await expect(seatButton).toBeVisible();
  await seatButton.click();
  await expect(page.getByText("Seat requested. The DM still needs to approve your request.", { exact: true })).toBeVisible();
});

test("production match values render as inert text on Event creation", async ({ page }) => {
  const malicious = opportunity({
    system: {
      slug: "dnd-5e-2014",
      name: '<img id="system-xss" src=x onerror="window.__dddStoredXss=1">',
      edition: "5e"
    },
    venue: {
      id: VENUE_ID,
      name: '<svg id="venue-xss" onload="window.__dddStoredXss=2"></svg>',
      city: '<img id="city-xss" src=x onerror="window.__dddStoredXss=3">',
      state_region: "SC"
    }
  });

  await installAuthenticatedSession(page, { email: "gm-browser@example.test" });
  await page.route(`${API_BASE}/api/v1/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/me") return fulfillJson(route, { display_name: "Browser GM", roles: ["gm"] });
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}`) {
      return fulfillJson(route, { ...malicious, your_player_fit_flags: [], your_player_availability_overlap: null, explanations: [] });
    }
    return fulfillJson(route, { detail: "Not found" }, 404);
  });

  await page.goto(`/create-game.html?table_match_id=${MATCH_ID}`);
  const summary = page.locator("#selected-slot");
  await expect(summary).toContainText('<img id="system-xss"');
  await expect(summary).toContainText('<svg id="venue-xss"');
  await expect(summary).toContainText('<img id="city-xss"');
  await expect(summary.locator("#system-xss, #venue-xss, #city-xss")).toHaveCount(0);
  expect(await page.evaluate(() => window.__dddStoredXss || 0)).toBe(0);
});
