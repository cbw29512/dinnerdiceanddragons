const { test, expect } = require("@playwright/test");
const { expectNoHorizontalOverflow, installAuthenticatedSession } = require("./helpers");

const DEFAULT_PREFS = Object.freeze({
  email_match_alerts: true,
  email_event_updates: true,
  browser_push: false,
  digest_mode: "immediate",
  matching_paused: false
});

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
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "signin.html");
});

test("homepage consumes an account confirmation link and continues to My DDD", async ({ page }) => {
  let confirmationBody = null;
  await page.route("**/api/v1/auth/confirm", async (route) => {
    confirmationBody = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ confirmed: true, id: "confirmed-user", email: "confirmed@example.test" }) });
  });
  await page.route("**/api/v1/auth/session", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, id: "confirmed-user", email: "confirmed@example.test" }) });
  });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/v1/auth/")) return route.fallback();
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });

  await page.goto("/index.html#confirmation_token=one-time-token");
  await expect(page).toHaveURL(/my-ddd\.html$/);
  expect(confirmationBody).toEqual({ token: "one-time-token" });
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
  await expect(page.getByRole("heading", { name: "Tell us when your public venue has tables open." })).toBeVisible();
  await expect(page.getByText(/Step 1 of/)).toBeVisible();
});

test("DM Player seat count starts at one and has no arbitrary product maximum", async ({ page }) => {
  await page.goto("/dm.html");
  const playerCount = page.locator('input[name="player_count"]');
  await expect(playerCount).toHaveAttribute("type", "number");
  await expect(playerCount).toHaveAttribute("min", "1");
  await expect(playerCount).not.toHaveAttribute("max", /.+/);
  await expect(playerCount).toHaveAttribute("step", "1");
});

test("returning DM can edit availability without reopening advanced setup", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "returningdm@example.test" });
  const gm = {
    display_name: "Returning DM",
    bio: "Preserve me",
    postal_code: "29501",
    travel_radius_miles: 25,
    beginner_friendly: true,
    gm_style: "Roleplay-forward",
    systems: [{
      system_slug: "dnd-5e-2024",
      years_playing: 10,
      years_gming: 5,
      comfort_level: "expert",
      preferred_player_experience: "any",
      formats: ["one_shot"],
      experience_notes: "Existing settings"
    }],
    availability: [{
      day_of_week: "saturday", start_time: "18:00", end_time: "22:00",
      pattern_type: "weekly_interval", week_interval: 1, timezone: "America/New_York"
    }]
  };
  await page.route("**/api/v1/onboarding/gm", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gm) });
  });
  await page.route("**/api/v1/matching/gm-supplies", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{
      id: "supply-1", status: "active", system_slug: "dnd-5e-2024", preferred_format: "one_shot",
      preferred_cadence: "weekly", minimum_players: 3, maximum_players: 5, table_style: "Roleplay-forward"
    }]) });
  });

  await page.goto("/dm.html?edit=1");
  await expect(page.getByRole("heading", { name: "When can you DM?" })).toBeVisible();
  await expect(page.getByText("Update 1 of 3")).toBeVisible();
  await expect(page.locator('input[name="player_count"]')).toBeHidden();
  await expect(page.locator('[name="availability_day[]"]')).toHaveValue("Saturday");
});

test("saved DM profile without a supply resumes matching instead of showing false READY", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "resumedm@example.test" });
  const gm = {
    display_name: "Resume DM", bio: null, postal_code: "29501", travel_radius_miles: 50,
    beginner_friendly: false, gm_style: "Balanced mix of roleplay and combat",
    systems: [{ system_slug: "dnd-5e-2014", years_playing: 0, years_gming: 0, comfort_level: "comfortable", preferred_player_experience: "any", formats: ["one_shot"], experience_notes: null }],
    availability: [{ day_of_week: "saturday", start_time: "18:00", end_time: "22:00", pattern_type: "weekly_interval", week_interval: 1, timezone: "America/New_York" }]
  };
  let supplyPayload = null;
  await page.route("**/api/v1/onboarding/gm", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(gm) }));
  await page.route("**/api/v1/matching/gm-supplies", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    supplyPayload = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "new-supply", status: "active", ...supplyPayload }) });
  });
  await page.route("**/api/v1/matching/find-my-table", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ created: 0 }) }));
  await page.route("**/api/v1/matching/opportunities", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await page.goto("/dm.html");
  await expect(page.getByRole("heading", { name: "Where and how big?" })).toBeVisible();
  await expect(page.locator("#dm-ready")).toBeHidden();
  await page.getByLabel("How many Players do you want at your table?").fill("15");
  await page.getByRole("button", { name: "Review" }).click();
  await expect(page.getByText("15 Players")).toBeVisible();
  await page.locator("#conduct-check").check();
  await page.getByRole("button", { name: "Start Looking for a Table" }).click();
  await expect(page.locator("#dm-ready")).toBeVisible();
  expect(supplyPayload.minimum_players).toBe(15);
  expect(supplyPayload.maximum_players).toBe(15);
  expect(supplyPayload.system_slug).toBe("dnd-5e-2014");
});

test("saved Player profile without demand resumes matching instead of showing false READY", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "resumeplayer@example.test" });
  const player = {
    display_name: "Resume Player", bio: null, postal_code: "29501", travel_radius_miles: 25,
    preferred_format: "any", willing_to_learn_new_system: true, environment_preferences: [],
    systems: [{ system_slug: "dnd-5e-2024", years_playing: 0, comfort_level: "new", experience_notes: null }],
    availability: [{ day_of_week: "friday", start_time: "18:00", end_time: "22:00", pattern_type: "weekly_interval", week_interval: 1, timezone: "America/New_York" }]
  };
  let demandPayload = null;
  await page.route("**/api/v1/onboarding/player", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(player) }));
  await page.route("**/api/v1/matching/player-demands", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    demandPayload = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "new-demand", status: "active", ...demandPayload }) });
  });
  await page.route("**/api/v1/matching/find-my-table", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ created: 0 }) }));
  await page.route("**/api/v1/matching/opportunities", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

  await page.goto("/play.html");
  await expect(page.getByRole("heading", { name: "How far will you travel?" })).toBeVisible();
  await expect(page.locator("#player-ready")).toBeHidden();
  await page.getByRole("button", { name: "Review" }).click();
  await page.locator("#conduct-check").check();
  await page.getByRole("button", { name: "Start Looking for Games" }).click();
  await expect(page.locator("#player-ready")).toBeVisible();
  expect(demandPayload.system_slug).toBe("dnd-5e-2024");
});

test("returning Venue Manager is not pushed into duplicate Venue creation", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "venue@example.test" });
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ddd_user_id: "venue-user", email: "venue@example.test", status: "active", roles: ["venue_manager"] }) });
  });
  await page.route("**/api/v1/onboarding/venues", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "venue-1", name: "Returning Test Cafe", city: "Florence", state_region: "SC", verified: true }]) });
  });

  await page.goto("/host.html");
  await expect(page.getByRole("heading", { name: "Choose a Venue calendar to change." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Add Another Venue" })).toHaveAttribute("href", "host.html?new=1");
  await expect(page.locator("#venue-start-form")).toBeHidden();
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
    if (url.pathname === "/api/v1/matching/player-demands") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "d1", status: "active" }]) });
    if (url.pathname === "/api/v1/matching/gm-supplies") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "s1", status: "active" }]) });
    if (url.pathname === "/api/v1/notifications") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "n1", state: "pending" }]) });
    if (url.pathname === "/api/v1/game-hubs") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ event_id: "e1" }]) });
    if (url.pathname === "/api/v1/matching/opportunities") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (url.pathname === "/api/v1/notification-preferences") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DEFAULT_PREFS) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });
  await page.goto("/my-ddd.html");
  await expect(page.getByText("You’re available for games.")).toBeVisible();
  await expect(page.getByText("You’re available to DM.")).toBeVisible();
  await expect(page.locator("#dm-status-action")).toHaveAttribute("href", "dm.html?edit=1");
  await expect(page.locator("#alert-count")).toHaveText("1");
  await expect(page.locator("#hub-count")).toHaveText("1");
});

test("My DDD does not call a saved profile active when matching has no signal", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "savedonly@example.test" });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/session") return route.fallback();
    const profile = { display_name: "Saved Only", postal_code: "29501", travel_radius_miles: 25, systems: [{ system_slug: "dnd-5e-2024" }], availability: [{ day_of_week: "friday" }] };
    if (url.pathname === "/api/v1/onboarding/player" || url.pathname === "/api/v1/onboarding/gm") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
    if (url.pathname === "/api/v1/matching/player-demands" || url.pathname === "/api/v1/matching/gm-supplies" || url.pathname === "/api/v1/notifications" || url.pathname === "/api/v1/game-hubs" || url.pathname === "/api/v1/matching/opportunities") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (url.pathname === "/api/v1/notification-preferences") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DEFAULT_PREFS) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });

  await page.goto("/my-ddd.html");
  await expect(page.getByText("Your Player profile is saved.")).toBeVisible();
  await expect(page.getByText("Your DM profile is saved.")).toBeVisible();
  await expect(page.getByText("You’re available for games.")).toHaveCount(0);
  await expect(page.getByText("You’re available to DM.")).toHaveCount(0);
  await expect(page.locator("#player-status-action")).toHaveAttribute("href", "play.html");
  await expect(page.locator("#dm-status-action")).toHaveAttribute("href", "dm.html");
});

test("My DDD pause sends a complete preference update", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "pause@example.test" });
  let savedPreferences = null;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/v1/auth/session") return route.fallback();
    if (url.pathname === "/api/v1/onboarding/player" || url.pathname === "/api/v1/onboarding/gm") return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not configured" }) });
    if (url.pathname === "/api/v1/notifications" || url.pathname === "/api/v1/game-hubs" || url.pathname === "/api/v1/matching/opportunities") return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (url.pathname === "/api/v1/notification-preferences" && method === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(DEFAULT_PREFS) });
    if (url.pathname === "/api/v1/notification-preferences" && method === "PUT") {
      savedPreferences = route.request().postDataJSON();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(savedPreferences) });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });

  await page.goto("/my-ddd.html");
  await page.locator("#matching-paused").check();
  await expect(page.locator("#pause-status")).toContainText("paused");
  expect(savedPreferences).toEqual({ ...DEFAULT_PREFS, matching_paused: true });
});