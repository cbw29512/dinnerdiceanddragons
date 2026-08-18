const { test, expect } = require("@playwright/test");
const { mockZipLookup } = require("./helpers");

test("DM can match Players and venue, create a table, and hand off to the production Game Hub", async ({ page }) => {
  await mockZipLookup(page);
  await page.goto("/find-venue.html");

  await page.locator("#match-system").selectOption({ label: "D&D 5e" });
  await page.locator("#match-day").selectOption({ label: "Tuesday" });
  await page.locator("#match-start").fill("18:00");
  await page.locator("#match-duration").selectOption("240");
  await page.locator("#match-zip").fill("29501");
  await page.locator("#match-radius").selectOption("25");
  await page.getByRole("button", { name: "Find Players + Venues" }).click();

  const startForming = page.getByRole("button", { name: "Start Forming This Table" }).first();
  await expect(startForming).toBeVisible();
  await startForming.click();
  await expect(page).toHaveURL(/create-game\.html$/);

  const form = page.locator("#game-form");
  await expect(form.locator("#game-venue")).not.toHaveValue("");
  await form.locator('[name="title"]').fill("Browser Test Adventure");
  await form.locator('[name="system"]').selectOption({ label: "D&D 5e 2024" });
  await form.locator('[name="description"]').fill("A welcoming local D&D adventure used to verify the table workflow.");
  await form.locator('[name="play_style"]').fill("Friendly roleplay with tactical combat.");
  await form.locator('[name="boundaries"]').fill("Respectful table, no PvP, use safety tools.");
  await form.locator('.check-label input[type="checkbox"]').check();
  await form.getByRole("button", { name: "Create My Forming Table" }).click();

  await expect(form.locator(".form-status")).toContainText("Saved on this device");
  await expect(page.locator("#game-next-step")).toBeVisible();
  await page.getByRole("link", { name: "Review Players & Confirm the Table" }).click();
  await expect(page).toHaveURL(/table-lifecycle\.html\?role=gm$/);

  await expect(page.locator("#shared-lifecycle")).toBeHidden();
  await expect(page.locator("#local-lifecycle-demo")).toBeVisible();
  await page.locator("#toggle-venue").click();
  await page.locator("#add-player").click();
  await page.locator("#add-player").click();
  await page.locator("#add-player").click();

  await expect(page.locator("#table-state")).toHaveText("Confirmed");
  await expect(page.locator("#game-hub-link")).toBeEnabled();
  await page.locator("#game-hub-link").click();
  await expect(page).toHaveURL(/game-hub\.html\?role=gm$/);

  // The prototype flow intentionally hands off to the real private Hub now.
  // Without a production auth session, it must fail closed instead of showing sample data.
  await expect(page.locator("#hub-error-title")).toHaveText("Sign in to open your Game Hubs.");
  await expect(page.locator("#hub-content")).toBeHidden();
  await expect(page.locator("#hub-index")).toBeHidden();
});
