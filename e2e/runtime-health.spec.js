const { test, expect } = require("@playwright/test");

const routes = [
  "/index.html",
  "/dashboard-prototype.html",
  "/join.html",
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

function isLocal(url) {
  try {
    return new URL(url).origin === "http://127.0.0.1:4173";
  } catch {
    return false;
  }
}

function isIgnorableLocalResponse(url) {
  try {
    return new URL(url).pathname === "/favicon.ico";
  } catch {
    return false;
  }
}

for (const route of routes) {
  test(`runtime health: ${route}`, async ({ page }) => {
    const issues = [];

    page.on("pageerror", (error) => {
      issues.push(`pageerror: ${error.message}`);
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        issues.push(`console.error: ${message.text()}`);
      }
    });

    page.on("requestfailed", (request) => {
      if (isLocal(request.url())) {
        issues.push(`request failed: ${request.method()} ${request.url()} (${request.failure()?.errorText || "unknown"})`);
      }
    });

    page.on("response", (response) => {
      if (
        isLocal(response.url()) &&
        !isIgnorableLocalResponse(response.url()) &&
        response.status() >= 400
      ) {
        issues.push(`bad local response: ${response.status()} ${response.url()}`);
      }
    });

    await page.goto(route);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(() => document.readyState)).toBe("complete");
    expect(issues, issues.join("\n")).toEqual([]);
  });
}
