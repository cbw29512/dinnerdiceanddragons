const { test, expect } = require("@playwright/test");

test("Venue can save an open table and continue to its game-night view", async ({ page }) => {
  await page.goto("/venues.html#signup");
  const form = page.locator("#venue-form");

  await expect(page.getByRole("heading", { name: /Bring organized D&D groups/i })).toBeVisible();
  await form.locator('[name="business_name"]').fill("Browser Test Tavern");
  await form.locator('[name="contact_name"]').fill("Venue Manager");
  await form.locator('[name="email"]').fill("venue@example.com");
  await form.locator('[name="address"]').fill("100 Test Street");
  await form.locator('[name="city"]').fill("Florence");
  await form.locator('[name="state"]').fill("SC");
  await form.locator('[name="postal_code"]').fill("29501");
  await form.locator('[name="window_day"]').selectOption({ label: "Tuesday" });
  await form.locator('[name="window_start"]').fill("18:00");
  await form.locator('[name="window_end"]').fill("22:00");
  await form.locator('[name="purchase_policy"]').fill("One food or drink purchase per guest.");
  await form.locator('.check-label input[type="checkbox"]').last().check();

  await form.getByRole("button", { name: "Save My Open Table" }).click();
  await expect(form.locator(".form-status")).toContainText("Saved on this device");

  const stored = await page.evaluate(() => localStorage.getItem("ddd-preview-venue"));
  expect(stored).toBeTruthy();
  expect(JSON.parse(stored).business_name).toBe("Browser Test Tavern");

  const hubLink = page.getByRole("link", { name: "See the Venue Game Hub" });
  await expect(hubLink).toBeVisible();
  await hubLink.click();
  await expect(page).toHaveURL(/game-hub\.html\?role=venue$/);
  await expect(page.locator('.hub-role[data-role="venue"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#venue-view")).toBeVisible();
});
