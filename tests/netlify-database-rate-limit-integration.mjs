import assert from "node:assert/strict";

import { eq, insertRows, selectOne } from "../netlify/functions/_lib/database.mjs";
import { enforceRateLimit, RATE_LIMIT_SCOPES } from "../netlify/functions/_lib/rate-limit.mjs";

const userId = "99999999-9999-4999-8999-999999999991";
await insertRows("users", [{
  id: userId,
  auth_provider_user_id: "integration-rate-limit",
  email: "integration-rate-limit@example.test",
  status: "active"
}], { returning: false });

await enforceRateLimit(userId, RATE_LIMIT_SCOPES.MATCHING_INPUT);
const first = await selectOne("api_rate_limit_buckets", {
  user_id: eq(userId),
  scope: eq(RATE_LIMIT_SCOPES.MATCHING_INPUT)
}, { required: true });
assert.equal(first.scope, RATE_LIMIT_SCOPES.MATCHING_INPUT);
assert.ok(Number(first.tokens) <= 9 && Number(first.tokens) >= 8.9);

await enforceRateLimit(userId, RATE_LIMIT_SCOPES.MATCHING_INPUT);
const second = await selectOne("api_rate_limit_buckets", {
  user_id: eq(userId),
  scope: eq(RATE_LIMIT_SCOPES.MATCHING_INPUT)
}, { required: true });
assert.ok(Number(second.tokens) < Number(first.tokens));
assert.ok(new Date(second.last_refill_at).getTime() >= new Date(first.last_refill_at).getTime());

console.log("Repeated matching-input rate-limit bucket consumption check passed.");
