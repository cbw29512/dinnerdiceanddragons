const { test, expect } = require("@playwright/test");
const { expectNoHorizontalOverflow } = require("./helpers");

const paths = [
  "/index.html",
  "/join.html#player",
  "/join.html#gm",
  "/venues.html",
  "/find-venue.html",
  "/create-game.html",
  "/recurring-match.html",
  "/series-commitments.html",
  "/table-lifecycle.html?role=gm",
  "/game-hub.html?role=player",
];

for (const path of paths) {
  test(`320px reflow has no horizontal page overflow: ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}
