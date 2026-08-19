# Dinner, Dice & Dragons

Dinner, Dice & Dragons turns **tabletop RPG interest across the United States into actual local game nights**.

Players tell us what they want to play. Game Masters tell us what they can run. Restaurants and community venues tell us when they have tables. The product finds the overlap and helps move a table through:

**Demand Signals → Table Match → Forming → Confirmed → Game Hub → Played**

## Core actions

- **Find My Table** — Player demand: systems, availability, travel radius, experience, and table preferences.
- **Form a Table** — GM supply: systems, availability, travel radius, GM style, and cadence.
- **Fill My Tables** — Venue capacity: table windows, capacity, policies, environment, and recurrence.

The differentiator is **physical-table formation**, not generic social networking.

## Deployment

Production platform: **Netlify via GitHub continuous deployment from `main`**.

- Public production URL: `https://dinnerdiceanddragons.netlify.app`
- Browser application: generated `dist/` static deployment
- Application API: native Netlify Function at `netlify/functions/api.mjs`
- Relational persistence: Netlify Database (managed PostgreSQL)
- Authentication: Netlify Identity
- Database migrations: `netlify/database/migrations/`
- Browser API requests remain same-origin under `/api/...`
- Netlify skips deploys for docs/test-only changes where production output is unaffected.

There is no external application host, database provider, or authentication provider in the production request path.

The original FastAPI/Alembic implementation remains in `/backend` as the reference implementation, schema provenance, and regression-test oracle. It is not the production web/API runtime.

GitHub Pages remains available as a static validation/fallback surface:

https://cbw29512.github.io/dinnerdiceanddragons/

See `USAGE.md` for Netlify Identity setup and the production smoke-test checklist.

## Current stage

The Table-first path is implemented across authenticated Player, GM, and Venue signals, hard-fit matching, persistent Tables, Event formation, registrations, venue booking decisions, and the Game Hub. The release gate is a controlled acceptance test on the Netlify production stack.

Dinner, Dice & Dragons is United States-wide. Florence, South Carolina is the first concentrated density pilot, not a geographic restriction on participation.

## Main surfaces

- `index.html` — premise, role actions, Table Match explanation, table discovery
- `join.html` — Player demand and GM supply signals
- `venues.html` — Venue onboarding and table openings
- `find-venue.html` — venue/table discovery
- `create-game.html` — convert a viable Table Match into an Event
- `game-hub.html` — confirmed-table coordination
- `conduct.html` — safety, reliability, and trust model
- `games/<slug>/` — sample game detail pages

## Product source of truth

Read these before implementing features:

- `PROJECT.md`
- `docs/PRODUCTION_MVP_PLAN.md`
- `docs/PRODUCT_POSITIONING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/DATA_SCHEMA.md`
- `docs/ROADMAP.md`
- `docs/UX_AUDIT.md`
- `docs/LOCATION_MATCHING.md`
- `docs/GAME_HUB.md`

A feature should primarily help discover useful demand, improve Table Match quality, form a viable table, reduce cancellations, help the session happen, improve safety/trust, or demonstrate venue value.

## Local run

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

The browser-only local run is useful for static work. Native production API/database/identity behavior is validated through the Netlify contract tests and deployed Netlify environment.

## Automated checks

The repository validates the reference backend and production browser/runtime experience with backend tests, migration checks, PostgreSQL contracts, static page/link checks, JavaScript tests, native Netlify API contract tests, a clean-PostgreSQL application of the Netlify Database migration, Playwright browser/accessibility/reflow checks, Lighthouse gates, supply-chain checks, CodeQL, and the generated Netlify deployment artifact contract.
