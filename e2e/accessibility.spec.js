const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { installAuthenticatedSession } = require("./helpers");

const API_BASE = "http://127.0.0.1:4173";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const LIVE_HUB_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const pages = [
  "/index.html",
  "/play.html",
  "/dm.html",
  "/host.html",
  "/signin.html",
  "/my-ddd.html",
  "/notifications.html",
  "/opportunity.html",
  "/game-hub.html",
  "/conduct.html",
  "/join.html",
  "/venues.html"
];

const skipLinkPages = [...pages];

function formatViolations(violations) {
  return violations
    .map((violation) => {
      const targets = violation.nodes.flatMap((node) => node.target).slice(0, 8).join(", ");
      return `${violation.id} (${violation.impact || "unknown"}): ${violation.help} -> ${targets}`;
    })
    .join("\n");
}

async function expectNoWcagViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

for (const path of pages) {
  test(`WCAG A/AA scan: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoWcagViolations(page);
  });
}

test("skip links are the first keyboard stop and move focus to main content site-wide", async ({ page }) => {
  for (const path of skipLinkPages) {
    await page.goto(path);
    const skipLink = page.locator(".skip-link");
    const main = page.locator("#main");
    await page.keyboard.press("Tab");
    await expect(skipLink, `Skip link should be first on ${path}`).toBeFocused();
    await expect(skipLink, `Skip link should be visible on focus for ${path}`).toBeVisible();
    await expect(skipLink).toHaveAttribute("href", "#main");
    await page.keyboard.press("Enter");
    await expect(page, `Skip link should navigate to #main on ${path}`).toHaveURL(/#main$/);
    await expect(main, `Skip link should move focus into main content on ${path}`).toBeFocused();
  }
});

test("primary homepage paths are reachable by keyboard without a focus trap", async ({ page }) => {
  await page.goto("/index.html");
  const visited = [];
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element) return "";
      return `${element.tagName}:${element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) || element.getAttribute("aria-label") || ""}`;
    });
    visited.push(active);
  }
  expect(visited.some((value) => value.includes("Play D&D"))).toBeTruthy();
  expect(visited.some((value) => value.includes("DM a Game"))).toBeTruthy();
  expect(visited.some((value) => value.includes("Host Games"))).toBeTruthy();
  expect(visited.some((value) => value.includes("Sign in"))).toBeTruthy();
});

test("invalid Player account step announces the first problem and focuses it", async ({ page }) => {
  await page.goto("/play.html");
  const displayName = page.getByLabel("Display name");
  await page.getByRole("button", { name: "Create Account & Continue" }).click();
  await expect(page.locator("#auth-status")).toContainText("Enter the name your table should see");
  await expect(displayName).toBeFocused();
  await expect(displayName).toHaveAttribute("aria-invalid", "true");
  await expectNoWcagViolations(page);
});

test("Player availability calendar and quick picks remain WCAG clean", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "accessible-player@example.test" });
  await page.route("**/api/v1/onboarding/player", async (route) => {
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not configured" }) });
  });
  await page.goto("/play.html");
  await page.getByLabel("Display name").fill("Accessible Player");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "When can you usually play?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Saturday 6–10 PM" })).toBeVisible();
  await expectNoWcagViolations(page);
});

test("all authenticated Game Hub role views remain WCAG clean when revealed", async ({ page }) => {
  await mockAuthenticatedMultiRoleHub(page);
  await page.goto(`/game-hub.html?event=${LIVE_HUB_EVENT_ID}&role=player`);
  await expect(page.locator("#hub-status")).toHaveText("Live Game Hub loaded.");

  for (const [role, viewId] of [
    ["player", "player-view"],
    ["gm", "gm-view"],
    ["venue_manager", "venue-view"]
  ]) {
    await page.locator(`.hub-role-button[data-role="${role}"]`).click();
    await expect(page.locator(`#${viewId}`)).toBeVisible();
    await expectNoWcagViolations(page);
  }
});

async function mockAuthenticatedMultiRoleHub(page) {
  await page.route(`${API_BASE}/api/v1/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/v1/events/${LIVE_HUB_EVENT_ID}/hub`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(accessibleHubPayload()) });
      return;
    }
    if (url.pathname === `/api/v1/events/${LIVE_HUB_EVENT_ID}/announcements` || url.pathname === "/api/v1/notifications") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }
    if (url.pathname === "/api/v1/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ display_name: "Accessibility User", roles: ["player", "gm", "venue_manager"] })
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });
  await installAuthenticatedSession(page, { email: "accessibility@example.test" });
}

function accessibleHubPayload() {
  return {
    event: {
      id: LIVE_HUB_EVENT_ID,
      slug: "accessibility-live-hub",
      title: "Accessible Live Game Hub",
      description: "Authenticated multi-role accessibility fixture.",
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
      venue_name: "Accessible Test Cafe",
      venue_address_line1: "123 Accessible Way",
      venue_city: "Florence",
      venue_state_region: "SC",
      viewer_roles: ["player", "gm", "venue_manager"],
      confirmed_players: 1,
      booking: {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "approved",
        expected_guests: 2,
        requested_start: "2030-08-23T22:00:00Z",
        requested_end: "2030-08-24T02:00:00Z"
      },
      expectations: {
        tone: "Welcoming",
        age_environment: null,
        play_style: "Collaborative roleplay and tactical combat.",
        boundaries: "Respectful table.",
        pvp_policy: "No PvP without table consent.",
        homebrew_policy: null,
        character_death_policy: null,
        mature_content_notes: null,
        alcohol_policy: null,
        new_players_welcome: true,
        break_policy: null,
        safety_framework: "Pause or step away whenever needed.",
        environment_notes: null,
        accessibility_notes: "Accessible entrance available.",
        other_notes: null
      },
      your_registration: {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        event_id: LIVE_HUB_EVENT_ID,
        status: "confirmed",
        expectations_acknowledged_at: "2030-08-01T12:00:00Z",
        requested_at: "2030-08-01T12:00:00Z",
        responded_at: "2030-08-01T12:05:00Z",
        cancelled_at: null
      }
    },
    capabilities: {
      viewer_roles: ["player", "gm", "venue_manager"],
      post_channels: [],
      can_manage_registrations: true,
      can_manage_booking: true
    },
    registration_queue: []
  };
}