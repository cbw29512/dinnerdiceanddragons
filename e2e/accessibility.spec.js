const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;

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

for (const path of pages) {
  test(`WCAG A/AA scan: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    expect(results.violations, formatViolations(results.violations)).toEqual([]);
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
