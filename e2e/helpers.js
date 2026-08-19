const { expect } = require("@playwright/test");

const ZIP_COORDINATES = Object.freeze({
  "29501": { city: "Florence", state: "SC", latitude: "34.1954", longitude: "-79.7626" },
  "29505": { city: "Florence", state: "SC", latitude: "34.1450", longitude: "-79.7700" },
  "29506": { city: "Florence", state: "SC", latitude: "34.2250", longitude: "-79.7350" }
});

async function mockZipLookup(page) {
  try {
    await page.route("https://api.zippopotam.us/us/**", async (route) => {
      const zip = new URL(route.request().url()).pathname.split("/").filter(Boolean).pop();
      const location = ZIP_COORDINATES[zip] || ZIP_COORDINATES["29501"];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          "post code": zip,
          country: "United States",
          "country abbreviation": "US",
          places: [{
            "place name": location.city,
            "state abbreviation": location.state,
            latitude: location.latitude,
            longitude: location.longitude
          }]
        })
      });
    });
  } catch (error) {
    console.error("Unable to install ZIP lookup mock", error);
    throw error;
  }
}

async function expectNoHorizontalOverflow(page) {
  try {
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  } catch (error) {
    console.error("Unable to check horizontal overflow", error);
    throw error;
  }
}

function fakeJwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.browser-signature`;
}

async function installAuthenticatedSession(
  page,
  {
    userId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    email = "browser@example.test"
  } = {}
) {
  await page.route("**/api/v1/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ authenticated: true, id: userId, email })
    });
  });
}

module.exports = {
  mockZipLookup,
  expectNoHorizontalOverflow,
  fakeJwt,
  installAuthenticatedSession
};
