# Production Abuse-Protection Runbook

## Objective

Protect Dinner, Dice & Dragons from request floods and automated abuse without relying on process-local counters that fail when the API scales horizontally.

The production design uses three independent layers:

1. **Vercel Firewall/WAF** for coarse source-level traffic control before application execution.
2. **Supabase Auth rate limits** for authentication endpoints owned by Supabase.
3. **PostgreSQL token buckets** for authenticated DDD business mutations where the application understands the caller and operation cost.

No layer replaces authorization, validation, RLS, moderation, or application-level state invariants.

## Layer 1: Vercel WAF

Vercel documents WAF rate limiting as available on all plans. Hobby and Pro use fixed-window counting; Enterprise can additionally use token buckets. Hobby currently permits one rate-limit rule per project and supports IP or JA4 Digest counting keys.

### Rollout procedure

Do **not** publish a blocking rule blindly.

1. Open the production Vercel project and select **Firewall**.
2. Create one rule scoped to the production API traffic, not static site assets.
3. Use a fixed-window source-level rule appropriate to the current plan.
4. Start with **Log** behavior and observe legitimate traffic, including shared-network use from game stores, restaurants, libraries, conventions, and households.
5. Tune the threshold from observed production traffic.
6. Change the follow-up action to **429** only after legitimate bursts are understood.
7. Re-check the pricing dialog and project budget before publishing. Do not enable a configuration that creates unintended metered spend.
8. Record the final condition, counting key, window, threshold, rollout date, and operator in the deployment record.

### Initial observation profile

A reasonable starting *observation* rule is the production API path with a comparatively generous fixed window such as 300 requests per 60 seconds per IP. This is not a final security threshold. Shared venue/NAT traffic must be observed before enforcement.

The application must not trust `X-Forwarded-For` or similar browser-supplied headers as its own distributed limiter key. Source/IP enforcement belongs at the trusted edge.

## Layer 2: Supabase Auth

Supabase Auth enforces rate limits on authentication endpoints and returns HTTP 429 when an applicable bucket is exhausted. Current Supabase documentation exposes configurable project limits under **Authentication > Rate Limits** and documents token-bucket behavior for IP-limited operations.

### Production verification

Before public launch:

1. Open the production Supabase project.
2. Review **Authentication > Rate Limits** and record the effective values.
3. Confirm signup/sign-in, password recovery, OTP/magic-link, verification, token refresh, MFA, and anonymous-user settings match the enabled authentication methods.
4. Do not copy Management API tokens or project secrets into repository files, issue comments, CI logs, or browser code.
5. Verify the browser handles Supabase HTTP 429 responses without automatic tight retry loops.
6. Review Supabase CAPTCHA protection for signup, sign-in, and password-reset abuse before broad public launch.
7. If authentication later moves behind a trusted server proxy, separately review Supabase's `Sb-Forwarded-For` requirements. Do not enable forwarded-IP behavior merely for the current direct-browser auth architecture.

## Layer 3: DDD PostgreSQL token buckets

Sensitive authenticated writes use `api_rate_limit_buckets`, keyed by `(user_id, scope)`. The table is bounded to one row per authenticated user and policy scope; it is not a request log.

PostgreSQL is the serialization point across API instances. Each mutation:

1. identifies the authenticated durable DDD user server-side;
2. locks that user's scope row with `SELECT ... FOR UPDATE`;
3. refills and attempts to consume one token;
4. commits limiter state before the business mutation;
5. returns `429 Too Many Requests` with `Retry-After` when exhausted;
6. returns controlled `503 Service Unavailable` if limiter persistence fails, rather than bypassing the limiter.

Failed validation or business-state conflicts still consume abuse budget. This prevents a client from evading throttling by intentionally generating 4xx conflicts.

### Version-controlled policy scopes

The initial policies are deliberately conservative and live in `backend/app/services/api_rate_limit_policy.py`:

- `onboarding`: burst 6; refill 1 token every 30 seconds. Covers Player, GM, and Venue onboarding writes.
- `matching_input`: burst 12; refill 1 token every 10 seconds. Covers Player demand, GM supply, and Venue table-window creation.
- `hub_message`: burst 12; refill 1 token every 3 seconds.
- `event_registration`: burst 8; refill 1 token every 8 seconds.
- `table_formation`: burst 3; refill 1 token every 60 seconds.
- `venue_booking`: burst 6; refill 1 token every 10 seconds.
- `venue_verification`: burst 2; refill 1 token every 300 seconds. The token is consumed before the external geocoding request.
- `matching_run`: burst 2; refill 1 token every 300 seconds.

Changing these values is a reviewed application-security change. Do not hot-patch production database rows as a substitute for changing policy.

## What is intentionally not database-rate-limited

Ordinary authenticated reads are not written into PostgreSQL merely to count requests. Coarse read-flood protection belongs at the Vercel edge. This avoids turning every GET into a write transaction and preserves database capacity for product state.

Supabase authentication traffic is also not re-proxied through the DDD API solely to add another limiter. Supabase owns and rate-limits those endpoints directly.

## Validation requirements

A rate-limit change is not production-ready unless the exact PR head proves:

- Alembic head includes the rate-limit table and enables RLS at creation;
- static/offline migration tests include the table and constraints;
- deterministic token-bucket exhaustion/refill tests pass;
- every declared sensitive-write scope has a version-controlled policy;
- onboarding and matching-input creation consume their scopes before business persistence;
- provider-backed Venue verification consumes its scope before external geocoding;
- HTTP 429 includes `Retry-After` and rejects the business write;
- limiter persistence failure produces controlled 503 behavior;
- PostgreSQL first-request races allow exactly one token consumer;
- PostgreSQL existing-row races allow exactly one consumer when only one token is available;
- existing API, RLS, migration, Docker/PostgreSQL, and production runtime contracts remain green.

## Incident response

If abuse is occurring:

1. use Vercel Firewall traffic visibility to identify the coarse source pattern;
2. apply or tighten an edge rule when appropriate;
3. inspect application 429/503 trends and affected scopes;
4. do not disable the PostgreSQL limiter to restore availability unless an incident commander explicitly accepts the abuse risk;
5. if the limiter database path is unhealthy, treat the resulting 503s as a database/availability incident rather than bypassing security;
6. document temporary edge-rule changes and revert or codify them after the incident.

## Administrative launch evidence still required

Repository CI cannot prove dashboard-only production settings. Before declaring the abuse-control launch gate complete, capture evidence that:

- the intended Vercel WAF rule is published and observed;
- Vercel pricing/budget implications were reviewed;
- production Supabase Auth rate-limit values were reviewed;
- enabled auth flows have appropriate CAPTCHA/abuse controls where applicable.
