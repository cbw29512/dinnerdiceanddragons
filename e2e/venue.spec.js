const { test, expect } = require("@playwright/test");

test("Venue can save calendar availability and hand off to the private production Game Hub", async ({ page }) => {
  await page.goto("/venues.html#signup");
  const form = page.locator("#venue-form");

  await expect(page.getByRole("heading", { name: /Bring organized D&D groups/i })).toBeVisible();
  await expect(form.locator(".ddd-step-progress")).toContainText("Step 1 of 3");
  await form.locator('[name="business_name"]').fill("Browser Test Tavern");
  await form.locator('[name="contact_name"]').fill("Venue Manager");
  await form.locator('[name="email"]').fill("venue@example.com");
  await form.locator('[name="address"]').fill("100 Test Street");
  await form.locator('[name="city"]').fill("Florence");
  await form.locator('[name="state"]').fill("SC");
  await form.locator('[name="postal_code"]').fill("29501");
  await form.getByRole("button", { name: "Continue" }).click();

  await expect(form.locator(".calendar-grid")).toBeVisible();
  await expect(form.locator(".availability-chip")).toHaveCount(1);
  await form.getByRole("button", { name: "Continue" }).click();

  await form.locator('[name="purchase_policy"]').fill("One food or drink purchase per guest.");
  await form.locator('.check-label input[type="checkbox"]').last().check();
  await form.getByRole("button", { name: "Save My Open Tables" }).click();
  await expect(form.locator(".form-status")).toContainText("Saved on this device");

  const stored = await page.evaluate(() => localStorage.getItem("ddd-preview-venue"));
  expect(stored).toBeTruthy();
  const values = JSON.parse(stored);
  expect(values.business_name).toBe("Browser Test Tavern");
  expect(values.availability_day).toBeTruthy();

  const hubLink = page.getByRole("link", { name: "See the Venue Game Hub" });
  await expect(hubLink).toBeVisible();
  await hubLink.click();
  await expect(page).toHaveURL(/game-hub\.html\?role=venue_manager$/);

  await expect(page.locator("#hub-error-title")).toHaveText("Sign in to open your Game Hubs.");
  await expect(page.locator("#hub-content")).toBeHidden();
  await expect(page.locator("#hub-index")).toBeHidden();
});
