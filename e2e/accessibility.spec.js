const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const { mockZipLookup } = require("./helpers");

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const pages = [
  "/index.html",
  "/join.html#player",
  "/join.html#gm",
  "/venues.html",
  "/find-venue.html",
  "/create-game.html",
  "/recurring-match.html",
  "/form-series.html",
  "/series-commitments.html",
  "/table-lifecycle.html?role=gm",
  "/game-hub.html?role=player",
  "/conduct.html",
  "/reputation.html",
  "/venue-feedback.html",
  "/games/lighthouse-at-blackwater/index.html",
  "/games/shadows-over-florence/index.html",
  "/games/trouble-below-the-old-road/index.html",
];

function formatViolations(violations) {
  return violations
    .map((violation) => {
      const targets = violation.nodes
        .flatMap((node) => node.target)
        .slice(0, 8)
        .join(", ");
      return `${violation.id} (${violation.impact || "unknown"}): ${violation.help} -> ${targets}`;
    })
    .join("\n");
}

async function expectNoWcagViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();

  expect(results.violations, formatViolations(results.violations)).toEqual([]);
}

for (const path of pages) {
  test(`WCAG A/AA scan: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectNoWcagViolations(page);
  });
}

test("skip link is the first keyboard stop and becomes visible", async ({ page }) => {
  await page.goto("/index.html");

  const skipLink = page.locator(".skip-link");
  await page.keyboard.press("Tab");

  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();
  await expect(skipLink).toHaveAttribute("href", "#main");
});

test("primary homepage paths are reachable by keyboard without a focus trap", async ({ page }) => {
  await page.goto("/index.html");

  const visited = [];
  for (let i = 0; i < 24; i += 1) {
    await page.keyboard.press("Tab");
    const active = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element) return "";
      return `${element.tagName}:${element.textContent?.trim().replace(/\s+/g, " ").slice(0, 80) || element.getAttribute("aria-label") || ""}`;
    });
    visited.push(active);
  }

  expect(visited.some((value) => value.includes("Find My Table"))).toBeTruthy();
  expect(visited.some((value) => value.includes("Form My Table"))).toBeTruthy();
  expect(visited.some((value) => value.includes("Fill My Tables"))).toBeTruthy();
});

test("invalid Player form announces a useful error and focuses the first problem", async ({ page }) => {
  await page.goto("/join.html#player");
  const form = page.locator("#player-form");
  const displayName = form.locator('[name="display_name"]');

  await form.getByRole("button", { name: "Find My Table" }).click();

  await expect(form.locator(".form-status")).toContainText("Please review");
  await expect(form.locator(".form-status")).toContainText("Display name");
  await expect(displayName).toBeFocused();
  await expect(displayName).toHaveAttribute("aria-invalid", "true");
  await expect(form.locator('[name="email"]')).toHaveAttribute("aria-invalid", "true");
  await expectNoWcagViolations(page);

  await displayName.fill("Accessible Player");
  await expect(displayName).not.toHaveAttribute("aria-invalid", "true");
});

test("live Table Match results remain WCAG clean", async ({ page }) => {
  await mockZipLookup(page);
  await page.goto("/find-venue.html");

  await page.locator("#match-system").selectOption({ label: "D&D 5e" });
  await page.locator("#match-day").selectOption({ label: "Tuesday" });
  await page.locator("#match-start").fill("18:00");
  await page.locator("#match-duration").selectOption("240");
  await page.locator("#match-zip").fill("29501");
  await page.locator("#match-radius").selectOption("25");
  await page.getByRole("button", { name: "Find Players + Venues" }).click();

  await expect(page.getByRole("button", { name: "Start Forming This Table" }).first()).toBeVisible();
  await expectNoWcagViolations(page);
});

test("all Game Hub role views remain WCAG clean when revealed", async ({ page }) => {
  await page.goto("/game-hub.html?role=player");

  for (const role of ["player", "gm", "venue"]) {
    await page.locator(`.hub-role[data-role="${role}"]`).click();
    await expect(page.locator(`#${role}-view`)).toBeVisible();
    await expectNoWcagViolations(page);
  }
});
