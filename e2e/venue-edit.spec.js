const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

const VENUE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function savedVenue() {
  return {
    id: VENUE_ID,
    name: "Calendar Test Cafe",
    address_line1: "123 Public Table Way",
    city: "Florence",
    state_region: "SC",
    postal_code: "29501",
    location_kind: "public_venue",
    verified: true,
    active: true,
    manager_role: "manager",
    manager_verified: true
  };
}

function savedWindow() {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    venue_id: VENUE_ID,
    active: true,
    matching_eligible: true,
    availability: {
      day_of_week: "saturday",
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
    },
    table_count: 1,
    max_people_per_table: 6,
    purchase_policy: "No minimum purchase",
    approval_required: false,
    environment_notes: "Accessible entrance"
  };
}

test("returning Venue manager can replace a saved calendar without recreating the Venue", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "venue-manager@example.test" });
  let replacement = null;
  let venueCreates = 0;

  await page.route("**/api/v1/onboarding/venues", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([savedVenue()]) });
  });
  await page.route(`**/api/v1/matching/venues/${VENUE_ID}/table-windows`, async (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([savedWindow()]) });
    }
    replacement = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ venue_id: VENUE_ID, matching_eligible: true, ...replacement }) });
  });
  await page.route("**/api/v1/onboarding/venue", async (route) => {
    venueCreates += 1;
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ detail: "Edit mode must not create a Venue" }) });
  });

  await page.goto(`/host.html?edit=${VENUE_ID}`);
  await expect(page.getByRole("heading", { name: "When can you host a game?" })).toBeVisible();
  await expect(page.getByLabel("Venue name")).toHaveValue("Calendar Test Cafe");
  await expect(page.getByLabel("Public street address")).toHaveValue("123 Public Table Way");
  await expect(page.locator('[name="availability_day[]"]')).toHaveValue("Saturday");

  await page.getByRole("button", { name: "Sunday 1–6 PM" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: "Save Calendar" }).click();

  await expect(page.getByRole("heading", { name: "Your Venue calendar is updated." })).toBeVisible();
  expect(venueCreates).toBe(0);
  expect(replacement.table_count).toBe(1);
  expect(replacement.max_people_per_table).toBe(6);
  expect(replacement.availability.map((item) => item.day_of_week)).toEqual(["saturday", "sunday"]);
});