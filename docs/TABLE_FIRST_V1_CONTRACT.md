# Dinner, Dice & Dragons — Table-First V1 Contract

**Status:** Canonical V1 architecture extension  
**Branch introduced:** `agent/table-aggregate-v1`  
**Date:** 2026-08-18

This document sharpens the existing product decisions without discarding the production work already on `main`.

## Product rule

**The persistent Table is the center of formation and retention.**

Dinner, Dice & Dragons must be able to represent a useful tabletop group before all three marketplace sides are present.

A forming Table may simultaneously:

- need a GM;
- need one or more Players;
- need a Venue;
- need a concrete schedule;
- need Venue approval.

Those missing resources are requirements, not mutually exclusive lifecycle states.

## Existing objects remain valuable

### `TableMatch`

`TableMatch` remains the deterministic evidence that a specific GM supply signal, Venue capacity window, time occurrence, and compatible Player demand have passed the current full hard-fit matcher.

It is **not** the persistent group identity.

A fully viable TableMatch may seed or accelerate a persistent Table, but a Table may exist before a fully viable TableMatch exists.

### `Event`

The existing `Event` model remains the production scheduled occurrence for V1. Conceptually, it performs the role of a **Session**.

Do not rename or replace Event solely for terminology consistency. Introduce a nullable Table relationship in a backward-compatible migration when the Table aggregate is integrated into scheduled play.

### `GameSeries`

`GameSeries` remains recurrence/campaign scheduling metadata for the current implementation. It does not become the persistent group identity.

### `Registration`

`Registration` remains a Player's seat/join state for one Event. It does not replace persistent Table membership.

### `VenueBookingRequest`

Venue booking/approval remains authoritative for a scheduled Event and must continue enforcing Venue capacity.

## Venue value is broader than food

A Venue's marketplace value must never be reduced to food service, restaurant spend, or a purchase requirement.

A Venue may add value through any combination of:

- consistent recurring space;
- dedicated RPG/tabletop areas;
- private rooms;
- food, snacks, and/or beverages;
- discounts;
- loyalty or punch-card rewards;
- prize support;
- store credit or gift-card-style rewards;
- tabletop supplies;
- terrain or miniatures;
- storage;
- event promotion;
- staff support;
- another Venue-defined benefit.

Production Venue onboarding therefore includes structured `host_support_offerings` plus free-form `host_support_notes`.

A recurring `VenueTableWindow` may additionally define `special_support_offerings` and `special_support_notes` for incentives or services that apply only to that RPG night/window.

Examples include a game store providing a stable weekly table and allowing a GM to earn loyalty punches redeemable for prizes. That Venue is fully valuable even if it offers only snacks/drinks rather than restaurant meals.

`purchase_policy` remains optional operational information. It is **not** a measure of Venue quality and is not required for a Venue to participate.

## New persistent aggregate

### `GameTable`

A `GameTable` represents the persistent group-forming object.

Minimum V1 concepts:

- `id`
- `game_system_id`
- `created_by_user_id`
- `source_table_match_id` nullable
- `title`
- `lifecycle_status`
- `game_format`
- `minimum_players`
- `maximum_players`
- `join_policy`
- `visibility`
- `gm_profile_id` nullable while forming
- `venue_id` nullable while forming
- `venue_table_window_id` nullable while forming
- optional proposed start/end while formation is converging
- public-safe table style / minimum-age expectations
- timestamps

A Table may be Player-led, GM-led, Venue-led, or created from a complete TableMatch.

A Venue-only capacity window does not need to invent a game system. A venue-led Table opportunity becomes a concrete GameTable once enough compatible game demand/supply exists to identify the system and Table intent.

### `GameTablePlayer`

V1 keeps the persistent Player roster explicit rather than introducing a polymorphic membership abstraction prematurely.

Minimum concepts:

- `game_table_id`
- `player_profile_id`
- `source_player_demand_signal_id` nullable
- membership status
- request/invite/confirmation timestamps

The GM remains a nullable `gm_profile_id` on GameTable in V1 because the current production architecture assumes one operational GM per runnable game. Co-GMs/organizers can be designed later if pilot evidence requires them.

This keeps three concepts separate:

- GameTablePlayer = persistent group membership
- Registration = intent/seat state for one scheduled Event
- Attendance = what actually happened at the Event

## Table lifecycle

Authoritative lifecycle values for V1:

- `draft`
- `forming`
- `ready`
- `confirmed`
- `in_progress`
- `completed`
- `cancelled`
- `archived`

Lifecycle status is intentionally small.

Do **not** add authoritative lifecycle values such as `needs_gm`, `needs_players`, or `needs_venue`. Those conditions may coexist.

## Formation requirements

One service must deterministically calculate the Table's current missing requirements from persisted state.

Required output:

- `needs_gm: bool`
- `open_player_seats: int`
- `minimum_players_missing: int`
- `needs_venue: bool`
- `needs_venue_approval: bool`
- `needs_schedule: bool`
- `ready_to_confirm: bool`

Do not duplicate these calculations independently in routes and frontend components.

## Initial readiness invariant

A Table cannot be considered ready to confirm unless:

1. an active GM is attached;
2. at least `minimum_players` persistent Player commitments exist;
3. Player commitments do not exceed `maximum_players`;
4. a compatible public Venue is attached;
5. a concrete schedulable occurrence exists;
6. required Venue approval is satisfied before the scheduled occurrence becomes confirmed.

The existing Event lifecycle remains authoritative for the scheduled occurrence after Event creation.

## Matching relationship

Matching remains two layers:

### Formation opportunity layer

May surface incomplete combinations such as:

- five compatible Players need a GM;
- GM + Players need a Venue;
- Venue + Players need a GM;
- Venue + GM need Players;
- an almost-ready Table needs one Player.

### Full `TableMatch` layer

The current deterministic matcher may continue producing a fully viable GM + Venue + compatible Player occurrence with explainable hard-fit reasons.

A full TableMatch is therefore a strong formation input, not the only way a Table can begin.

## Discovery consequence

Existing Decision 001 (Events are the center of public discovery) remains correct only for scheduled confirmed game discovery.

Public discovery may also surface forming Tables/opportunities such as **Needs a GM**, **Needs Players**, **Needs a Venue**, and **Almost Ready**.

Users still discover game/table experiences rather than browsing people as a dating-style directory.

## Payments and monetization

**Payments are explicitly deferred until traction.**

V1 must not implement:

- Stripe or another payment processor;
- GM payouts;
- paid-seat checkout;
- subscriptions;
- platform transaction fees;
- ticketing fees;
- refund workflows;
- tax/payout infrastructure.

Product sequence:

1. prove Tables form;
2. prove scheduled Players actually attend;
3. prove Tables repeat;
4. prove Venues see enough value to host again;
5. build meaningful local density;
6. then evaluate monetization around behavior users already value.

Guiding rule:

> **First make Tables happen. Then monetize what users already value.**

## Provisional Florence traction gate

These are initial pilot targets, not industry benchmarks. Revisit them after real pilot data exists.

- 50 completed DD&D-created sessions/events;
- 100+ unique participating Players;
- 8–10 active GMs;
- 3+ repeat Venues;
- at least 75% average Player seat-fill rate;
- at least 85% RSVP/confirmed-seat-to-attendance rate;
- at least 30% of Players play again within 60 days;
- at least 50% of completed Tables schedule another occurrence.

These targets are a monetization/expansion discussion gate, not a reason to hide the product from users outside Florence. The platform remains nationwide while Florence is the initial density-validation market.

## V1 release proof

The release is not proven by registrations, page views, or a polished homepage alone.

The system must be able to persist and demonstrate:

**Player demand + GM supply + Venue capacity → forming GameTable → scheduled Event → Registration/RSVP state → Attendance → completed play → repeat Event/Table**

## Engineering order

1. GameTable + GameTablePlayer persistence and invariants.
2. Authoritative Table requirements service.
3. API/service layer for creating and joining incomplete Tables.
4. Link existing fully viable TableMatch conversion to GameTable.
5. Link Event to GameTable without breaking existing Event routes.
6. Add Attendance/check-in truth.
7. Add repeat-play flow.
8. Add traction queries/dashboard.
9. Only then expand into deferred features.
