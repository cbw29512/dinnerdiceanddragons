# Dinner, Dice & Dragons — V1 Engineering Contract

> This document converts `PRODUCT_VISION.md`, `PRODUCT_DECISIONS.md`, and `PROJECT.md` into an implementation contract. V1 work should be evaluated against this document before new features are accepted.

## 1. V1 Objective

V1 must prove one thing:

> Dinner, Dice & Dragons can turn compatible Player demand + GM supply + Venue capacity into a real in-person tabletop session, record whether it happened, and make repeating the table easier.

V1 is not a monetization release. Payments, payouts, subscriptions, ticketing, transaction fees, refunds, and tax infrastructure remain explicitly deferred until traction.

## 2. Definition of Done

V1 is complete when the following end-to-end workflow works against production persistence, authentication, authorization, and tests:

1. A Player can create an account/profile, declare what they want to play, where they are willing to travel, and when they are available.
2. A GM can create an account/profile, declare what they are willing to run, capacity, preferred format/cadence, location constraints, and availability.
3. A Venue manager can claim/create a public venue, publish usable table capacity, rules, and availability.
4. The platform can identify a viable overlap among Player demand, GM supply, and Venue capacity using explainable hard constraints first.
5. A viable overlap can become a persistent `Table`.
6. A Table can show what is still missing: GM, Player seats, Venue, and/or schedule confirmation.
7. Players can request or claim seats according to the Table's join policy.
8. A GM can manage the Table roster and seat capacity.
9. A Venue can approve or reject use when venue approval is required.
10. A Table can become `READY` only when required resources and minimum commitments are satisfied.
11. A Table can become `CONFIRMED` only when its Session has a concrete date/time, venue requirements are satisfied, and the minimum committed Player count is met.
12. Confirmed participants can see the session in their DD&D calendar/dashboard.
13. Players can RSVP yes/no and cancel.
14. Open seats can be offered to a waitlist without overbooking the Table.
15. On game day, attendance/check-in can be recorded.
16. A Session can be marked completed only after its scheduled start and attendance can be reconciled.
17. The platform can record whether a scheduled session was completed, cancelled, or postponed.
18. A completed Table can create/schedule another Session without rebuilding the group from scratch.
19. The platform can measure the core traction funnel from demand signal through completed Session.
20. Core flows are usable on mobile, keyboard accessible, and do not require private home-address discovery.

## 3. Canonical Domain Model

### Existing foundation to preserve

These concepts already fit the product and should remain unless an implementation defect requires revision:

- `User`
- `UserRole`
- `PlayerProfile`
- `GMProfile`
- `GameSystem`
- `PlayerDemandSignal`
- `GMSupplySignal`
- `RecurringAvailabilityRule`
- Player / GM availability windows
- `Venue`
- `VenueManager`
- `VenueTableWindow`
- privileged/admin audit records

### New central domain objects required for V1

#### `Table`

The persistent group-forming object. A Table exists independently of any single Session.

Minimum fields/concepts:

- id
- game_system_id
- created_by_user_id
- lifecycle_status
- title / public label
- format (learn-to-play, one-shot, short campaign, long campaign, organized play)
- minimum_players
- maximum_players
- join_policy
- visibility
- table_style / expectations
- minimum_age policy where applicable
- active venue_id, nullable while forming
- active gm_profile_id, nullable while forming
- source player-demand / GM-supply / venue-window references where useful for explainability
- created_at / updated_at

#### `TableMember`

Connects a User/Player to a Table without conflating membership with one Session's RSVP.

Minimum concepts:

- table_id
- user_id / player_profile_id
- role at table (`player`, `gm`, optional `organizer` later)
- membership_status (`requested`, `invited`, `confirmed`, `declined`, `removed`, `left`)
- joined_at

V1 must enforce one active GM for a runnable Table while allowing a Table to exist temporarily with no GM during formation.

#### `Session`

One scheduled occurrence of play for a Table.

Minimum concepts:

- table_id
- starts_at
- ends_at or duration
- venue_id
- lifecycle_status
- venue_confirmation_status
- created_at / updated_at

A one-shot may have one Session. A recurring campaign has many Sessions attached to the same Table/Campaign context.

#### `RSVP`

A participant's response for one Session.

Minimum concepts:

- session_id
- table_member_id
- response (`yes`, `no`, `maybe`, `pending`)
- responded_at
- cancellation timestamp/reason category when applicable

#### `Attendance`

Verified game-day participation, separate from RSVP intent.

Minimum concepts:

- session_id
- table_member_id
- attendance_status (`checked_in`, `attended`, `no_show`, `excused`, `unknown`)
- checked_in_at
- verified_at / verification source

#### `WaitlistEntry`

Seat-recovery queue for a Table/Session.

Minimum concepts:

- table_id and/or target session_id
- player_profile_id
- status (`waiting`, `offered`, `accepted`, `declined`, `expired`, `removed`)
- position / priority inputs
- offer expiration timestamp

Waitlist logic must use deterministic, explainable eligibility rules and must not overbook capacity.

#### `Campaign`

V1 may implement this minimally. A recurring Table can have a Campaign record for persistent naming/continuity, but V1 must not expand into full campaign-management software.

Minimum concepts if created in V1:

- table_id
- title
- status
- started_at
- ended_at

#### `TableRequirement` / computed formation requirements

Formation requirements must be represented independently from the lifecycle status. Implementation may persist requirements or compute them from authoritative data, but there must be one deterministic service that answers:

- needs_gm
- open_player_seats
- minimum_players_missing
- needs_venue
- needs_venue_approval
- needs_schedule
- ready_to_confirm

Do not scatter this logic across routes/UI components.

## 4. State Model

### Table lifecycle status

Use a small lifecycle state machine:

- `DRAFT` — owner/creator is still configuring the Table.
- `FORMING` — publicly/privately forming and may still be missing resources.
- `READY` — required GM, minimum Players, Venue, and scheduling constraints are satisfiable; ready for final confirmation.
- `CONFIRMED` — at least one concrete upcoming Session is confirmed.
- `IN_PROGRESS` — a Session is currently active; Table remains persistent.
- `COMPLETED` — terminal for a one-shot Table when no continuation is intended.
- `CANCELLED` — Table is closed without completion.
- `ARCHIVED` — retained history, no longer active.

Do **not** use mutually-exclusive statuses such as `NEEDS_GM`, `NEEDS_PLAYERS`, and `NEEDS_VENUE` as the authoritative lifecycle state. A Table can need several of these simultaneously.

### Session lifecycle status

- `DRAFT`
- `SCHEDULED`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `POSTPONED`

### Formation requirements

Requirements are orthogonal to lifecycle state:

- `needs_gm: bool`
- `open_player_seats: int`
- `minimum_players_missing: int`
- `needs_venue: bool`
- `needs_venue_approval: bool`
- `needs_schedule: bool`

Example: a `FORMING` Table may simultaneously have `needs_gm=true`, `minimum_players_missing=2`, and `needs_venue=true`.

## 5. State Transition Rules

All transitions must occur through service-layer methods with transaction boundaries, logging, validation, and explicit errors. Routes must not directly mutate lifecycle fields.

### Table

`DRAFT -> FORMING`
- required public configuration is valid
- creator is authorized

`FORMING -> READY`
- GM assigned
- minimum committed Players satisfied
- selected Venue/capacity is compatible or a concrete venue reservation path is accepted
- a schedulable time exists

`READY -> CONFIRMED`
- concrete Session exists
- Venue approval satisfied if required
- minimum committed Players remain satisfied
- GM remains assigned/available

`CONFIRMED -> IN_PROGRESS`
- Session has reached start/check-in window

`IN_PROGRESS -> COMPLETED`
- Session completed and attendance reconciliation allowed
- one-shot Table may close; recurring Table normally returns to a reusable confirmed/forming state through the next Session workflow rather than being destroyed

Any active state may transition to `CANCELLED` only with an authorized actor and audit reason.

### Invariants

- maximum_players >= minimum_players >= 1
- confirmed active Player membership must never exceed maximum_players
- one person cannot occupy multiple Player seats on the same Table
- a runnable Table has exactly one active GM in V1
- RSVP does not equal Attendance
- attendance cannot be fabricated merely because a Player RSVPed yes
- Venue availability and capacity must be checked for the scheduled Session
- new users are neutral in reputation/matching, never penalized for missing history
- monetary/payment state must not exist in V1 domain transitions

## 6. Matching Contract

Matching produces **opportunities**, not hidden automatic commitments.

Order:

1. Hard constraints
   - game system / edition constraints
   - compatible time window
   - travel radius
   - GM availability
   - Venue availability/capacity
   - minimum/maximum Player capacity
   - age/accessibility/environment/policy requirements
2. Preference fit
   - format/cadence
   - beginner fit
   - table style
   - environment preferences
3. Reputation only as a secondary evidence/tie-break layer

Every surfaced match must be explainable with human-readable reasons. Do not expose a mysterious compatibility percentage without its inputs.

## 7. API Boundary for V1

Expected resource families, exact paths to be finalized during implementation:

- `/me`
- `/onboarding/...`
- `/player-demand`
- `/gm-supply`
- `/venues`
- `/venue-availability`
- `/tables`
- `/tables/{id}/members`
- `/tables/{id}/requirements`
- `/tables/{id}/waitlist`
- `/tables/{id}/sessions`
- `/sessions/{id}/rsvps`
- `/sessions/{id}/attendance`
- `/matches` or `/table-opportunities`

All write endpoints must authorize the acting User and route mutations through services.

## 8. Error and Logging Contract

For new Python production code:

- use meaningful structured/module logging
- service-layer operations must catch expected database/domain exceptions, log relevant identifiers without sensitive data, and raise explicit domain/API errors
- unexpected exceptions must be logged with stack traces at application boundaries and re-raised/translated safely
- no silent `except: pass`
- no route should conceal partial transaction failure

Keep modules focused; split files approaching/exceeding roughly 150 lines when responsibilities can be separated cleanly.

## 9. Testing Contract

Every V1 slice requires unit/service tests plus API tests where a route exists.

Minimum high-value scenarios:

- Player demand creation and validation
- GM supply creation and capacity validation
- Venue capacity/approval validation
- hard-constraint matching
- creation of a Table from compatible signals
- Table can remain forming while multiple requirements are missing
- cannot mark READY without GM/min Players/Venue/schedule conditions
- cannot overfill Player seats
- concurrent seat claims do not overbook
- waitlist fills a newly opened seat safely
- RSVP cancellation opens capacity correctly
- RSVP yes does not create attendance automatically
- check-in/attendance rules
- Venue approval required vs not required
- Session complete/cancel/postpone transitions
- repeat Session creation from an existing Table
- authorization boundaries for Player, GM, Venue manager, Admin

## 10. Traction Instrumentation Required in V1

The application must make these measurable from authoritative records:

- active Player demand signals
- active GM supply signals
- active Venue capacity windows
- potential matches generated
- Tables created
- Tables reaching READY
- Tables reaching CONFIRMED
- Sessions scheduled
- Sessions completed
- formation completion rate
- seat fill rate at confirmation/start
- RSVP-to-attendance rate
- cancellation/no-show rate
- repeat Session rate
- repeat Venue host rate
- time from first relevant demand signal to confirmed Session

Do not optimize around registrations/page views as the north-star metric.

## 11. Explicitly Deferred from V1

- payments / Stripe / GM payouts / subscriptions / ticketing / transaction fees
- full Discord-style messaging
- full campaign notes/content management
- VTT/gameplay engine
- DNDCards gameplay implementation
- Character Forge implementation beyond a clean future integration boundary
- POS/restaurant ordering integrations
- advanced AI matching
- publisher marketplace
- complex loyalty/gamification
- nationwide cold-start launch
- private-home venue discovery

## 12. Implementation Sequence

Build in vertical slices, preserving the existing foundation:

1. **Table Core** — models, requirements service, migrations, tests.
2. **Table Membership** — seat claims/requests, capacity concurrency, authorization.
3. **Sessions** — schedule, Venue approval, Table READY/CONFIRMED transitions.
4. **RSVP + Waitlist** — cancellation and seat recovery.
5. **Attendance** — check-in and completed-session truth.
6. **Repeat Play** — create next Session from the existing Table/Campaign context.
7. **Matching Integration** — turn existing demand/supply/capacity signals into explainable Table opportunities and Table creation.
8. **Traction Metrics** — reliable operational queries/dashboard inputs.
9. **UX completion** — Player, GM, Venue flows against real APIs, mobile/accessibility/SEO validation.

## 13. V1 Release Gate

Do not call V1 complete because the homepage looks finished or because matching produces sample cards.

V1 releases only when a test/pilot user can complete the real lifecycle:

**Player demand + GM supply + Venue capacity -> viable opportunity -> Table -> confirmed Session -> RSVP -> check-in/attendance -> completed Session -> repeat Session**

and the system can prove that lifecycle from persisted records.
