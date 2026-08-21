const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

const VENUE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("Venue manager saves guided availability durably without a browser-only pending schedule", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "venue@example.test" });
  let venuePayload = null;
  let calendarPayload = null;

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ddd_user_id: "venue-user", email: "venue@example.test", status: "active", roles: [] })
    });
  });
  await page.route("**/api/v1/onboarding/venue", async (route) => {
    venuePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        venue_id: VENUE_ID,
        venue_manager_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        name: venuePayload.name,
        slug: "browser-test-tavern",
        role: "manager",
        venue_verified: false,
        manager_verified: false
      })
    });
  });
  await page.route(`**/api/v1/matching/venues/${VENUE_ID}/table-windows`, async (route) => {
    expect(route.request().method()).toBe("PUT");
    calendarPayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        venue_id: VENUE_ID,
        active: true,
        matching_eligible: false,
        table_count: calendarPayload.table_count,
        max_people_per_table: calendarPayload.max_people_per_table,
        availability: calendarPayload.availability
      })
    });
  });

  await page.goto("/host.html");
  await page.getByLabel("Host / manager name").fill("Venue Manager");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Where will games be hosted?" })).toBeVisible();
  await page.getByLabel("Venue name").fill("Browser Test Tavern");
  await page.getByLabel("Public street address").fill("100 Test Street");
  await page.getByLabel("City").fill("Florence");
  await page.getByLabel("State").fill("SC");
  await page.getByLabel("ZIP code").fill("29501");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "When can you host a game?" })).toBeVisible();
  await page.getByRole("button", { name: "Saturday 6–10 PM" }).click();
  await expect(page.locator('[name="availability_day[]"]')).toHaveValue("Saturday");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Purchase policy").selectOption({ label: "Each guest should purchase food or drink" });
  await page.getByRole("button", { name: "Review" }).click();
  await page.locator("#conduct-check").check();
  await page.getByRole("button", { name: "Submit Venue" }).click();

  await expect(page.getByRole("heading", { name: "Your venue and table times are saved." })).toBeVisible();
  expect(venuePayload.name).toBe("Browser Test Tavern");
  expect(venuePayload.venue_type).toBe("public_venue");
  expect(calendarPayload).not.toBeNull();
  expect(calendarPayload.availability).toHaveLength(1);
  expect(calendarPayload.availability[0].day_of_week).toBe("saturday");
  expect(calendarPayload.availability[0].start_time).toBe("18:00");
  expect(calendarPayload.availability[0].end_time).toBe("22:00");
  expect(calendarPayload.table_count).toBe(1);
  expect(calendarPayload.max_people_per_table).toBe(6);
  expect(await page.evaluate(() => localStorage.getItem("ddd-pending-production-venue-window"))).toBeNull();
});