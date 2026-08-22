const { test, expect } = require("@playwright/test");
const { expectNoHorizontalOverflow } = require("./helpers");

test("homepage gives Players, DMs, and Venues equal clear entry points", async ({ page }) => {
  await page.goto("/index.html");

  await expect(page.getByRole("heading", { name: "What do you want to do?" })).toBeVisible();
  await expect(page.getByText("I WANT TO PLAY", { exact: true })).toBeVisible();
  await expect(page.getByText("I WANT TO RUN", { exact: true })).toBeVisible();
  await expect(page.getByText("I HAVE A VENUE", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play D&D" })).toHaveAttribute("href", "play.html");
  await expect(page.getByRole("link", { name: "DM a Game" })).toHaveAttribute("href", "dm.html");
  await expect(page.getByRole("link", { name: "Host Games" })).toHaveAttribute("href", "host.html");
});

test("homepage header keeps the primary choices simple", async ({ page }) => {
  await page.goto("/index.html");

  const header = page.locator("header");
  await expect(header.getByRole("link", { name: "How it works" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Safety" })).toBeVisible();
  await expect(header.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "signin.html");
  await expect(header.getByRole("button", { name: "Sign In" })).toHaveCount(0);
});

test("legacy Join URL is a compatibility chooser, not the old giant form", async ({ page }) => {
  await page.goto("/join.html#player");

  await expect(page.locator("#player-form")).toHaveCount(0);
  await expect(page.locator("#gm-form")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Find a Game" })).toHaveAttribute("href", "play.html");
  await expect(page.getByRole("link", { name: "DM a Game" })).toHaveAttribute("href", "dm.html");
  await expect(page.getByRole("link", { name: "Host Games" })).toHaveAttribute("href", "host.html");
});

test("unsigned Player starts with account setup instead of a browser-only draft", async ({ page }) => {
  await page.goto("/play.html");

  await expect(page.getByRole("heading", { name: "Create your free account." })).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("ddd-preview-player"))).toBeNull();
});

test("homepage remains usable at a phone-sized viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");

  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Play D&D" })).toBeVisible();
  await expect(page.getByRole("link", { name: "DM a Game" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Host Games" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});