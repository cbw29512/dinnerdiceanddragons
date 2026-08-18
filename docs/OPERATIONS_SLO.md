# Production Operations, SLIs, SLOs, and Alert Contract

## Purpose

This document defines the initial operational signals and launch targets for Dinner, Dice & Dragons. These are **targets and alerting contracts**, not claims that production has already achieved them. Centralized dashboards, paging destinations, and error-tracking/metrics providers must be explicitly configured and verified before the enterprise launch gate closes.

## Health semantics

### Liveness — `GET /api/v1/health`

Liveness is dependency-free. It answers only: **is this API process running and able to execute application code?**

Do not add database, Supabase, Geocodio, DNS, or Internet calls to liveness. A dependency outage must not cause a container orchestrator to restart otherwise healthy API processes repeatedly.

### Readiness — `GET /api/v1/ready`

Readiness answers: **can this API instance serve core stateful DDD traffic now?**

The initial critical readiness dependency is PostgreSQL. The check uses the normal bounded DDD application Session, including connection and transaction-local database timeouts. A failed database check returns HTTP 503 with no hostname, credential, SQL, or raw exception text.

Supabase Auth and Geocodio are not called by every readiness probe. Their outages are service-degradation incidents; ejecting every API instance would not repair those external providers and could amplify the outage.

## Correlation and logging contract

Every HTTP request receives a server-generated UUID request ID. The ID is:

- returned as `X-Request-ID`;
- available through request context for application logging;
- included in structured request-completion and unhandled-failure events.

Client-supplied request IDs are not trusted as the server correlation identifier.

The standard request event may contain only:

- event name;
- server request ID;
- HTTP method;
- path without query string;
- response status;
- elapsed milliseconds;
- exception **type** for an unhandled failure.

The request telemetry layer must never log bearer tokens, cookies, request/response bodies, query strings, private messages, report text, raw email addresses, exact private location, provider credentials, database URLs, or raw exception messages.

## Initial service-level indicators and objectives

These targets apply to the production API after public launch. Measurement windows should use rolling 28-day views unless an incident/runbook specifies a shorter diagnostic window.

| Signal | Initial SLO / operating target | Notes |
| --- | --- | --- |
| Core API availability | **>= 99.9%** successful service time | Exclude planned maintenance only when announced and measured separately. |
| Core non-matching API latency | **p95 <= 500 ms**, **p99 <= 1,500 ms** | Measure server-side request duration; exclude intentionally long offline/background jobs. |
| API 5xx response rate | **< 0.5%** over 15 minutes and **< 0.1%** over 28 days | 4xx validation/auth/rate-limit responses are not server errors. |
| Readiness success | **>= 99.95%** outside planned DB maintenance | Sustained readiness failures are a DB/connectivity incident. |
| Readiness latency | **p95 <= 250 ms** | Readiness must remain cheap; it executes one bounded DB probe. |
| Global matching execution | **>= 99%** of authorized bounded runs complete without 5xx | Track execution failures separately from “zero matches found.” |
| Provider-backed geocoding | **>= 99%** successful provider responses when called | Provider 4xx/5xx/timeouts should be broken out from DDD validation rejections. |
| Supabase-auth verification | **>= 99.9%** verifier availability for otherwise-valid auth traffic | Invalid/expired tokens are not availability failures. |

These values are launch targets and should be revisited after sufficient real traffic exists. Do not loosen a target merely to make a dashboard green; document the operational reason and review the change.

## Alert severities

### SEV-1 — page immediately

Trigger when any of the following is sustained and user impact is broad:

- core API unavailable or readiness failing across most/all instances for 5 minutes;
- database unavailable or connection pool exhausted with widespread 5xx responses;
- authenticated data-isolation/security control failure;
- confirmed credential/token exposure;
- deployment corrupts production state or prevents safe rollback.

Operator expectation: acknowledge within **15 minutes**, establish incident ownership, preserve evidence, stop unsafe deployments, and prioritize containment/restoration over feature work.

### SEV-2 — urgent investigation

Examples:

- 5xx rate > 1% for 10 minutes;
- p95 core API latency > 1 second for 15 minutes;
- matching-run failures materially above target;
- Supabase Auth or Geocodio sustained provider failures affecting a meaningful user segment;
- repeated application rate-limit persistence 503s;
- unusual DB saturation that has not yet caused broad outage.

Operator expectation: begin investigation within **30 minutes** during supported operational hours; promote to SEV-1 if impact expands.

### SEV-3 — ticket / planned remediation

Examples:

- slow SLO drift without immediate user impact;
- isolated provider failures below SEV-2 thresholds;
- dependency/security maintenance findings without known exploitation;
- recurring noisy client 4xx patterns or abusive sources already contained by WAF/rate limits.

## Required dashboard dimensions

The eventual centralized telemetry platform must support at least:

- request count by status class and route template;
- p50/p95/p99 server latency;
- readiness success/latency;
- 5xx rate;
- authentication verification failures by **reason class**, not token/user content;
- DB connection/pool saturation and transaction failures;
- matching-run success/failure/duration;
- rate-limit 429 and fail-closed 503 counts by policy scope;
- Geocodio/Supabase provider failure and timeout counts;
- deployment version/build SHA correlation.

Do not use raw user IDs, email addresses, message bodies, report text, or exact private coordinates as metric labels. High-cardinality or sensitive labels are both a privacy and cost risk.

## Provider and paging status

This repository now defines readiness, correlation IDs, privacy-safe request events, and SLO/alert requirements. **Centralized error tracking, metrics/tracing backend, dashboards, and paging destinations are not considered configured merely because these application signals exist.**

A subsequent operational decision must explicitly record:

1. the selected telemetry/error-tracking provider(s);
2. production/staging project separation;
3. secret/DSN storage method;
4. sampling and retention policy;
5. PII scrubbing rules;
6. dashboard URLs/owners;
7. alert destinations and on-call ownership;
8. cost/budget controls;
9. a test alert and incident drill result.

Until that evidence exists, Issue #41 observability remains in progress rather than complete.
