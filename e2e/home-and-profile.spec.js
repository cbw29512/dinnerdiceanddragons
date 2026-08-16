const { test, expect } = require("@playwright/test");
const { expectNoHorizontalOverflow } = require("./helpers");

test("homepage gives Players, DMs, and Venues equal clear entry points", async ({ page }) => {
  await page.goto("/index.html");

  await expect(page.getByRole("heading", { name: /Play more D&D\. Spend less time finding a table\./i })).toBeVisible();
  await expect(page.getByText("I WANT TO PLAY", { exact: true })).toBeVisible();
  await expect(page.getByText("I WANT TO DM", { exact: true })).toBeVisible();
  await expect(page.getByText("I HAVE A VENUE", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Find My Table" }).first().click();
  await expect(page).toHaveURL(/join\.html#player$/);
  await expect(page.locator("#player").getByRole("heading", { name: /Find a D&D table that fits/i })).toBeVisible();
});

test("global header exposes role entry and account access without scrolling", async ({ page }) => {
  await page.goto("/index.html");

  const header = page.locator("header");
  await expect(header.getByRole("link", { name: "Find a Game" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Run a Game" })).toBeVisible();
  await expect(header.getByRole("link", { name: "For Venues" })).toBeVisible();
  await expect(header.getByRole("button", { name: "Sign In" })).toBeVisible();

  await header.getByRole("button", { name: "Sign In" }).click();
  const dialog = page.getByRole("dialog", { name: /One login\. Every way you play\./i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Player Find a table/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /DM Run a game/i })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Venue Host tables/i })).toBeVisible();
  await expect(dialog.getByLabel("Email address")).toBeVisible();
  await expect(dialog.getByLabel("Password")).toBeVisible();
});

test("Join page keeps account access in the header instead of a buried account section", async ({ page }) => {
  await page.goto("/join.html#player");

  await expect(page.locator("#account")).toHaveCount(0);
  await expect(page.locator("header").getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.locator("#player").getByRole("heading", { name: /Find a D&D table that fits/i })).toBeVisible();
});

test("Player can add and remove preferences, save, and continue", async ({ page }) => {
  await page.goto("/join.html#player");
  const form = page.locator("#player-form");

  await expect(form.locator(".experience-entry")).toHaveCount(1);
  await form.locator(".add-experience").click();
  await expect(form.locator(".experience-entry")).toHaveCount(2);
  await form.locator(".experience-entry").last().locator(".remove-experience").click();
  await expect(form.locator(".experience-entry")).toHaveCount(1);

  await expect(form.locator(".availability-entry")).toHaveCount(1);
  await form.locator(".add-availability").click();
  await expect(form.locator(".availability-entry")).toHaveCount(2);
  await form.locator(".availability-entry").last().locator(".remove-availability").click();
  await expect(form.locator(".availability-entry")).toHaveCount(1);

  await form.locator('[name="display_name"]').fill("Browser Test Player");
  await form.locator('[name="email"]').fill("player@example.com");
  await form.locator('[name="postal_code"]').fill("29501");
  await form.locator('.check-label input[type="checkbox"]').check();
  await form.getByRole("button", { name: "Find My Table" }).click();

  await expect(form.locator(".form-status")).toContainText("Saved on this device");
  const stored = await page.evaluate(() => localStorage.getItem("ddd-preview-player"));
  expect(stored).toBeTruthy();
  await expect(page.getByRole("link", { name: "See Forming Games" })).toBeVisible();
});

test("homepage remains usable at a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");

  await expect(page.locator("header").getByRole("button", { name: "Sign In" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Find My Table" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Form My Table" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Fill My Tables" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
});