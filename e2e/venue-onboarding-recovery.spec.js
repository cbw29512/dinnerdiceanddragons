const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

test("managed Venue without a calendar resumes setup instead of creating a duplicate", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "incompletevenue@example.test" });

  const venue = {
    id: "venue-1",
    name: "Incomplete Test Cafe",
    address_line1: "100 Main St",
    city: "Florence",
    state_region: "SC",
    postal_code: "29501",
    verified: false,
    active: true,
    manager_role: "manager",
    manager_verified: false,
    calendar_ready: false
  };
  let savedCalendar = null;

  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ddd_user_id: "venue-user",
        email: "incompletevenue@example.test",
        status: "active",
        roles: ["venue_manager"]
      })
    });
  });
  await page.route("**/api/v1/onboarding/venues", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([venue])
    });
  });
  await page.route("**/api/v1/matching/venues/venue-1/table-windows", async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]"
      });
    }
    savedCalendar = route.request().postDataJSON();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        venue_id: "venue-1",
        matching_eligible: false,
        table_count: savedCalendar.table_count,
        max_people_per_table: savedCalendar.max_people_per_table,
        availability: savedCalendar.availability
      })
    });
  });

  await page.goto("/host.html");
  await expect(page).toHaveURL(/host\.html\?edit=venue-1$/);
  await expect(page.getByRole("heading", { name: "When can you host a game?" })).toBeVisible();
  await expect(page.locator("#availability-status")).toContainText("Venue is saved");

  await page.getByRole("button", { name: "Saturday 6–10 PM" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Save Calendar" }).click();

  await expect(page.getByRole("heading", { name: "Your Venue calendar is updated." })).toBeVisible();
  expect(savedCalendar).not.toBeNull();
  expect(savedCalendar.availability).toHaveLength(1);
  expect(savedCalendar.table_count).toBe(1);
  expect(savedCalendar.max_people_per_table).toBe(6);
});
