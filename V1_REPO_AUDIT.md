# Dinner, Dice & Dragons — V1 Repository Audit

**Branch audited:** `agent/live-game-hub-foundation`  
**Audit date:** 2026-08-18

This audit compares the existing production-oriented backend foundation with `PRODUCT_VISION.md`, `PRODUCT_DECISIONS.md`, `PROJECT.md`, and `V1_ENGINEERING_CONTRACT.md`.

## Executive Finding

**Do not rewrite the project.**

The repository already contains valuable production foundations for identity, roles, Player demand, GM supply, system-specific experience, recurring availability, Venue persistence, Venue management, and Venue table capacity. The primary missing piece is now the product center: a persistent `Table` lifecycle and the Session/membership/RSVP/attendance systems around it.

The recommended next development slice is therefore **Table Core**, not another onboarding rewrite and not payment work.

---

## KEEP — Existing Foundation That Fits the Canonical Product

### Identity and role foundation

Keep:

- `User`
- `UserRole`
- account status / authorization foundation
- `/me` API surface
- authentication integration
- privileged audit events

Reason: the canonical product requires one User to be able to participate in multiple capacities rather than maintaining three independent account systems.

### Player domain

Keep:

- `PlayerProfile`
- `PlayerSystemExperience`
- Player availability windows
- recurring availability rules
- `PlayerDemandSignal`

`PlayerDemandSignal` is already aligned with the Table-first vision: it persists a Player's desired game system, format/cadence, age preference, table-style preferences, environment preferences, and lifecycle status without requiring an existing event.

### GM domain

Keep:

- `GMProfile`
- `GMSystemExperience`
- GM availability windows
- recurring availability rules
- `GMSupplySignal`

`GMSupplySignal` already models a GM independently declaring what they are willing to run, including game system, format, cadence, minimum/maximum Player count, table style, and status.

### Venue domain

Keep:

- `Venue`
- `VenueManager`
- Venue verification concepts
- `VenueTableWindow`
- venue onboarding

The Venue model already contains useful public-business data including type, public location, coordinates, amenities, accessibility, parking, noise, lighting, verification, and active state.

`VenueTableWindow` already represents recurring Venue supply with table count, maximum people per table, purchase policy, approval requirement, environment notes, and active state. This is directly compatible with the three-sided marketplace.

### Infrastructure

Keep the production direction:

- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL-compatible persistence
- Docker / Compose
- environment-based configuration
- explicit CORS policy
- existing test structure

The current FastAPI entrypoint already uses explicit application construction, logging, settings, CORS boundaries, and versioned `/api/v1` routing.

---

## MODIFY — Existing Work That Should Be Extended, Not Replaced

### Matching signals

Current Player and GM signals use statuses such as active/paused/matched/expired.

Modify the semantics so `matched` does not imply the signal disappears after the first potential overlap. A signal may contribute to one or more opportunities until the user's intent is satisfied, paused, or expired. The exact consumption policy must be explicit.

### Matching service

Extend matching from independent Player/GM comparisons into an explainable three-sided opportunity engine:

- Player demand
- GM supply
- Venue capacity
- schedule intersection
- distance
- game system
- capacity
- accessibility/environment constraints

Matching should create/surface an opportunity; it should not silently commit participants.

### Availability

The existing availability model should become the common scheduling substrate for Player, GM, and Venue matching.

Do not create a second unrelated calendar model for Tables. Sessions should reference concrete timestamps derived from compatible availability.

### Venue capacity

`VenueTableWindow` represents capacity windows rather than a permanently numbered physical-table inventory. That is acceptable for V1.

Only introduce a separate `VenueTable` physical-resource model if real pilot operations demonstrate a need for numbered/configured tables. Do not create it merely because the conceptual schema contains the word Table.

### Onboarding APIs

Keep current onboarding endpoints, but future frontend flows should avoid forcing full registration before users can see useful public opportunities.

### API composition

Current `main.py` includes health, identity/profile onboarding/readback, and venue onboarding routers. Extend this modular route composition with dedicated Table, Session, RSVP/waitlist, attendance, and matching routers rather than growing `main.py` into a large controller.

---

## MISSING — Required Product-Center Capabilities

### 1. Persistent `Table`

No production ORM `Table` model is currently registered.

Required next.

### 2. Table requirements engine

No single authoritative service currently answers:

- needs GM?
- how many Players are missing?
- are seats open?
- needs Venue?
- needs Venue approval?
- needs schedule?
- ready to confirm?

This must be centralized instead of reconstructed independently by UI/routes.

### 3. Table membership

Missing persistent roster and membership state:

- requested
- invited
- confirmed
- declined
- removed/left

This must be separate from a Session RSVP.

### 4. Session

Missing one-occurrence scheduling object tied to a persistent Table.

Needed to separate a recurring group from individual game nights.

### 5. RSVP

Missing participant intent per Session.

RSVP must not be treated as attendance.

### 6. Attendance / check-in

Missing authoritative record of who actually attended.

This is required for:

- traction measurement
- reliability evidence
- venue actual-vs-expected traffic
- repeat-play metrics

### 7. Waitlist / seat recovery

Missing queue/offering lifecycle for replacing cancelled seats without overbooking.

### 8. Repeat-session workflow

Missing simple action to preserve the Table and schedule another Session.

This is the first retention loop and should precede elaborate campaign-management features.

### 9. Traction instrumentation

The current domain foundation can measure supply/demand creation, but the product cannot yet authoritatively measure the complete funnel:

`signal -> opportunity -> Table -> confirmed Session -> attendance -> completed Session -> repeat`

The missing Table/Session models are prerequisites.

### 10. Table-focused API surface

Missing resource families for:

- Tables
- membership / seat requests
- requirements
- Sessions
- RSVP
- waitlist
- attendance
- explainable opportunities

---

## DEFER — Do Not Pull Into the Current Build

The following remain out of the active V1 implementation path:

- Stripe/payment provider integration
- paid GM checkout or payouts
- subscriptions
- ticketing fees
- refunds/payment disputes
- tax/payout infrastructure
- full campaign notes/wiki tooling
- full real-time Discord replacement
- VTT/game engine
- POS/food ordering integration
- publisher marketplace
- advanced AI matching
- loyalty/gamification systems
- nationwide expansion mechanics
- private-home venue discovery

---

## Architecture Risk Findings

### Risk 1 — Treating `Table Match` as the Table itself

A match/opportunity is evidence that compatible demand may exist. A `Table` is a persistent group-forming object with commitments and lifecycle.

Do not conflate these.

### Risk 2 — Using `NEEDS_GM`, `NEEDS_PLAYERS`, `NEEDS_VENUE` as one status enum

A forming Table can need all three simultaneously.

Use a small lifecycle status plus computed/persisted requirements.

### Risk 3 — Conflating membership, RSVP, and attendance

These answer different questions:

- membership: who belongs to/is trying to join the Table?
- RSVP: do they intend to attend this Session?
- attendance: did they actually attend?

Keep them separate.

### Risk 4 — Overengineering venue physical inventory

Existing `VenueTableWindow` is already capable of expressing recurring offered capacity. Keep it until pilot evidence requires individually numbered physical resources.

### Risk 5 — Building reputation before trustworthy attendance data

Verified reliability requires completed Session + attendance truth. Build attendance first; reputation aggregation can follow.

### Risk 6 — Building monetization before liquidity

Explicitly prohibited by Product Decision 001.

---

## Recommended Build Order

### Slice 1 — Table Core **NEXT**

Implement:

- `Table`
- Table lifecycle enum/constraints
- Table requirements result/schema
- requirements service
- Alembic migration
- unit tests for invariants and readiness
- model registration

Do not expose broad mutation routes until the service rules are tested.

### Slice 2 — Membership and seat safety

Implement:

- `TableMember`
- join/request/invite rules
- capacity enforcement
- concurrency-safe seat claims
- authorization tests

### Slice 3 — Sessions + Venue confirmation

Implement:

- `Session`
- schedule validation
- Venue approval state
- READY -> CONFIRMED service transition
- session APIs/tests

### Slice 4 — RSVP + Waitlist

Implement:

- RSVP
- cancellation
- WaitlistEntry
- safe offer/accept lifecycle

### Slice 5 — Attendance

Implement:

- check-in
- attendance reconciliation
- no-show vs cancelled distinction
- completed Session transition

### Slice 6 — Repeat Play

Implement:

- create next Session from existing Table
- preserve roster
- request fresh RSVPs
- minimal Campaign linkage only if necessary

### Slice 7 — Three-way matching integration

Connect the already-existing Player demand, GM supply, Venue windows, and availability engine to Table opportunities and Table creation.

### Slice 8 — Traction metrics

Build authoritative operational queries from persisted lifecycle records.

### Slice 9 — Frontend completion

Wire the real APIs into:

- I Want to Play
- I Want to Run
- I Have a Table
- Almost Ready
- Needs GM
- Needs Players
- Needs Venue
- Game-day dashboard
- Play Again

---

## Immediate Engineering Target

The next commit that changes production Python should establish **Table Core**.

The target is not a full UI. The target is a tested domain foundation capable of representing:

> A forming Table that may simultaneously be missing a GM, Players, Venue, and schedule, and that can deterministically become READY only when the necessary conditions are satisfied.

Once that exists, the rest of V1 can attach cleanly to the central product object.
