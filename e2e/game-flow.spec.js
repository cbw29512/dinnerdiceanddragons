const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

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
    system: { slug: "dnd-5e-2014", name: "Dungeons & Dragons", edition: "5e (2014)" },
    venue: { id: VENUE_ID, name: "Browser Test Cafe", city: "Florence", state_region: "SC" },
    viewer_roles: ["gm"],
    your_responses: { gm: "pending" },
    your_player_distance_miles: null,
    your_gm_distance_miles: 4.2,
    ...overrides
  };
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installOpportunityApi(page, item, role) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/session") return route.fallback();
    if (path === "/api/v1/me") return fulfillJson(route, { display_name: `Browser ${role}`, roles: [role] });
    if (path === "/api/v1/notifications") return fulfillJson(route, []);
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}` && request.method() === "GET") {
      return fulfillJson(route, { ...item, your_player_fit_flags: [], your_player_availability_overlap: null, explanations: [] });
    }
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}/respond` && request.method() === "POST") {
      const payload = request.postDataJSON();
      item.status = "forming";
      item.your_responses = { ...(item.your_responses || {}), [role]: payload.decision };
      return fulfillJson(route, {
        role,
        decision: payload.decision,
        table_status: "forming",
        progress: { gmAccepted: true, venueAccepted: true, acceptedPlayers: 3, formed: true }
      });
    }
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}/form` && request.method() === "POST") {
      item.event_id = EVENT_ID;
      item.event_status = "venue_requested";
      item.status = "converted";
      return fulfillJson(route, {
        event_id: EVENT_ID,
        event_slug: "browser-test-adventure",
        table_match_id: MATCH_ID,
        game_table_id: TABLE_ID,
        event_status: "venue_requested",
        created: true,
        venue_booking_request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
      });
    }
    return fulfillJson(route, { detail: `Unhandled browser fixture: ${request.method()} ${path}` }, 404);
  });
}

test("GM accepts a structured match, gets BOOM, and creates the real Event", async ({ page }) => {
  const item = opportunity();
  await installAuthenticatedSession(page, { email: "gm-browser@example.test" });
  await installOpportunityApi(page, item, "gm");

  await page.goto(`/opportunity.html?match=${MATCH_ID}&role=gm`);
  await expect(page.getByRole("heading", { name: "Dungeons & Dragons" })).toBeVisible();
  await page.getByRole("button", { name: "Accept Match" }).click();

  const finish = page.getByRole("link", { name: /Table Formed.*Finish Event Setup/i });
  await expect(finish).toBeVisible();
  await finish.click();
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

test("matched Player reviews the Event opportunity and requests a real seat", async ({ page }) => {
  const item = opportunity({
    status: "converted",
    event_id: EVENT_ID,
    event_status: "venue_requested",
    viewer_roles: ["player"],
    your_responses: { player: "accepted" },
    your_player_distance_miles: 3.1,
    your_gm_distance_miles: null
  });
  await installAuthenticatedSession(page, { email: "player-browser@example.test" });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/session") return route.fallback();
    if (path === "/api/v1/me") return fulfillJson(route, { display_name: "Browser Player", roles: ["player"] });
    if (path === "/api/v1/notifications") return fulfillJson(route, []);
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}`) return fulfillJson(route, { ...item, explanations: [] });
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

  await page.goto(`/opportunity.html?match=${MATCH_ID}&role=player`);
  const seatButton = page.getByRole("button", { name: "Request My Seat" });
  await expect(seatButton).toBeVisible();
  await seatButton.click();
  await expect(page.getByText("Seat requested. The DM still needs to approve your request.", { exact: true })).toBeVisible();
});

test("production match values render as inert text on Event creation", async ({ page }) => {
  const malicious = opportunity({
    status: "forming",
    your_responses: { gm: "accepted" },
    system: { slug: "dnd-5e-2014", name: '<img id="system-xss" src=x onerror="window.__dddStoredXss=1">', edition: "5e" },
    venue: {
      id: VENUE_ID,
      name: '<svg id="venue-xss" onload="window.__dddStoredXss=2"></svg>',
      city: '<img id="city-xss" src=x onerror="window.__dddStoredXss=3">',
      state_region: "SC"
    }
  });
  await installAuthenticatedSession(page, { email: "gm-browser@example.test" });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/session") return route.fallback();
    if (path === "/api/v1/me") return fulfillJson(route, { display_name: "Browser GM", roles: ["gm"] });
    if (path === "/api/v1/notifications") return fulfillJson(route, []);
    if (path === `/api/v1/matching/opportunities/${MATCH_ID}`) return fulfillJson(route, { ...malicious, explanations: [] });
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