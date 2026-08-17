# Dinner, Dice & Dragons

Dinner, Dice & Dragons turns **tabletop RPG interest across the United States into actual local game nights**.

Players tell us what they want to play. Game Masters tell us what they can run. Restaurants and community venues tell us when they have tables. The product finds the overlap and helps move a table through:

**Demand Signals → Table Match → Forming → Confirmed → Game Hub → Played**

## Core actions

- **Find My Table** — Player demand: systems, availability, travel radius, experience, and table preferences.
- **Form a Table** — GM supply: systems, availability, travel radius, GM style, and cadence.
- **Fill My Tables** — Venue capacity: table windows, capacity, policies, environment, and recurrence.

The differentiator is **physical-table formation**, not generic social networking.

## Live site

Primary deployment:

https://dinnerdiceanddragons.vercel.app

GitHub Pages remains available as a static validation/deployment surface:

https://cbw29512.github.io/dinnerdiceanddragons/

## Current stage

Production migration is actively underway.

- FastAPI, PostgreSQL, Supabase Auth, Alembic migrations, durable identity, server-side authorization, Player/GM/Venue profile persistence, and structured recurring availability are implemented.
- PlayerDemandSignal, GMSupplySignal, and VenueTableWindow persistence are implemented.
- Player and GM onboarding are connected to the authenticated production path.
- Venue account authentication is live, while the Venue table-opening workflow still has a temporary pilot/draft fallback.
- Authenticated Step 3 matching-input APIs exist in draft PR #29 and require reconciliation with current main before completion.
- Deterministic production recurrence expansion exists in draft PR #30 and requires reconciliation with current main before completion.
- The next major backend milestone is the real server-side Player x GM x Venue hard-fit Table Match engine.

Dinner, Dice & Dragons is United States-wide. Florence, South Carolina is the first concentrated density pilot, not a geographic restriction on participation.

## Main prototype surfaces

- `index.html` — premise, role actions, Table Match explanation, table discovery
- `join.html` — Find My Table and Form a Table signals
- `find-venue.html` — current GM/venue overlap and future Player-demand matching
- `venues.html` — Fill My Tables venue onboarding/business case
- `create-game.html` — convert a viable match into a Forming table
- `game-hub.html` — Confirmed-table coordination
- `conduct.html` — safety, reliability, and trust model
- `games/<slug>/` — sample Forming table detail pages

## Product source of truth

Read these before implementing features:

- `PROJECT.md`
- `docs/PRODUCTION_MVP_PLAN.md` - authoritative production execution checklist
- `docs/PRODUCT_POSITIONING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/DATA_SCHEMA.md`
- `docs/ROADMAP.md`
- `docs/UX_AUDIT.md`
- `docs/LOCATION_MATCHING.md`
- `docs/GAME_HUB.md`

A feature should primarily help discover useful demand, improve Table Match quality, form a viable table, reduce cancellations, help the session happen, improve safety/trust, or demonstrate venue value.

## Development rule

Do not let infrastructure determine the product, but do not treat production infrastructure as future work: the authenticated FastAPI/PostgreSQL foundation is already active.

Current engineering priority is to complete the production Table Match path in dependency order:

1. reconcile and merge authenticated Player demand, GM supply, and Venue capacity APIs;
2. reconcile and merge deterministic recurrence expansion;
3. implement explainable server-side hard-fit matching for system, actual schedule overlap, travel distance, venue capacity, and required constraints;
4. persist TableMatch, compatible Players, and MatchExplanation records;
5. add softer Table Fit ranking only after hard compatibility passes.

Nationwide architecture is required now; matching remains local to each participant's geography, travel radius, schedule, and venue availability.

## Local run

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Automated checks

The repository has automated coverage across the production backend and validated frontend, including:

- backend pytest coverage;
- Ruff lint and backend format checks;
- Alembic migration/head verification;
- PostgreSQL and Supabase Auth integration checks in CI;
- static page/link/fragment QA;
- button and controller wiring QA;
- JavaScript unit, API-client, and browser-auth tests;
- Playwright functional, runtime-health, keyboard, accessibility, and 320px reflow tests;
- Lighthouse performance, accessibility, best-practices, and SEO gates.

The current local recovery baseline passed 220 backend tests and 59 Playwright browser tests.
