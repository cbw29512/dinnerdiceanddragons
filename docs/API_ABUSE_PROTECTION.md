# API Abuse Protection

## Objective

Bound abusive or accidental API work across every application instance without trusting browser-owned identity fields or storing raw client identifiers in operational limiter state.

## Shared State

The limiter uses PostgreSQL table `api_rate_limit_buckets` with one row per:

- endpoint policy class
- HMAC-pseudonymized subject
- active fixed window

Each row stores only the policy name, subject digest, window start, bounded request count, and expiry. Raw IP addresses, user IDs, bearer tokens, request bodies, messages, and provider credentials are not stored in limiter state.

The request counter is updated with one PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` statement. Expired rows are reset in place and a bounded batch of old rows is pruned during normal limiter traffic.

## Policy Classes

| Class | Requests | Shared IP limit | Authenticated user limit | Window |
| --- | --- | ---: | ---: | ---: |
| `read` | Production API reads | 600 | 240 | 60 seconds |
| `mutation` | POST/PUT/PATCH/DELETE | 180 | 60 | 60 seconds |
| `message` | Game Hub message creation | 120 | 30 | 60 seconds |
| `expensive` | Manual Table Match run | 12 | 6 | 300 seconds |

`OPTIONS` requests and `/api/v1/health` are exempt so browser preflight and dependency-free liveness do not consume customer request budgets.

## Enforcement Flow

1. Production/staging IP middleware classifies the request.
2. The trusted platform client address is normalized.
3. The address is HMAC-SHA256 pseudonymized using `RATE_LIMIT_HMAC_KEY`.
4. PostgreSQL atomically consumes the shared IP allowance before route work begins.
5. Authentication resolves the provider identity to the durable DDD account.
6. Active-account routes independently consume the authenticated-user allowance using the durable server-derived user ID.
7. A denied bucket returns HTTP 429 with `Retry-After` and remaining-limit headers.
8. If shared limiter state cannot be enforced in staging/production, protected requests fail closed with HTTP 503 rather than silently bypassing abuse protection.

## Client Address Trust

In staging/production, the middleware uses the deployment platform's forwarded client-address header before the direct socket peer. Local/test environments do not trust that forwarded header and use the request peer address instead.

The raw resolved address exists only for the current request long enough to derive its HMAC digest. It is not written to the limiter table or included in limiter error logs.

## Configuration

`RATE_LIMIT_HMAC_KEY` is mandatory whenever `APP_ENV` is `staging` or `production` and must contain at least 32 characters. Application construction fails if deployed rate limiting is enabled without a valid key.

The key must be supplied through the deployment secret store. It must never be committed or exposed to browser code.

## Failure and Privacy Rules

- Rate-limit failures never include raw IP addresses, durable user IDs, tokens, request bodies, or private messages in logs.
- Limiter persistence uses a transaction separate from the business-operation transaction, so a later route rollback does not refund abusive traffic.
- Route exceptions are not converted into limiter errors; only limiter classification/state failures produce the protection-service 503 response.
- Shared IP limits are intentionally higher than per-user limits so multiple legitimate customers behind one NAT are not forced into a single-user budget.

## Remaining Enterprise Work

This is the application-layer distributed limiter foundation. Issue #42 remains open until the release gate also verifies repository/provider security administration and determines whether an outer edge/WAF or dedicated low-latency limiter store is required by measured production traffic.

Rate-limit values are initial launch policy, not permanent capacity claims. Performance/load testing in Issue #47 must validate or tune them against representative traffic and database cost.
