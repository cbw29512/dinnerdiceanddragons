const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function test(name, callback) {
  return Promise.resolve()
    .then(callback)
    .then(() => console.log(`✓ ${name}`))
    .catch((error) => {
      console.error(`✗ ${name}`);
      throw error;
    });
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body == null ? "" : JSON.stringify(body)
  };
}

const requests = [];
const context = {
  console,
  URLSearchParams,
  window: {},
  fetch: async (url, options = {}) => {
    requests.push({ url: String(url), options });
    return response(200, { ok: true });
  }
};
context.window.window = context.window;
vm.createContext(context);
vm.runInContext(fs.readFileSync("production-api-client.js", "utf8"), context, { filename: "production-api-client.js" });
const api = context.window.DDDProductionAPI;
api.configure({ baseUrl: "https://ddd.example.test", accessTokenProvider: async () => "test-token" });

(async () => {
  await test("direct Game Hub message methods are not exposed", async () => {
    assert.equal(api.getHubMessages, undefined);
    assert.equal(api.postHubMessage, undefined);
  });

  await test("structured opportunity response includes explicit role", async () => {
    requests.length = 0;
    await api.respondToOpportunity("match-1", "player", "accepted");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://ddd.example.test/api/v1/matching/opportunities/match-1/respond");
    assert.equal(requests[0].options.method, "POST");
    assert.deepEqual(JSON.parse(requests[0].options.body), { role: "player", decision: "accepted" });
  });

  await test("notification preferences use structured API routes", async () => {
    requests.length = 0;
    const payload = {
      email_match_alerts: true,
      email_event_updates: true,
      browser_push: false,
      digest_mode: "immediate",
      matching_paused: false
    };
    await api.getNotificationPreferences();
    await api.putNotificationPreferences(payload);
    assert.equal(requests[0].url, "https://ddd.example.test/api/v1/notification-preferences");
    assert.equal(requests[0].options.method, "GET");
    assert.equal(requests[1].options.method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].options.body), payload);
  });

  await test("Event announcements use a dedicated one-way route", async () => {
    requests.length = 0;
    await api.getAnnouncements("event-1");
    await api.postAnnouncement("event-1", "Bring a level 3 character.");
    assert.equal(requests[0].url, "https://ddd.example.test/api/v1/events/event-1/announcements");
    assert.equal(requests[1].options.method, "POST");
    assert.deepEqual(JSON.parse(requests[1].options.body), { body: "Bring a level 3 character." });
  });

  console.log("All privacy API client tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
