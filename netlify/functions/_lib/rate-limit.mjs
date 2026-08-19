import {
  SupabaseRestError,
  eq,
  insertRows,
  selectOne,
  updateRows
} from "./supabase-rest.mjs";

const POLICIES = Object.freeze({
  hub_message: { capacity: 12, refillTokens: 1, refillSeconds: 3 },
  event_registration: { capacity: 8, refillTokens: 1, refillSeconds: 8 },
  table_formation: { capacity: 3, refillTokens: 1, refillSeconds: 60 },
  venue_booking: { capacity: 6, refillTokens: 1, refillSeconds: 10 },
  matching_refresh: { capacity: 3, refillTokens: 1, refillSeconds: 60 },
  provider_geocoding: { capacity: 2, refillTokens: 1, refillSeconds: 60 },
  onboarding_mutation: { capacity: 6, refillTokens: 1, refillSeconds: 20 },
  matching_input: { capacity: 10, refillTokens: 1, refillSeconds: 10 }
});

function policy(scope) {
  const value = POLICIES[scope];
  if (!value) throw new Error(`Unknown API rate-limit scope: ${scope}`);
  return value;
}

function refill(row, config, nowMs) {
  const lastMs = Date.parse(row.last_refill_at);
  const elapsedSeconds = Number.isFinite(lastMs) ? Math.max(0, (nowMs - lastMs) / 1000) : 0;
  const rate = config.refillTokens / config.refillSeconds;
  return Math.min(config.capacity, Number(row.tokens) + elapsedSeconds * rate);
}

function retryAfterSeconds(tokens, config) {
  const deficit = Math.max(0, 1 - tokens);
  if (deficit <= 0) return 0;
  return Math.max(1, Math.ceil(deficit / (config.refillTokens / config.refillSeconds)));
}

async function createBucket(userId, scope, config, now) {
  try {
    await insertRows("api_rate_limit_buckets", [{
      user_id: userId,
      scope,
      tokens: config.capacity - 1,
      last_refill_at: now,
      updated_at: now
    }], { returning: false });
    return true;
  } catch (error) {
    // Another concurrent request may have created the same composite PK.
    if (error?.status === 409 || error?.status === 400) return false;
    throw error;
  }
}

export async function enforceRateLimit(userId, scope) {
  const config = policy(scope);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const row = await selectOne("api_rate_limit_buckets", {
      user_id: eq(userId),
      scope: eq(scope)
    });

    if (!row) {
      if (await createBucket(userId, scope, config, now)) return;
      continue;
    }

    const available = refill(row, config, nowMs);
    if (available < 1) {
      const wait = retryAfterSeconds(available, config);
      throw new SupabaseRestError(
        `Too many requests for this action. Try again in about ${wait} second${wait === 1 ? "" : "s"}.`,
        429,
        { retry_after_seconds: wait }
      );
    }

    // Optimistic compare-and-swap prevents two concurrent requests from consuming
    // the same token. PostgREST returns [] when another request won the race.
    const updated = await updateRows("api_rate_limit_buckets", {
      user_id: eq(userId),
      scope: eq(scope),
      last_refill_at: eq(row.last_refill_at)
    }, {
      tokens: available - 1,
      last_refill_at: now,
      updated_at: now
    });
    if (Array.isArray(updated) && updated.length === 1) return;
  }

  throw new SupabaseRestError("Rate-limit state changed concurrently. Retry the request.", 429);
}

export const RATE_LIMIT_SCOPES = Object.freeze({
  HUB_MESSAGE: "hub_message",
  EVENT_REGISTRATION: "event_registration",
  TABLE_FORMATION: "table_formation",
  VENUE_BOOKING: "venue_booking",
  MATCHING_REFRESH: "matching_refresh",
  PROVIDER_GEOCODING: "provider_geocoding",
  ONBOARDING_MUTATION: "onboarding_mutation",
  MATCHING_INPUT: "matching_input"
});

export const RATE_LIMIT_POLICIES = POLICIES;
