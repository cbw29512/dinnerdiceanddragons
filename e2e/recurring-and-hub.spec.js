const { test, expect } = require("@playwright/test");
const { mockZipLookup } = require("./helpers");

test("DM can check recurring dates, create the recurring table, and review commitments", async ({ page }) => {
  await mockZipLookup(page);
  await page.goto("/recurring-match.html");

  await page.locator("#series-system").selectOption({ label: "D&D 5e" });
  await page.locator("#series-day").selectOption({ label: "Tuesday" });
  await expect(page.locator("#series-anchor")).not.toHaveValue("");
  await page.locator("#series-start").fill("18:00");
  await page.locator("#series-duration").selectOption("240");
  await page.locator("#series-zip").fill("29501");
  await page.locator("#series-radius").selectOption("25");
  await page.getByRole("button", { name: "Check My Next 6 Game Nights" }).click();

  const continueButton = page.getByRole("button", { name: "Continue With These Dates" }).first();
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await expect(page).toHaveURL(/form-series\.html$/);

  await expect(page.locator('input[name="series_session"]:checked').first()).toBeVisible();
  await page.locator("#series-title").fill("Browser Test Campaign");
  await page.locator("#series-confirm").check();
  await page.getByRole("button", { name: "Create My Recurring Table" }).click();
  await expect(page.locator("#series-form-status")).toContainText("Recurring table created");

  await page.getByRole("link", { name: "Review Players & Venue" }).click();
  await expect(page).toHaveURL(/series-commitments\.html$/);
  await expect(page.locator("#player-requests")).toContainText("No Player requests waiting for review");

  await page.locator("#request-player-name").fill("Sample Taylor");
  await page.getByRole("button", { name: "Add Sample Request" }).click();
  await page.locator("#player-requests").getByRole("button", { name: "Accept" }).click();
  await expect(page.locator("#core-party")).toContainText("Sample Taylor");

  await page.locator("#venue-approval").getByRole("button", { name: "Use This Venue" }).click();
  await page.locator("#venue-approval").getByRole("button", { name: "Mark Venue Confirmed" }).click();
  await expect(page.locator("#commitment-summary")).toContainText("Venue confirmed");
});

test("Game Hub role switch and message preview work", async ({ page }) => {
  await page.goto("/game-hub.html?role=player");

  await expect(page.locator('.hub-role[data-role="player"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#player-view")).toBeVisible();

  const discussion = page.locator('#player-view form[data-channel="discussion"]');
  await discussion.locator("textarea").fill("I will arrive ten minutes early.");
  await discussion.getByRole("button", { name: "Add Preview" }).click();
  await expect(page.locator("#hub-status")).toHaveText("Preview added to this page only. No message was sent.");
  await expect(page.locator("#player-view .message.success-message")).toContainText("I will arrive ten minutes early.");

  await page.locator('.hub-role[data-role="venue"]').click();
  await expect(page.locator('.hub-role[data-role="venue"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#venue-view")).toBeVisible();
  await expect(page).toHaveURL(/role=venue/);
});
