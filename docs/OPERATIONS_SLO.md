# Production Operations, SLIs, SLOs, and Alert Contract

## Purpose

This document defines the initial production operations contract for Dinner, Dice & Dragons on the Netlify-native stack. These are targets and required signals, not a claim that centralized dashboards, paging, or error tracking are already configured.

## Runtime state

No database schema change is required for this observability slice.

The runtime exposes two distinct states:

- **Live**: the Netlify Function process can execute application code.
- **Ready**: the function can reach the critical Netlify Database dependency and serve stateful application traffic.

Keeping these states separate prevents a database incident from being misdiagnosed as a dead application process.

## Health semantics

### Liveness — `GET /api/v1/health`

Liveness is dependency-free. It must not call Netlify Database, Netlify Identity, external geocoding/ZIP providers, DNS-dependent provider APIs, or other remote services.

A successful liveness response is HTTP 200 and identifies the active production runtime. Database or identity outages must not turn liveness into a dependency restart loop.

### Readiness — `GET /api/v1/ready`

Readiness answers whether the application can serve core stateful traffic now.

The current critical readiness dependency is Netlify Database. A successful probe returns HTTP 200 with `database: ok`. A failed database probe returns HTTP 503 with a generic unavailable state and must not expose database hostnames, connection strings, SQL text, credentials, or raw exception messages.

Netlify Identity and optional external providers are not called by every readiness probe. Their failures are degraded-service incidents and should be tracked separately.

## Request correlation and structured logging

Every HTTP request receives a server-generated UUID request ID. The ID is returned in `X-Request-ID` and stored in asynchronous request context so application logging can correlate work performed by the same request.

Client-supplied `X-Request-ID` values are never trusted as the server correlation identifier.

The standard request event may contain only:

- event name;
- server request ID;
- HTTP method;
- URL path without query string;
- response status;
- elapsed milliseconds;
- exception type for a failed request.

Request telemetry must not contain bearer tokens, cookies, query strings, request or response bodies, raw email addresses, private messages, report text, exact private location, provider credentials, database URLs, or raw exception messages.

## Initial service targets

| Signal | Initial target | Notes |
| --- | --- | --- |
| Core API availability | >= 99.9% | Excluding explicitly announced maintenance. |
| Core API latency | p95 <= 500 ms; p99 <= 1,500 ms | Measure server-side duration for ordinary API work. |
| API 5xx rate | < 0.5% over 15 minutes; < 0.1% over 28 days | Validation/auth/rate-limit 4xx responses are not server errors. |
| Readiness success | >= 99.95% outside planned DB maintenance | Sustained failures indicate a database/connectivity incident. |
| Readiness latency | p95 <= 250 ms | The probe must remain a single bounded database check. |
| Matching execution | >= 99% of authorized bounded runs complete without 5xx | Zero matches is a valid result, not a failure. |
| Identity availability | >= 99.9% for otherwise-valid authentication traffic | Invalid credentials and expired sessions are not provider outages. |

These values should be revisited after enough real traffic exists to establish production baselines.

## Alert severity

### SEV-1

Page immediately for broad production unavailability, widespread readiness/database failure, confirmed data-isolation or credential exposure, or a deployment that corrupts state or prevents safe rollback.

Target acknowledgement: within 15 minutes.

### SEV-2

Urgent investigation for sustained 5xx rate above 1%, p95 API latency above 1 second, material matching failures, sustained Netlify Identity failure, or database saturation that has not yet become a broad outage.

Target investigation start: within 30 minutes during supported operating hours.

### SEV-3

Track planned remediation for slow SLO drift, isolated provider failures, maintenance findings without known exploitation, or contained abusive-client patterns.

## Required telemetry dimensions

A production telemetry platform should support request counts by status class and route template, p50/p95/p99 latency, readiness success and latency, 5xx rate, identity failure reason class, database saturation/transaction failures, matching duration/failures, rate-limit outcomes, provider failures, and deployment/build correlation.

Do not use raw user IDs, email addresses, message bodies, report text, exact coordinates, tokens, or other high-cardinality sensitive values as metric labels.

## Remaining operational work

This repository defines the application signals and targets. The production-readiness gate is not complete until a telemetry/error-tracking provider is selected and staging/production projects, secret handling, sampling/retention, PII scrubbing, dashboards, alert destinations, ownership, budget controls, and a test alert/incident drill are explicitly verified.
