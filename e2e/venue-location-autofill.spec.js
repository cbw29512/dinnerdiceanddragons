const { test, expect } = require("@playwright/test");
const { installAuthenticatedSession } = require("./helpers");

async function openVenueLocationStep(page) {
  await installAuthenticatedSession(page, { email: "venue-location@example.test" });
  await page.goto("/host.html?new=1");
  await page.getByLabel("Host / manager name").fill("Venue Manager");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Where will games be hosted?" })).toBeVisible();
}

test("Venue ZIP auto-fills visible editable City and State fields", async ({ page }) => {
  await page.route("**/.netlify/functions/postal-lookup?zip=29501", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ postal_code: "29501", city: "Florence", state: "SC" })
    });
  });

  await openVenueLocationStep(page);
  const city = page.getByLabel("City");
  const state = page.getByLabel("State");
  await expect(city).toBeVisible();
  await expect(state).toBeVisible();

  await page.getByLabel("ZIP code").fill("29501");
  await expect(city).toHaveValue("Florence");
  await expect(state).toHaveValue("SC");
  await expect(page.locator("#venue-details-status")).toContainText("filled from ZIP");

  const cityStyle = await city.evaluate((node) => {
    const style = getComputedStyle(node);
    return { opacity: style.opacity, position: style.position };
  });
  expect(cityStyle.opacity).toBe("1");
  expect(cityStyle.position).not.toBe("absolute");

  await city.fill("Florence Test");
  await state.fill("SC");
  await expect(city).toHaveValue("Florence Test");
});

test("Venue City and State remain usable when ZIP lookup is unavailable", async ({ page }) => {
  await page.route("**/.netlify/functions/postal-lookup?zip=29501", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Location lookup is temporarily unavailable." })
    });
  });

  await openVenueLocationStep(page);
  await page.getByLabel("ZIP code").fill("29501");
  await expect(page.locator("#venue-details-status")).toContainText("Enter City and State manually");
  await page.getByLabel("City").fill("Florence");
  await page.getByLabel("State").fill("SC");
  await expect(page.getByLabel("City")).toHaveValue("Florence");
  await expect(page.getByLabel("State")).toHaveValue("SC");
});
