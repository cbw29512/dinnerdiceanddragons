const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

test("signed-in shared account control switches DDD role context without another login", async ({ page }) => {
  await installAuthenticatedSession(page, { email: "multi-role@example.test" });
  await page.route("**/api/v1/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/v1/auth/session") return route.fallback();
    if (pathname === "/api/v1/me") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ddd_user_id: "multi-role-user",
          email: "multi-role@example.test",
          status: "active",
          roles: ["player", "gm", "venue_manager", "admin"]
        })
      });
    }
    if (pathname === "/api/v1/game-hubs") {
      return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    }
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ detail: "Not found" }) });
  });

  await page.goto("/game-hub.html");

  const trigger = page.locator("#ddd-global-account-button");
  await expect(trigger).toHaveText("My DDD ▾");
  await trigger.click();

  await expect(page.getByRole("heading", { name: "Switch DDD role" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Player.*On this account/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /DM.*On this account/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Venue.*On this account/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Admin.*On this account/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open My DDD" })).toHaveAttribute("href", "my-ddd.html");

  await page.getByRole("button", { name: /DM.*On this account/ }).click();
  await expect(page.locator("#ddd-continue-role")).toHaveAttribute("href", "dm.html");
  await expect(page.locator("#ddd-continue-role")).toHaveText("Continue to DM a Game →");

  await page.getByRole("button", { name: /Venue.*On this account/ }).click();
  await expect(page.locator("#ddd-continue-role")).toHaveAttribute("href", "host.html");

  await page.getByRole("button", { name: /Admin.*On this account/ }).click();
  await expect(page.locator("#ddd-continue-role")).toHaveAttribute("href", "admin-venues.html");
});
