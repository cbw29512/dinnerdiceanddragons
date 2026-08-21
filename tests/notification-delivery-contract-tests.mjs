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

test("in-app is the only implemented delivery capability", () => {
  assert.deepEqual(deliveryCapabilities(), {
    in_app: true,
    email: false,
    browser_push: false
  });

  const plan = deliveryChannels("match_available", {
    email_match_alerts: true,
    browser_push: true,
    digest_mode: "immediate"
  });
  assert.deepEqual(plan.channels, ["in_app"]);
});

test("environment flags cannot enable unimplemented outbound senders", () => {
  const originalEmail = process.env.DDD_EMAIL_DELIVERY_ENABLED;
  const originalPush = process.env.DDD_BROWSER_PUSH_DELIVERY_ENABLED;
  try {
    process.env.DDD_EMAIL_DELIVERY_ENABLED = "true";
    process.env.DDD_BROWSER_PUSH_DELIVERY_ENABLED = "true";
    const capabilities = deliveryCapabilities();
    assert.equal(capabilities.email, false);
    assert.equal(capabilities.browser_push, false);
    const plan = deliveryChannels("attendance_reminder", {
      email_event_updates: true,
      browser_push: true,
      digest_mode: "immediate"
    });
    assert.deepEqual(plan.channels, ["in_app"]);
  } finally {
    if (originalEmail === undefined) delete process.env.DDD_EMAIL_DELIVERY_ENABLED;
    else process.env.DDD_EMAIL_DELIVERY_ENABLED = originalEmail;
    if (originalPush === undefined) delete process.env.DDD_BROWSER_PUSH_DELIVERY_ENABLED;
    else process.env.DDD_BROWSER_PUSH_DELIVERY_ENABLED = originalPush;
  }
});

test("future channel selection still requires capability plus user preference", () => {
  const futureCapabilities = { in_app: true, email: true, browser_push: true };
  const enabled = deliveryChannels("event_changed", {
    email_event_updates: true,
    browser_push: true,
    digest_mode: "immediate"
  }, futureCapabilities);
  assert.deepEqual(enabled.channels, ["in_app", "email", "browser_push"]);

  const optedOut = deliveryChannels("event_changed", {
    email_event_updates: false,
    browser_push: false,
    digest_mode: "immediate"
  }, futureCapabilities);
  assert.deepEqual(optedOut.channels, ["in_app"]);
});

console.log("notification delivery capability contract tests passed");
