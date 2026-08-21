const { test, expect } = require("@playwright/test");
const { expectNoHorizontalOverflow, installAuthenticatedSession } = require("./helpers");

async function firstTimePlayerApi(page) {
  await installAuthenticatedSession(page, { email: "newplayer@example.test" });
  await page.route("**/api/v1/onboarding/player", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Player onboarding has not been completed." }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "player" }) });
  });
}

test("homepage presents four obvious first actions", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play D&D" })).toHaveAttribute("href", "play.html");
  await expect(page.getByRole("link", { name: "DM a Game" })).toHaveAttribute("href", "dm.html");
  await expect(page.getByRole("link", { name: "Host Games" })).toHaveAttribute("href", "host.html");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "signin.html");
});

test("legacy join URL can no longer expose giant onboarding forms", async ({ page }) => {
  await page.goto("/join.html#player");
  await expect(page.locator("#player-form")).toHaveCount(0);
  await expect(page.locator("#gm-form")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Find a Game" })).toBeVisible();
  await expect(page.getByRole("link", { name: "DM a Game" })).toBeVisible();
});

test("signed-in first-time Player can reach availability without understanding matching", async ({ page }) => {
  await firstTimePlayerApi(page);
  await page.goto("/play.html");
  await page.getByLabel("Display name").fill("New Player");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "What do you want to play?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "When can you usually play?" })).toBeVisible();
  await page.getByRole("button", { name: "Saturday 6–10 PM" }).click();
  await expect(page.locator('[name="availability_day[]"]')).toHaveCount(1);
  await expect(page.locator('[name="availability_day[]"]')).toHaveValue("Saturday");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Home ZIP code").fill("29501");
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText(/Saturday 18:00–22:00/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Looking for Games" })).toBeVisible();
});

test("simple Player availability works without horizontal overflow on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await firstTimePlayerApi(page);
  await page.goto("/play.html");
  await page.getByLabel("Display name").fill("Phone Player");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: "Weeknights 6–10 PM" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("DM and Venue entry pages use the same guided language", async ({ page }) => {
  await page.goto("/dm.html");
  await expect(page.getByRole("heading", { name: "Tell us what you can run." })).toBeVisible();
  await expect(page.getByText("Step 1 of 5")).toBeVisible();
  await page.goto("/host.html");
  await expect(page.getByRole("heading", { name: "Tell us when your tables are open." })).toBeVisible();
  await expect(page.getByText(/Step 1 of/)).toBeVisible();
});

test("My DDD answers Player, DM, alerts, and game-night status", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "multirole@example.test" });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/session") return route.fallback();
    const player = { display_name: "Multi Role", postal_code: "29501", travel_radius_miles: 25, systems: [{ system_slug: "dnd-5e-2024" }], availability: [{ day_of_week: "friday" }] };
    const gm = { display_name: "Multi Role", postal_code: "29501", travel_radius_miles: 25, systems: [{ system_slug: "dnd-5e-2024" }], availability: [{ day_of_week: "saturday" }] };
    if (url.pathname === "/api/v1/onboarding/player") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(player) });
    if (url.pathname === "/api/v1/onboarding/gm") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gm) });
    if (url.pathname === "/api/v1/notifications") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "n1", state: "pending" }]) });
    if (url.pathname === "/api/v1/game-hubs") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ event_id: "e1" }]) });
    if (url.pathname === "/api/v1/notification-preferences") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matching_paused: false }) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });
  await page.goto("/my-ddd.html");
  await expect(page.getByText("You’re available for games.")).toBeVisible();
  await expect(page.getByText("You’re available to DM.")).toBeVisible();
  await expect(page.locator("#alert-count")).toHaveText("1");
  await expect(page.locator("#hub-count")).toHaveText("1");
});