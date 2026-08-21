import assert from "node:assert/strict";
import {
  deliveryCapabilities,
  deliveryChannels
} from "../netlify/functions/_lib/notification-contract.mjs";

function test(name, callback) {
  try {
    callback();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test("in-app is always deliverable while outbound channels default off", () => {
  const capabilities = deliveryCapabilities({});
  assert.deepEqual(capabilities, {
    in_app: true,
    email: false,
    browser_push: false
  });

  const plan = deliveryChannels("match_available", {
    email_match_alerts: true,
    browser_push: true,
    digest_mode: "immediate"
  }, capabilities);
  assert.deepEqual(plan.channels, ["in_app"]);
});

test("email is only added when the runtime capability is explicitly enabled", () => {
  const capabilities = deliveryCapabilities({ DDD_EMAIL_DELIVERY_ENABLED: "true" });
  const enabled = deliveryChannels("attendance_reminder", {
    email_event_updates: true,
    browser_push: false,
    digest_mode: "immediate"
  }, capabilities);
  assert.deepEqual(enabled.channels, ["in_app", "email"]);

  const optedOut = deliveryChannels("attendance_reminder", {
    email_event_updates: false,
    digest_mode: "immediate"
  }, capabilities);
  assert.deepEqual(optedOut.channels, ["in_app"]);
});

test("browser push also requires both runtime capability and user opt-in", () => {
  const capabilities = deliveryCapabilities({ DDD_BROWSER_PUSH_DELIVERY_ENABLED: "TRUE" });
  const enabled = deliveryChannels("event_changed", {
    email_event_updates: false,
    browser_push: true,
    digest_mode: "immediate"
  }, capabilities);
  assert.deepEqual(enabled.channels, ["in_app", "browser_push"]);

  const optedOut = deliveryChannels("event_changed", {
    email_event_updates: false,
    browser_push: false,
    digest_mode: "immediate"
  }, capabilities);
  assert.deepEqual(optedOut.channels, ["in_app"]);
});

console.log("notification delivery capability contract tests passed");
