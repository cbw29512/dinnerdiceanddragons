const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

const API_BASE = "http://127.0.0.1:4173";

test("live Game Hub renders production logistics and one-way announcements without chat", async ({ page }) => {
  const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const requests = [];

  await page.route(`${API_BASE}/api/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === "/api/v1/auth/session") return route.fallback();
    if (url.pathname === `/api/v1/events/${eventId}/hub` && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hubPayload(eventId)) });
      return;
    }
    if (url.pathname === `/api/v1/events/${eventId}/announcements` && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "announcement-1", body: "Bring a level 3 character.", created_at: "2030-08-01T13:00:00Z" }])
      });
      return;
    }
    if (url.pathname === "/api/v1/notifications" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/api/v1/me") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ display_name: "Browser Player", roles: ["player"] }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });
  await installAuthenticatedSession(page);

  await page.goto(`/game-hub.html?event=${eventId}`);

  await expect(page.locator("#event-title")).toHaveText("Browser Test Live Hub");
  await expect(page.locator("#player-view")).toBeVisible();
  await expect(page.locator("#hub-headcount")).toHaveText("3");
  await expect(page.getByText("123 Public Table Way", { exact: true })).toBeVisible();
  await expect(page.getByText("Bring a level 3 character.", { exact: true })).toBeVisible();
  await expect(page.locator("#message-channel-grid")).toHaveCount(0);
  await expect(page.locator("#venue-question-form")).toHaveCount(0);
  await expect(page.getByText(/live messages/i)).toHaveCount(0);
  expect(requests.some((entry) => entry.includes("/messages"))).toBe(false);
});

function hubPayload(eventId) {
  return {
    event: {
      id: eventId,
      slug: "browser-test-live-hub",
      title: "Browser Test Live Hub",
      description: "Live production-backed privacy-safe Game Hub browser fixture.",
      status: "confirmed",
      event_type: "one_shot",
      join_mode: "instant_join",
      starts_at: "2030-08-23T22:00:00Z",
      ends_at: "2030-08-24T02:00:00Z",
      min_players: 1,
      max_players: 4,
      minimum_age: null,
      beginner_friendly: true,
      system_name: "Dungeons & Dragons",
      system_edition: "5e (2014)",
      venue_name: "Browser Test Cafe",
      venue_address_line1: "123 Public Table Way",
      venue_city: "Florence",
      venue_state_region: "SC",
      viewer_roles: ["player"],
      confirmed_players: 2,
      booking: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "approved",
        expected_guests: 3,
        requested_start: "2030-08-23T22:00:00Z",
        requested_end: "2030-08-24T02:00:00Z"
      },
      expectations: {
        play_style: "Collaborative roleplay and tactical combat.",
        boundaries: "Respectful table.",
        pvp_policy: null,
        homebrew_policy: null,
        safety_framework: null,
        accessibility_notes: null
      },
      your_registration: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        event_id: eventId,
        status: "confirmed",
        expectations_acknowledged_at: "2030-08-01T12:00:00Z",
        requested_at: "2030-08-01T12:00:00Z",
        responded_at: "2030-08-01T12:05:00Z",
        cancelled_at: null
      }
    },
    capabilities: {
      viewer_roles: ["player"],
      post_channels: [],
      can_manage_registrations: false,
      can_manage_booking: false
    },
    registration_queue: []
  };
}