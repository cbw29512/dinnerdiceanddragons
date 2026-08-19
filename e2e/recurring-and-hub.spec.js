const { test, expect } = require("@playwright/test");
const { mockZipLookup, installAuthenticatedSession } = require("./helpers");

const API_BASE = "http://127.0.0.1:4173";

test("DM can check recurring dates, create the recurring table, and review commitments", async ({ page }) => {
  await mockZipLookup(page);
  await page.goto("/recurring-match.html");

  await page.locator("#series-system").selectOption({ label: "D&D 5e" });
  await page.locator("#series-day").selectOption({ label: "Tuesday" });
  await expect(page.locator("#series-anchor")).not.toHaveValue("");
  await page.locator("#series-start").fill("18:00");
  await page.locator("#series-duration").selectOption("240");
  await page.locator("#series-zip").fill("29501");
  await page.locator("#series-radius").selectOption("25");
  await page.getByRole("button", { name: "Check My Next 6 Game Nights" }).click();

  const continueButton = page.getByRole("button", { name: "Continue With These Dates" }).first();
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect(page).toHaveURL(/form-series\.html$/);

  await expect(page.locator('input[name="series_session"]:checked').first()).toBeVisible();
  await page.locator("#series-title").fill("Browser Test Campaign");
  await page.locator("#series-confirm").check();
  await page.getByRole("button", { name: "Create My Recurring Table" }).click();
  await expect(page.locator("#series-form-status")).toContainText("Recurring table created");

  await page.getByRole("link", { name: "Review Players & Venue" }).click();
  await expect(page).toHaveURL(/series-commitments\.html$/);
  await expect(page.locator("#player-requests")).toContainText("No Player requests waiting for review");

  await page.locator("#request-player-name").fill("Sample Taylor");
  await page.getByRole("button", { name: "Add Sample Request" }).click();
  await page.locator("#player-requests").getByRole("button", { name: "Accept" }).click();
  await expect(page.locator("#core-party")).toContainText("Sample Taylor");

  await page.locator("#venue-approval").getByRole("button", { name: "Use This Venue" }).click();
  await page.locator("#venue-approval").getByRole("button", { name: "Mark Venue Confirmed" }).click();
  await expect(page.locator("#commitment-summary")).toContainText("Venue confirmed");
});

test("live Game Hub renders production API state and treats stored message HTML as text", async ({ page }) => {
  const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const xssBody = '<img src=x onerror="window.__dddXss=1">Live table message';
  const messages = [hubMessage("11111111-1111-4111-8111-111111111111", xssBody)];

  await page.route(`${API_BASE}/api/v1/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === `/api/v1/events/${eventId}/hub` && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(hubPayload(eventId)) });
      return;
    }
    if (url.pathname === `/api/v1/events/${eventId}/messages` && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: messages, next_cursor: null }) });
      return;
    }
    if (url.pathname === `/api/v1/events/${eventId}/messages` && request.method() === "POST") {
      const payload = request.postDataJSON();
      const created = hubMessage("22222222-2222-4222-8222-222222222222", payload.body, true);
      messages.unshift(created);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(created) });
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
  await expect(page.getByText(xssBody, { exact: true })).toBeVisible();
  await expect(page.locator(".hub-message-item img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__dddXss)).toBeUndefined();

  const discussion = page.locator('form[data-channel="table_discussion"]');
  await discussion.locator("textarea").fill("I will arrive ten minutes early.");
  await discussion.getByRole("button", { name: "Send Message" }).click();
  await expect(page.locator("#hub-status")).toHaveText("Message sent.");
  await expect(page.getByText("I will arrive ten minutes early.", { exact: true })).toBeVisible();
});

function hubPayload(eventId) {
  return {
    event: {
      id: eventId,
      slug: "browser-test-live-hub",
      title: "Browser Test Live Hub",
      description: "Live production-backed Game Hub browser fixture.",
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
        tone: null,
        age_environment: null,
        play_style: "Collaborative roleplay and tactical combat.",
        boundaries: "Respectful table.",
        pvp_policy: null,
        homebrew_policy: null,
        character_death_policy: null,
        mature_content_notes: null,
        alcohol_policy: null,
        new_players_welcome: true,
        break_policy: null,
        safety_framework: null,
        environment_notes: null,
        accessibility_notes: null,
        other_notes: null
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
      post_channels: ["table_discussion", "player_gm", "player_venue_question"],
      can_manage_registrations: false,
      can_manage_booking: false
    },
    registration_queue: []
  };
}

function hubMessage(id, body, mine = false) {
  return {
    id,
    channel_type: "table_discussion",
    category: null,
    body,
    created_at: "2030-08-01T13:00:00Z",
    sender_display_name: mine ? "Browser Player" : "DM Browser",
    sender_role: mine ? "player" : "gm",
    mine,
    reply_registration_id: null
  };
}
