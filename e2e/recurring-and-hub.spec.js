const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

const API_BASE = "http://127.0.0.1:4173";
const EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("live Game Hub renders production logistics and one-way announcements without chat", async ({ page }) => {
  const requests = [];
  await installHubRoutes(page, {
    requests,
    hub: hubPayload(EVENT_ID, ["player"]),
    announcements: [{ id: "announcement-1", body: "Bring a level 3 character.", created_at: "2030-08-01T13:00:00Z" }]
  });
  await installAuthenticatedSession(page);

  await page.goto(`/game-hub.html?event=${EVENT_ID}`);

  await expect(page.locator("#event-title")).toHaveText("Browser Test Live Hub");
  await expect(page.locator("#player-view")).toBeVisible();
  await expect(page.locator("#hub-headcount")).toHaveText("3");
  await expect(page.getByText("123 Public Table Way", { exact: true })).toBeVisible();
  await expect(page.getByText("Bring a level 3 character.", { exact: true })).toBeVisible();
  await expect(page.locator("#hub-announcement-form")).toBeHidden();
  await expect(page.locator("#message-channel-grid")).toHaveCount(0);
  await expect(page.locator("#venue-question-form")).toHaveCount(0);
  await expect(page.getByText(/live messages/i)).toHaveCount(0);
  expect(requests.some((entry) => entry.includes("/messages"))).toBe(false);
});

test("DM can post a one-way Game Hub announcement without opening chat", async ({ page }) => {
  const requests = [];
  const announcements = [];
  let postedBody = "";
  await installHubRoutes(page, {
    requests,
    hub: hubPayload(EVENT_ID, ["gm"]),
    announcements,
    onPostAnnouncement(body) {
      postedBody = body;
      announcements.unshift({ id: "announcement-new", body, created_at: "2030-08-01T14:00:00Z" });
    }
  });
  await installAuthenticatedSession(page, { email: "gm@example.test" });

  await page.goto(`/game-hub.html?event=${EVENT_ID}`);

  await expect(page.locator("#gm-view")).toBeVisible();
  await expect(page.locator("#hub-announcement-form")).toBeVisible();
  await page.getByRole("textbox", { name: "Announcement" }).fill("Bring your character sheet and dice.");
  await page.getByRole("button", { name: "Post Announcement" }).click();

  await expect(page.getByText("Bring your character sheet and dice.", { exact: true })).toBeVisible();
  expect(postedBody).toBe("Bring your character sheet and dice.");
  expect(requests).toContain(`POST /api/v1/events/${EVENT_ID}/announcements`);
  expect(requests.some((entry) => entry.includes("/messages"))).toBe(false);
});

async function installHubRoutes(page, { requests, hub, announcements, onPostAnnouncement = () => {} }) {
  await page.route(`${API_BASE}/api/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    requests.push(`${request.method()} ${url.pathname}`);
    if (url.pathname === "/api/v1/auth/session") return route.fallback();
    if (url.pathname === `/api/v1/events/${EVENT_ID}/hub` && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hub) });
    }
    if (url.pathname === `/api/v1/events/${EVENT_ID}/announcements` && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(announcements) });
    }
    if (url.pathname === `/api/v1/events/${EVENT_ID}/announcements` && request.method() === "POST") {
      const payload = request.postDataJSON();
      onPostAnnouncement(String(payload?.body || ""));
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "announcement-new", body: payload.body, created_at: "2030-08-01T14:00:00Z", author_role: "gm" })
      });
    }
    if (url.pathname === "/api/v1/notifications" && request.method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    if (url.pathname === "/api/v1/me") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ display_name: "Browser User", roles: hub.capabilities.viewer_roles }) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });
}

function hubPayload(eventId, viewerRoles) {
  const player = viewerRoles.includes("player");
  const gm = viewerRoles.includes("gm");
  const venueManager = viewerRoles.includes("venue_manager");
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
      viewer_roles: viewerRoles,
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
      your_registration: player ? {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        event_id: eventId,
        status: "confirmed",
        expectations_acknowledged_at: "2030-08-01T12:00:00Z",
        requested_at: "2030-08-01T12:00:00Z",
        responded_at: "2030-08-01T12:05:00Z",
        cancelled_at: null
      } : null
    },
    capabilities: {
      viewer_roles: viewerRoles,
      can_manage_registrations: gm,
      can_manage_booking: venueManager,
      can_post_announcement: gm
    },
    registration_queue: []
  };
}