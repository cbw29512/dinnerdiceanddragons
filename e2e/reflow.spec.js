const { test, expect } = require("@playwright/test");
const { expectNoHorizontalOverflow } = require("./helpers");

const paths = [
  "/index.html",
  "/play.html",
  "/dm.html",
  "/host.html",
  "/signin.html",
  "/my-ddd.html",
  "/join.html",
  "/venues.html",
  "/notifications.html",
  "/opportunity.html",
  "/create-game.html",
  "/game-hub.html",
  "/conduct.html"
];

for (const path of paths) {
  test(`320px reflow has no horizontal page overflow: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.route("**/api/v1/auth/session", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: false }) });
    });
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}