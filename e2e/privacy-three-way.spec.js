const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

const MATCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createFixture() {
  return {
    status: "potential",
    responses: {
      gm: "pending",
      venue_manager: "pending",
      player1: "pending",
      player2: "pending",
      player3: "pending"
    },
    requests: []
  };
}

function acceptedPlayers(fixture) {
  return ["player1", "player2", "player3"].filter((key) => fixture.responses[key] === "accepted").length;
}

function recompute(fixture) {
  fixture.status = fixture.responses.gm === "accepted" &&
    fixture.responses.venue_manager === "accepted" &&
    acceptedPlayers(fixture) >= 3 ? "forming" : "potential";
}

function roleName(actor) {
  if (actor === "gm") return "gm";
  if (actor === "venue_manager") return "venue_manager";
  return "player";
}

function opportunity(fixture, actor) {
  const role = roleName(actor);
  return {
    id: MATCH_ID,
    status: fixture.status,
    proposed_start: "2030-08-23T22:00:00Z",
    proposed_end: "2030-08-24T02:00:00Z",
    timezone: "America/New_York",
    minimum_players: 3,
    maximum_players: 5,
    compatible_player_count: 3,
    system: { name: "Dungeons & Dragons", edition: "5e (2024)" },
    venue: { id: "venue-public", name: "Browser Test Cafe", city: "Florence", state_region: "SC" },
    viewer_roles: [role],
    your_responses: { [role]: fixture.responses[actor] }
  };
}

async function installOpportunityApi(page, fixture, actor) {
  await installAuthenticatedSession(page, { email: `${actor}@example.test` });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    fixture.requests.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === "/api/v1/me") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ display_name: actor, roles: [roleName(actor)] }) });
    }
    if (url.pathname === `/api/v1/matching/opportunities/${MATCH_ID}` && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(opportunity(fixture, actor)) });
    }
    if (url.pathname === `/api/v1/matching/opportunities/${MATCH_ID}/respond` && request.method() === "POST") {
      const body = request.postDataJSON();
      fixture.responses[actor] = body.decision;
      recompute(fixture);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          role: body.role,
          decision: body.decision,
          table_status: fixture.status,
          progress: {
            gmAccepted: fixture.responses.gm === "accepted",
            venueAccepted: fixture.responses.venue_manager === "accepted",
            acceptedPlayers: acceptedPlayers(fixture),
            formed: fixture.status === "forming"
          }
        })
      });
    }
    if (url.pathname === "/api/v1/notifications") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });
}

async function accept(browser, fixture, actor) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await installOpportunityApi(page, fixture, actor);
  await page.goto(`/opportunity.html?match=${MATCH_ID}&role=${roleName(actor)}`);
  const button = page.getByRole("button", { name: roleName(actor) === "player" ? "I'm Interested" : "Accept Match" });
  await expect(button).toBeVisible();
  await button.click();
  return { page, context };
}

test("DM + Venue + three Players are required before BOOM", async ({ browser }) => {
  const fixture = createFixture();
  const sessions = [];
  try {
    sessions.push(await accept(browser, fixture, "gm"));
    sessions.push(await accept(browser, fixture, "venue_manager"));
    sessions.push(await accept(browser, fixture, "player1"));
    sessions.push(await accept(browser, fixture, "player2"));
    expect(fixture.status).toBe("potential");
    await expect(sessions.at(-1).page.getByText(/waiting for the DM, Venue, and enough Players/i)).toBeVisible();

    const finalPlayer = await accept(browser, fixture, "player3");
    sessions.push(finalPlayer);
    expect(fixture.status).toBe("forming");
    await expect(finalPlayer.page.getByText(/table formed/i)).toBeVisible();
  } finally {
    await Promise.all(sessions.map(({ context }) => context.close()));
  }
});

test("opportunity review never exposes private contact details", async ({ page }) => {
  const fixture = createFixture();
  await installOpportunityApi(page, fixture, "player1");
  await page.goto(`/opportunity.html?match=${MATCH_ID}&role=player`);
  await expect(page.locator("#opportunity-panel")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("player1@example.test");
  await expect(page.locator("body")).not.toContainText("555-0100");
  await expect(page.locator("body")).not.toContainText("29501");
  await expect(page.getByRole("button", { name: /message|contact|text|email/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /message|contact|text|email/i })).toHaveCount(0);
});

test("privacy-safe Game Hub has structured logistics and never calls messages", async ({ page }) => {
  const requests = [];
  await installAuthenticatedSession(page);
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === "/api/v1/me") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ display_name: "Browser Player", roles: ["player"] }) });
    }
    if (url.pathname === `/api/v1/events/${EVENT_ID}/hub`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        event: {
          id: EVENT_ID,
          title: "Browser Privacy Table",
          description: "Privacy-first live table.",
          status: "confirmed",
          starts_at: "2030-08-23T22:00:00Z",
          ends_at: "2030-08-24T02:00:00Z",
          system_name: "Dungeons & Dragons",
          system_edition: "5e (2024)",
          venue_name: "Browser Test Cafe",
          venue_address_line1: "123 Public Table Way",
          venue_city: "Florence",
          venue_state_region: "SC",
          confirmed_players: 3,
          booking: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", status: "approved", expected_guests: 4 },
          expectations: { play_style: "Collaborative.", boundaries: "Respectful table." },
          your_registration: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", event_id: EVENT_ID, status: "confirmed" }
        },
        capabilities: { viewer_roles: ["player"], post_channels: [], can_manage_registrations: false, can_manage_booking: false },
        registration_queue: []
      }) });
    }
    if (url.pathname === `/api/v1/events/${EVENT_ID}/announcements`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([
        { id: "announcement-1", body: "Bring a level 3 character.", created_at: "2030-08-01T12:00:00Z" }
      ]) });
    }
    if (url.pathname === "/api/v1/notifications") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });

  await page.goto(`/game-hub.html?event=${EVENT_ID}`);
  await expect(page.locator("#event-title")).toHaveText("Browser Privacy Table");
  await expect(page.getByText("123 Public Table Way", { exact: true })).toBeVisible();
  await expect(page.getByText("Bring a level 3 character.", { exact: true })).toBeVisible();
  await expect(page.locator("#message-channel-grid")).toHaveCount(0);
  await expect(page.locator("#venue-question-form")).toHaveCount(0);
  await expect(page.getByText(/live messages/i)).toHaveCount(0);
  expect(requests.some((entry) => entry.includes("/messages"))).toBe(false);
});
