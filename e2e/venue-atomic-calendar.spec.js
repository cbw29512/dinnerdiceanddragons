const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

test("new Venue saves every selected availability block in one atomic calendar request", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "atomicvenue@example.test" });
  let calendarPayload = null;
  let postWindowCalls = 0;

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ddd_user_id: "atomic-venue-user",
        email: "atomicvenue@example.test",
        status: "active",
        roles: []
      })
    });
  });
  await page.route("**/api/v1/onboarding/venue", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        venue_id: "venue-atomic",
        venue_manager_id: "manager-atomic",
        name: "Atomic Test Cafe",
        slug: "atomic-test-cafe",
        role: "manager",
        venue_verified: false,
        manager_verified: false
      })
    });
  });
  await page.route("**/api/v1/matching/venues/venue-atomic/table-windows", async (route) => {
    if (route.request().method() === "PUT") {
      calendarPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          venue_id: "venue-atomic",
          matching_eligible: false,
          table_count: calendarPayload.table_count,
          max_people_per_table: calendarPayload.max_people_per_table,
          availability: calendarPayload.availability
        })
      });
    }
    if (route.request().method() === "POST") postWindowCalls += 1;
    return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
  });

  await page.goto("/host.html");
  await page.getByLabel("Host / manager name").fill("Venue Manager");
  await page.locator('[data-action="account"]').click();
  await expect(page.getByRole("heading", { name: "Where will games be hosted?" })).toBeVisible();

  await page.getByLabel("Venue name").fill("Atomic Test Cafe");
  await page.getByLabel("Public street address").fill("100 Atomic Way");
  await page.getByLabel("City").fill("Florence");
  await page.getByLabel("State").fill("SC");
  await page.getByLabel("ZIP code").fill("29501");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Weeknights 6–10 PM" }).click();
  await expect(page.locator('[name="availability_day[]"]')).toHaveCount(5);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.locator("#conduct-check").check();
  await page.getByRole("button", { name: "Submit Venue" }).click();

  await expect(page.getByRole("heading", { name: "Your venue and table times are saved." })).toBeVisible();
  expect(postWindowCalls).toBe(0);
  expect(calendarPayload).not.toBeNull();
  expect(calendarPayload.availability).toHaveLength(5);
  expect(calendarPayload.table_count).toBe(1);
  expect(calendarPayload.max_people_per_table).toBe(6);
});
