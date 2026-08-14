# Dinner, Dice & Dragons — Shared Pilot Backend

## Purpose

This document describes the repository's **controlled shared-pilot path**. It does not describe production authentication, authorization, privacy guarantees, or infrastructure.

The GitHub Pages site remains a local/sample validation experience unless `api-config.js` is given a deployed Apps Script web-app URL.

## Safety defaults

1. `api-config.js` intentionally ships with an empty `baseUrl`.
2. `setupSharedPilot()` creates the required sheets, seeds sample venue/window data, and then calls `disablePilotWrites()`.
3. Read-only pilot surfaces may be tested while writes remain disabled.
4. State-changing API actions require the script property `DDD_ENABLE_WRITES=true`, normally set only by explicitly running `enablePilotWrites()`.
5. Player IDs, GM IDs, Venue Manager IDs, Game IDs, and similar browser-stored IDs are **pilot identifiers, not production credentials**.
6. The current pilot does not provide secure authentication or role authorization. Do not treat it as a public production service.
7. Seeded venues are sample pilot data and are stored with `verified=false`.

## Pilot data model

The Apps Script spreadsheet schema now includes reusable structured signals rather than relying on opaque profile blobs:

- `Users`
- `Players`
- `PlayerSystems`
- `GMs`
- `GMSystems`
- `AvailabilityRules`
- `PlayerDemandSignals`
- `GMSupplySignals`
- `Venues`
- `VenueManagers`
- `VenueWindows`
- `TableMatches`
- `MatchExplanations`
- `VenueBookingRequests`
- `GameSeries`
- `Games`
- `Registrations`

Additional message, calendar, attendance, feedback, venue-metric, and report sheets remain available for later pilot work.

## Repeatable initialization

Run the repository Apps Script function:

```text
setupSharedPilot()
```

That function:

- creates missing schema sheets;
- seeds the current sample venue/window records using stable IDs;
- leaves seeded venues unverified;
- forces shared writes back to **disabled**.

`setupDatabase()` currently creates missing sheets and initializes empty sheets. It is not a general migration engine for arbitrary old spreadsheet headers. Schema migrations should be implemented deliberately before a pilot spreadsheet with incompatible legacy headers is reused.

## Read-only actions

These actions do not require the write gate:

| Action | Purpose | Sensitive fields returned? |
|---|---|---|
| `health` | Pilot service health | No |
| `games.list` | Public forming/confirmed Game summaries | No Player identity |
| `demand.summary` | Anonymous Player demand count by system/day | No |
| `match.query` | Privacy-preserving three-sided match calculation | No Player identity/ZIP/radius |
| `player.registration_state` | Active registration state for a supplied pilot Player ID | Pilot-ID scoped |
| `gm.registration_queue` | Registration queue for a Game owned by a supplied pilot GM ID | Pilot-ID scoped |
| `venue.booking_queue` | Booking requests owned by a supplied pilot Venue Manager ID | Pilot-ID scoped |

The ID-scoped reads are suitable only for a controlled pilot because possession of a non-public pilot ID is not equivalent to production authentication.

## Write actions

These actions require `DDD_ENABLE_WRITES=true` and run under the Apps Script write lock:

| Action | Purpose |
|---|---|
| `player.save` | Create/update Player profile, availability, and demand signals |
| `gm.save` | Create/update GM profile, availability, and supply signals |
| `venue.save` | Create/update Venue Manager, Venue, and table window |
| `game.save` | Create/update a Forming Game after server-side venue/capacity checks |
| `game.join` | Request/claim a Player seat subject to capacity/join mode |
| `game.cancel_registration` | Cancel the current Player's active registration and recover waitlist |
| `gm.registration_manage` | Approve/decline/remove a Game registration after GM ownership check |
| `venue.booking_manage` | Approve/decline/reopen a booking after Venue Manager ownership check |

## Identity reuse

The browser stores pilot IDs after a successful shared save so edits update the same records instead of creating duplicate demand/supply:

- `ddd-user-id`
- `ddd-player-id`
- `ddd-game-master-id`
- `ddd-venue-id`
- `ddd-venue-manager-id`
- `ddd-venue-window-id`
- `ddd-game-id`
- `ddd-series-id`

These values are intentionally described in the UI as **pilot identity**, not secure login credentials.

## Privacy-preserving Table Match

When no API URL is configured, `find-venue.html` uses the seeded/browser-local validation matcher.

When the pilot API is configured:

1. `demand.summary` returns only anonymous system/day counts.
2. `match.query` receives the GM's proposed system/day/time, GM ZIP, and radius.
3. Apps Script reads Player profile ZIP/radius and availability privately from the spreadsheet.
4. ZIP geocoding and Player-to-venue travel checks happen server-side.
5. The response returns aggregate compatibility only: venue, public venue data, Player counts, venue capacity, GM distance, score components, readiness, and explanations.
6. Player identity, Player ZIP, Player radius, email, and contact information are not returned to the browser.

The shared matcher currently uses the Zippopotam.us ZIP lookup service from Apps Script and caches ZIP coordinates with `CacheService`. A production implementation should replace or formally review that dependency as part of its privacy/security architecture.

## Server-owned hard constraints

`game.save` does not trust client claims for venue capacity or booking policy. The backend checks that:

- the supplied GM pilot profile exists;
- an edited Game is still owned by that GM ID;
- the Venue is active;
- the Venue Window is active and belongs to that Venue;
- maximum Player seats do not exceed the stored venue capacity after reserving one seat for the GM;
- minimum Players do not exceed maximum Players;
- the proposed day/start/duration fit inside the stored Venue Window;
- venue approval requirements are read from the stored Venue Window, not from the browser payload.

## Shared lifecycle rules

The shared pilot follows the product lifecycle rather than counting demand as commitment:

- Table Match demand = compatible candidates only.
- A saved Game begins `forming`.
- Player registrations may be `requested`, `confirmed`, `waitlisted`, `cancelled`, `declined`, or `removed`.
- A venue booking may be `requested`, `approved`, or `declined`.
- A Game becomes `confirmed` only when the venue is approved and confirmed Player registrations meet the Game minimum.
- A Game may become `full` when confirmed Players reach the maximum.
- Cancelling/removing a confirmed Player can promote the earliest waitlisted Player.
- If a confirmed Player count drops below the minimum, shared state returns to `forming`.
- The Game Hub remains a post-confirmation coordination surface.

## Enabling writes for a controlled pilot

Only after the spreadsheet and deployed API have been reviewed for the intended pilot should writes be deliberately enabled by running:

```text
enablePilotWrites()
```

To return the API to read-only mode:

```text
disablePilotWrites()
```

Running `setupSharedPilot()` also disables writes.

## Production blockers

Do **not** call this a production multi-user service until at least these are replaced or added:

- real authentication;
- role authorization tied to authenticated identity;
- secure session/token handling;
- database transactions and durable concurrency controls;
- formal venue verification;
- consent/privacy policy for location and contact data;
- rate limiting/abuse controls;
- server-side validation for every remaining write surface;
- audit logging and moderation controls;
- production-grade geocoding/privacy review;
- automated browser/accessibility/security regression testing;
- migration from spreadsheet persistence to the production data store.

## Current intent

The Apps Script path exists to test one question safely and cheaply: **does the three-sided workflow still make sense when Player demand, GM supply, Venue capacity, seat commitments, and venue approval are shared across browsers?**

It is a pilot bridge, not the final architecture.
