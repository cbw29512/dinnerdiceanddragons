# Production Threat Model and Data-Flow Inventory

## Purpose

This document identifies the production trust boundaries, sensitive data flows, primary abuse cases, implemented controls, and known residual risks for Dinner, Dice & Dragons (DDD). It is a maintained security artifact for launch reviews and future feature design.

## Trust boundaries

1. **Untrusted browser / public Internet** — browser code, user input, request headers, URLs, and client-side storage are attacker-controlled.
2. **Vercel/static delivery edge** — serves the public browser application and is the intended coarse traffic/WAF boundary.
3. **Supabase Auth** — authenticates users and issues signed access/refresh tokens. DDD does not trust identity fields supplied directly by browser payloads.
4. **FastAPI production API** — verifies Supabase JWTs, resolves durable DDD users, enforces roles, validates business rules, and performs server-side provider calls.
5. **PostgreSQL/Supabase database** — durable application state, RLS-enabled tables, privileged audit records, and distributed rate-limit state.
6. **External providers** — Geocodio and any future email/maps/payment/moderation providers. Requests leaving DDD may incur cost and disclose only the minimum provider-required data.
7. **Administrative operators** — privileged users and dashboard operators. Admin access is high impact and must be auditable and least-privileged.

## Sensitive data-flow inventory

| Data / capability | Source | Processing / storage | Exposed to | Key controls |
| --- | --- | --- | --- | --- |
| Supabase access/refresh tokens | Supabase Auth | Browser session/auth flow; access token sent to API | Browser + Supabase + API verifier | HTTPS-only production config, tab-scoped refresh storage, JWT verification, no token logging |
| Durable identity | Verified JWT claims | `users`, `user_roles` | Authorized API responses | Server-derived identity, unique provider identity, role dependencies, RLS |
| Player/GM profile data | Authenticated user | profile/experience/availability tables | Role-safe product flows | Pydantic validation, ownership checks, RLS, onboarding rate limit |
| Approximate private location | User postal/travel settings | profile data + postal centroid cache | Matching engine only as needed | No home coordinates in opportunity/UI responses, approximate centroid matching, RLS |
| Venue public address | Venue claimant | `venues`; server-side geocoding during admin verification | Public Venue product data + Geocodio for verification | Admin-only verification, provider rate limit, address revalidation under row lock, precision checks |
| Table Match state | Matching engine | match/player/explanation tables | Related Players/GMs/Venues | Hard-fit eligibility, role-safe reads, deterministic explanations, RLS |
| Booking/registration state | Authenticated actors | events/registrations/venue bookings | Related table participants and Venue | Role authorization, state invariants, row locking/capacity checks, mutation rate limits |
| Game Hub messages | Authenticated table users | `messages` | Channel-authorized participants only | Channel policy, role/recipient isolation, body/category bounds, RLS, message rate limit, XSS-safe rendering |
| Reports/moderation data | Future authenticated flows | Future moderation/report tables | Authorized moderators/admins only | Must use least privilege, bounded payloads, audit trail, rate limiting before launch |
| Reputation/feedback | Future participants | Future reputation/feedback state | Product-defined aggregates only | Must avoid exposing private report content; anti-retaliation and abuse policy required before launch |
| Privileged audit data | Server/admin actions | append-only `privileged_audit_events` | Authorized operations/security review | Database mutation-denial trigger, no sensitive token/message payload logging |
| Rate-limit state | Authenticated user actions | `api_rate_limit_buckets` keyed by user + scope | Server only | Bounded rows, RLS, row locks, no request body/token/location storage |

## Primary threat scenarios

### Identity and session theft

**Threats:** XSS steals JavaScript-readable credentials; forged JWTs; token replay; account linking to the wrong durable user.

**Controls:** verified Supabase JWKS/signature/audience/issuer checks, durable identity linking from verified claims, CSP/sink-reduction work, session storage instead of persistent localStorage, browser auth tests, role checks, and no client-trusted owner IDs.

**Residual risk:** while refresh/access credentials remain JavaScript-readable on the current cross-origin static-host architecture, successful same-origin XSS could steal them during the active tab session. Final same-site HttpOnly/Secure session architecture remains tracked separately.

### Authorization and cross-user data leakage

**Threats:** one Player reads another Player's data; Venue sees private table discussion; GM/Venue obtains private email/location; ID enumeration leaks resource existence.

**Controls:** server-derived caller identity, role dependencies, ownership/relationship checks, role-safe Hub response shapes, non-leaking 404 patterns where appropriate, Supabase RLS contract, two-user isolation tests.

### Location/privacy leakage

**Threats:** home or precise private coordinates exposed to other users, logs, browser code, or third parties.

**Controls:** approximate postal centroid matching, trusted Venue coordinates only after verification, role-safe response schemas, no private coordinates in match explanations or Hub responses, no raw private location in limiter state.

### Message/content injection

**Threats:** stored XSS, markup/script injection, abusive messaging, oversized message bodies.

**Controls:** server-side body/category/channel constraints, security-critical DOM modules avoid executable HTML sinks, stored-XSS browser regressions, CSP, channel authorization, rate limiting.

### Booking/formation race conditions

**Threats:** double booking, oversubscribed venue capacity, duplicate formation, registration state races.

**Controls:** PostgreSQL transactions/row locks, unique constraints, capacity checks, state-machine conflicts, dedicated concurrency contracts.

### Automated API and database abuse

**Threats:** message spam, repeated registration/formation/booking writes, matching-run amplification, profile churn, matching-input spam, provider-cost amplification.

**Controls:** layered Vercel WAF + Supabase Auth limits + PostgreSQL token buckets. Application scopes cover Hub messages, registration, formation, booking, matching runs, onboarding mutations, matching-input creation, and provider-backed geocoding. Exhaustion returns 429 with `Retry-After`; limiter persistence failures fail closed with 503.

### External-provider cost or data abuse

**Threats:** attackers cause unbounded geocoding/provider calls or inject data into external requests.

**Controls:** provider calls occur server-side only, admin/role authorization precedes provider invocation, geocoding has a dedicated low-burst rate-limit scope, result/precision validation, provider secrets remain server-side.

### Software supply-chain compromise

**Threats:** mutable CI action tags, compromised dependencies, vulnerable container layers, dependency drift between test and production.

**Controls:** GitHub Actions pinned to immutable SHAs, digest-pinned production base image, hash-locked transitive Python production graph, npm lock, pip/npm vulnerability audits, CycloneDX SBOMs, CodeQL, checksum-verified Trivy scan with HIGH/CRITICAL blocking gate, Dependabot, `SECURITY.md`.

### Privileged/admin misuse

**Threats:** compromised admin account verifies malicious Venue data, runs expensive matching repeatedly, or changes sensitive state without accountability.

**Controls:** explicit admin role dependency, matching/provider rate limits, privileged audit events, append-only database enforcement for privileged audit rows. Repository/dashboard administrative controls require separate operational verification.

## Security invariants for new features

Any new production endpoint or background job must answer these before merge:

1. Who is the authenticated principal, and is identity derived server-side?
2. What role/relationship authorizes this read or mutation?
3. What is the maximum request/list/page/horizon/provider work?
4. Can repeated calls create unbounded rows, provider spend, or CPU/DB work?
5. Which distributed rate-limit scope applies, or why is edge-only control sufficient?
6. What sensitive fields must never leave the API or enter logs?
7. Does the feature need a new RLS table/policy inventory entry?
8. What concurrency invariant must PostgreSQL enforce?
9. What audit evidence is needed for privileged actions?
10. What browser rendering sink receives persisted/user-controlled content?

## Residual launch evidence

The repository cannot independently prove dashboard-only settings. Before the enterprise security launch gate is closed, operators must verify and record:

- production Vercel WAF rule state and observed/tuned threshold;
- Vercel pricing/budget implications for the enabled rule;
- production Supabase Auth rate-limit and CAPTCHA configuration;
- GitHub secret scanning, push protection, private vulnerability reporting, rulesets/required reviews where available;
- CodeQL alert inventory, not merely successful workflow upload;
- final browser-session/response-header architecture tracked by the browser-security launch issue.

## Maintenance

Update this document when a new sensitive data category, provider, role, mutation class, report/moderation flow, payment flow, or production trust boundary is introduced. Security-sensitive PRs should reference the affected section rather than treating the threat model as a one-time launch artifact.
