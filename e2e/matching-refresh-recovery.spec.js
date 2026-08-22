const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

const DB_FAILURE = "The database operation could not be completed.";
const availability = [{
  day_of_week: "wednesday",
  start_time: "18:00",
  end_time: "22:00",
  pattern_type: "weekly_interval",
  week_interval: 1,
  anchor_date: null,
  monthly_ordinal: null,
  month_interval: null,
  timezone: "America/New_York",
  starts_on: null,
  ends_on: null
}];

async function failImmediateRefresh(page) {
  await page.route("**/api/v1/matching/find-my-table", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ detail: DB_FAILURE })
    });
  });
  await page.route("**/api/v1/matching/opportunities", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function installSavedPlayer(page, { edit = false } = {}) {
  await installAuthenticatedSession(page, { email: "refresh-player@example.test" });
  const profile = {
    display_name: "Refresh Player",
    bio: null,
    postal_code: "29501",
    travel_radius_miles: 50,
    preferred_format: "any",
    willing_to_learn_new_system: true,
    environment_preferences: [],
    accessibility_notes_private: null,
    systems: [{
      system_slug: "dnd-5e-2024",
      years_playing: 1,
      comfort_level: "learning",
      experience_notes: null
    }],
    availability
  };
  let demandPayload = null;
  await page.route("**/api/v1/onboarding/player", async (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ role: "player" }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
  });
  await page.route("**/api/v1/matching/player-demands", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    demandPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "saved-demand", status: "active", ...demandPayload })
    });
  });
  await failImmediateRefresh(page);
  await page.goto(edit ? "/play.html?edit=1" : "/play.html");
  return () => demandPayload;
}

test("Player edit stays READY when the immediate global match refresh fails", async ({ page }) => {
  const demandPayload = await installSavedPlayer(page, { edit: true });
  await expect(page.getByRole("heading", { name: "When can you usually play?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Start Looking for Games" }).click();

  await expect(page.locator("#player-ready")).toBeVisible();
  await expect(page.getByRole("heading", { name: "DDD is looking for games that fit you." })).toBeVisible();
  await expect(page.getByText(DB_FAILURE)).toHaveCount(0);
  expect(demandPayload()?.system_slug).toBe("dnd-5e-2024");
});

test("saved Player can reactivate matching even when immediate refresh fails", async ({ page }) => {
  const demandPayload = await installSavedPlayer(page);
  await expect(page.getByRole("heading", { name: "How far will you travel?" })).toBeVisible();
  await page.getByRole("button", { name: "Review" }).click();
  await page.locator("#conduct-check").check();
  await page.getByRole("button", { name: "Start Looking for Games" }).click();

  await expect(page.locator("#player-ready")).toBeVisible();
  await expect(page.getByText(DB_FAILURE)).toHaveCount(0);
  expect(demandPayload()?.system_slug).toBe("dnd-5e-2024");
});

test("saved DM can reactivate supply even when immediate refresh fails", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "refresh-dm@example.test" });
  const profile = {
    display_name: "Refresh DM",
    bio: null,
    postal_code: "29501",
    travel_radius_miles: 50,
    beginner_friendly: true,
    gm_style: "Balanced mix of roleplay and combat",
    systems: [{
      system_slug: "dnd-5e-2024",
      years_playing: 5,
      years_gming: 3,
      comfort_level: "comfortable",
      preferred_player_experience: "any",
      formats: ["one_shot"],
      experience_notes: null
    }],
    availability
  };
  let supplyPayload = null;
  await page.route("**/api/v1/onboarding/gm", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
  });
  await page.route("**/api/v1/matching/gm-supplies", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    supplyPayload = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "saved-supply", status: "active", ...supplyPayload })
    });
  });
  await failImmediateRefresh(page);
  await page.goto("/dm.html");
  await expect(page.getByRole("heading", { name: "Where and how big?" })).toBeVisible();
  await page.getByLabel("How many Players do you want at your table?").fill("15");
  await page.getByRole("button", { name: "Review" }).click();
  await page.locator("#conduct-check").check();
  await page.getByRole("button", { name: "Start Looking for a Table" }).click();

  await expect(page.locator("#dm-ready")).toBeVisible();
  await expect(page.getByText(DB_FAILURE)).toHaveCount(0);
  expect(supplyPayload?.minimum_players).toBe(15);
  expect(supplyPayload?.maximum_players).toBe(15);
});
