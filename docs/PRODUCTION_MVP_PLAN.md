# Dinner, Dice & Dragons — Production MVP Execution Plan

## Purpose

This is the **authoritative execution checklist** for moving Dinner, Dice & Dragons from the validated GitHub Pages/pilot experience into a secure multi-user application.

Use this file to answer three questions at all times:

1. What have we already completed?
2. What are we working on now?
3. What must happen next before public launch?

Do not delete completed work from this plan. Mark it complete and preserve the decision/history so later work does not accidentally rebuild or contradict it.

## Product invariants we must preserve

These are not optional during the production migration:

- Player, DM, and Venue are equal sides of the product.
- Public discovery centers on games/tables, not people-swiping.
- Visitors may browse without an account.
- Public venues come first; private-home discovery is deferred.
- Table Match requires hard compatibility before softer Table Fit scoring.
- Venue capacity is a hard constraint and includes the DM seat.
- Potential Player demand is not the same as a confirmed seat.
- A table becomes Confirmed only after venue approval requirements and minimum Player commitment are satisfied.
- Game Hub belongs after confirmation; it is not a generic social feed.
- One human has one durable DDD identity and may hold multiple roles.
- Missing reputation history is neutral and must never penalize newcomers.
- Reports/moderation are private and separate from public reputation.
- Accessibility, mobile usability, privacy, explainability, and SEO are release requirements.
- Stable DDD IDs must survive storage/provider migrations.

## Already completed and protected

- [x] Three-sided product positioning and homepage value proposition.
- [x] Player / DM / Venue onboarding and validation prototype.
- [x] Table Match hard-fit logic for system, schedule, travel, venue availability, and capacity.
- [x] Explainable match presentation.
- [x] Forming → Confirmed → Game Hub → Played lifecycle model.
- [x] Seat request/approval/waitlist/cancel behavior in preview/early-access pilot flows.
- [x] Recurring-game scheduling and one-date Skip / Move exceptions.
- [x] Three-role Game Hub UX model.
- [x] Identity, reputation, venue, recurrence, lifecycle, and safety data design.
- [x] GitHub Pages validation deployment.
- [x] Static link/fragment/button/controller QA.
- [x] Unit tests for matching and lifecycle rules.
- [x] 57 Chromium functional/accessibility/reflow/runtime regression tests.
- [x] Automated axe accessibility regression coverage.
- [x] 320px reflow checks and working site-wide skip links.
- [x] Lighthouse performance/accessibility/best-practices/SEO regression gate.
- [x] Runtime-health checks for page errors, console errors, failed local assets, and HTTP failures.

## Current production architecture decision

- **API / policy layer:** FastAPI.
- **Primary relational data:** PostgreSQL.
- **Authentication:** Supabase Auth.
- **Initial managed PostgreSQL target:** Supabase Postgres, while keeping application SQL/schema portable PostgreSQL.
- **Runtime packaging:** Docker.
- **Authorization source of truth:** DDD database roles/relationships, enforced server-side by FastAPI; authentication-provider metadata is not the authoritative permission store.
- **Frontend:** keep the validated static experience during migration; production frontend choice remains open until authenticated API flows are proven.

See `docs/DECISIONS.md`, Decision 016.

---

# Production execution ladder

## STEP 1 — Identity, authentication, and backend foundation — **IN PROGRESS**

### 1A. Architecture and tracking
- [x] Select production authentication provider.
- [x] Record auth/provider decision and consequences.
- [x] Establish this production-MVP master checklist.
- [x] Create FastAPI production backend skeleton.
- [x] Add environment/settings model with safe secret handling.
- [x] Add PostgreSQL connection/session layer.
- [x] Add Alembic migrations.
- [ ] Add Docker development runtime and health check.
- [ ] Add backend CI tests/lint/syntax gate.

### 1B. Durable identity schema
- [ ] Create `users` table with immutable internal DDD ID.
- [ ] Store Supabase Auth subject as `auth_provider_user_id` with uniqueness constraint.
- [ ] Create normalized unique display-name policy and reserved-name list.
- [ ] Create `user_roles` table supporting Player + DM + Venue Manager on one account.
- [ ] Add account statuses: pending verification / active / restricted / suspended / banned.
- [ ] Add created/updated/last-login timestamps.
- [ ] Migration tests prove uniqueness and multi-role behavior.

### 1C. Authentication
- [ ] Configure Supabase development project/local environment.
- [ ] Require verified email before active participation.
- [ ] Implement JWT verification against Supabase JWKS in FastAPI.
- [ ] Validate issuer, audience/project, signature, and expiration.
- [ ] Add authenticated `GET /api/v1/me` endpoint.
- [ ] First verified login safely creates/links the internal DDD User.
- [ ] Anonymous requests remain browse-only.
- [ ] Invalid/expired token tests.
- [ ] Account-status enforcement tests.

### 1D. Authorization
- [ ] Server-side role dependencies for Player, DM, Venue Manager, Moderator, Admin.
- [ ] Never trust client-supplied role/user IDs for authorization.
- [ ] Resource ownership helpers for profiles, games, registrations, venue operations, and messages.
- [ ] Venue Manager operational permissions require verified venue relationship.
- [ ] Privileged moderation/admin actions are auditable.
- [ ] Authorization-negative tests prove cross-user access is rejected.

**Step 1 Definition of Done:** two different real authenticated users can access `/me`, hold different/multiple DDD roles, and server-side tests prove they cannot perform each other's protected actions. Anonymous browsing still works.

## STEP 2 — Production profiles and structured availability — NOT STARTED

- [ ] PlayerProfile persistence.
- [ ] GMProfile persistence.
- [ ] Venue / VenueManager persistence.
- [ ] GameSystem catalog.
- [ ] PlayerSystemExperience persistence.
- [ ] GMSystemExperience / GMSystemFormat persistence.
- [ ] RecurringAvailabilityRule persistence.
- [ ] Player / GM / Venue availability windows.
- [ ] Profile ownership/authorization tests.
- [ ] Migrate validated onboarding UI from local/pilot storage to authenticated API.

**Do not start until Step 1 authorization is passing.**

## STEP 3 — Production Table Match and shared demand/supply — NOT STARTED

- [ ] PlayerDemandSignal persistence.
- [ ] GMSupplySignal persistence.
- [ ] VenueTableWindow persistence.
- [ ] Server-side hard-fit matching.
- [ ] Privacy-safe aggregate Player demand.
- [ ] TableMatch / TableMatchPlayer / MatchExplanation persistence.
- [ ] Table Fit scoring for experience/style/environment/accessibility.
- [ ] Newcomer-neutral ranking tests.
- [ ] Geographic/privacy tests.

## STEP 4 — Forming tables, bookings, seats, and lifecycle — NOT STARTED

- [ ] VenueBookingRequest persistence.
- [ ] GameSeries / Event persistence.
- [ ] TableExpectations persistence.
- [ ] Registration persistence.
- [ ] Request / confirm / waitlist / decline / cancel / remove transactions.
- [ ] Automatic waitlist promotion.
- [ ] Venue approval transaction.
- [ ] Minimum Player confirmation rule.
- [ ] Capacity/double-booking protection.
- [ ] Expected headcount updates.
- [ ] Idempotency/concurrency tests for joins and approvals.

## STEP 5 — Calendar, reminders, and recurring operations — NOT STARTED

- [ ] Production recurrence expansion.
- [ ] Per-session Skip / Move / cancel behavior.
- [ ] CalendarEventSync model.
- [ ] Calendar export/sync provider decision.
- [ ] Player/DM/Venue reminders.
- [ ] Schedule-change notifications.
- [ ] Timezone/DST tests.

## STEP 6 — Persistent Game Hub — NOT STARTED

- [ ] Persistent Message model/API.
- [ ] Table announcements.
- [ ] Table discussion.
- [ ] GM ↔ Venue operations channel.
- [ ] Player ↔ GM channel.
- [ ] Structured Player → Venue questions.
- [ ] Membership/role authorization for every channel.
- [ ] Rate limiting and abuse controls.
- [ ] Message moderation state.
- [ ] Real `game_id`/`event_id` deep links.

## STEP 7 — Attendance, feedback, and reputation — NOT STARTED

- [ ] Attendance recording.
- [ ] Structured post-game feedback.
- [ ] Feedback eligibility tied to completed verified interaction.
- [ ] Immutable ReputationEvent ledger.
- [ ] Derived ReputationSnapshot.
- [ ] New to DDD neutral state.
- [ ] Minimum sample thresholds.
- [ ] FairDiscoveryAudit telemetry.
- [ ] Correction/dispute path.

## STEP 8 — Trust, venue verification, and moderation — NOT STARTED

- [ ] Venue claim lifecycle and evidence review.
- [ ] Private reports.
- [ ] ModerationCase workflow.
- [ ] Block-user relationships.
- [ ] Signup/join/game/message/report/venue-claim rate limits.
- [ ] Suspension/ban enforcement.
- [ ] Moderator/admin audit trail.
- [ ] Reporting policy and operator runbook.

## STEP 9 — Production UI migration and polish — NOT STARTED

- [ ] Authenticated navigation/account state.
- [ ] Shared navigation/layout component.
- [ ] Replace local/pilot writes with production API calls one workflow at a time.
- [ ] Preserve three equal role entrances.
- [ ] Honest loading/error/empty/success states.
- [ ] Mobile and keyboard regression coverage for authenticated flows.
- [ ] No internal API/pilot terminology in normal user journeys.
- [ ] Production browser tests for Player, DM, and Venue paths.

## STEP 10 — Security, privacy, accessibility, and release gate — NOT STARTED

- [ ] Threat model and security review.
- [ ] Secret/config review.
- [ ] CORS/CSRF/session-token handling review appropriate to final frontend architecture.
- [ ] Database backup/restore test.
- [ ] Privacy/data-retention policy.
- [ ] Data export/deletion workflow.
- [ ] Manual NVDA test.
- [ ] Manual VoiceOver test.
- [ ] Manual WCAG 2.2 AA review.
- [ ] Production Lighthouse/browser/API CI green.
- [ ] Production error monitoring/logging.
- [ ] Admin/operator runbook.
- [ ] No unrestricted public writes until identity/authorization/abuse release gates pass.

## STEP 11 — Florence controlled launch — NOT STARTED

- [ ] Recruit initial public venues.
- [ ] Recruit initial DMs.
- [ ] Recruit initial Players.
- [ ] Venue onboarding one-pager.
- [ ] DM onboarding one-pager.
- [ ] Pilot reporting policy.
- [ ] Measure Successful Tables Played.
- [ ] Measure time-to-confirmed-table, fill rate, cancellations/no-shows, repeat groups, and venue visits.
- [ ] Review newcomer-vs-established successful-match rate.

---

## Deferred until density/validation exists

Do not let these distract from the production ladder above:

- Native mobile apps.
- Private-home discovery.
- POS integrations.
- Generic social feed.
- Complex achievements.
- Opaque AI-first matching.
- National launch before proving Florence/local density.
- Premium venue/GM tools.
- Ticketing/marketplace.
- DNDCards integration.
- Merchandise/B2B event products.

## Working rule

When continuing development, take the **first unchecked item in the current step whose dependencies are satisfied**, implement it, test it, update this file, and only then move to the next item. If architecture changes, record the decision in `docs/DECISIONS.md` before allowing the implementation and documentation to drift apart.
