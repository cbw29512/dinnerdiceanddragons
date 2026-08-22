const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { expectNoHorizontalOverflow, installAuthenticatedSession } = require("./helpers");

const claim = {
  venue_id: "d2000000-0000-4000-8000-000000000001",
  venue_manager_id: "d3000000-0000-4000-8000-000000000001",
  name: "Verification Test Cafe",
  venue_type: "cafe",
  address_line1: "100 West Evans Street",
  address_line2: null,
  city: "Florence",
  state_region: "SC",
  postal_code: "29501",
  website_url: null,
  phone: "843-555-0100",
  manager_role: "manager",
  manager_display_name: "Venue Manager",
  manager_email: "venue-manager@example.test",
  manager_account_status: "active"
};

async function adminMe(page, roles = ["admin"]) {
  await page.route("**/api/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ddd_user_id: "admin-user",
        email: "admin@example.test",
        status: "active",
        roles
      })
    });
  });
}

test("admin can review and verify a pending public Venue claim", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await installAuthenticatedSession(page, { email: "admin@example.test" });
  await adminMe(page);
  let verifyCalls = 0;

  await page.route("**/api/v1/admin/venues/pending-claims", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([claim]) });
  });
  await page.route("**/api/v1/admin/venues/*/manager-claims/*/verify", async (route) => {
    verifyCalls += 1;
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/admin-venues.html");
  await expect(page.getByRole("heading", { name: "Venue Verification" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verification Test Cafe" })).toBeVisible();
  await expect(page.getByText("100 West Evans Street, Florence, SC 29501")).toBeVisible();
  await expect(page.getByText("venue-manager@example.test")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("button", { name: "Verify Venue" }).click();
  await expect(page.locator("#pending-count")).toHaveText("0");
  await expect(page.getByRole("heading", { name: "No pending Venue claims." })).toBeVisible();
  await expect(page.locator("#queue-status")).toContainText("active table times can now enter matching");
  expect(verifyCalls).toBe(1);
});

test("non-admin cannot load the Venue verification queue", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "player@example.test" });
  await adminMe(page, ["player"]);
  let queueCalls = 0;
  await page.route("**/api/v1/admin/venues/pending-claims", async (route) => {
    queueCalls += 1;
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ detail: "Forbidden" }) });
  });

  await page.goto("/admin-venues.html");
  await expect(page.getByRole("heading", { name: "Administrator access required." })).toBeVisible();
  await expect(page.locator("#verification-content")).toBeHidden();
  expect(queueCalls).toBe(0);
});

test("My DDD exposes Venue verification only to admins", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "admin@example.test" });
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/v1/auth/session") return route.fallback();
    if (pathname === "/api/v1/me") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ddd_user_id: "admin-user", email: "admin@example.test", status: "active", roles: ["admin"] }) });
    if (pathname === "/api/v1/onboarding/player" || pathname === "/api/v1/onboarding/gm") return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not configured" }) });
    if (["/api/v1/notifications", "/api/v1/game-hubs", "/api/v1/matching/opportunities"].includes(pathname)) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    if (pathname === "/api/v1/notification-preferences") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matching_paused: false }) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });

  await page.goto("/my-ddd.html");
  await expect(page.locator("#admin-shortcut")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Venue Verification" })).toHaveAttribute("href", "admin-venues.html");
});
