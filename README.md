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

Production application host: **Netlify via GitHub continuous deployment from `main`**.

- Public production URL: `https://dinnerdiceanddragons.netlify.app`
- Netlify build configuration lives in `netlify.toml`.
- Netlify publishes the generated `dist/` browser artifact.
- Browser API requests stay same-origin at `/api/...` and are handled by the native Netlify Function `netlify/functions/api.mjs`.
- Supabase remains the managed PostgreSQL database and authentication provider.
- The production Netlify function uses the server-only `SUPABASE_SECRET_KEY`; it is never exposed to browser code.
- Netlify skips deploys for backend/docs/test-only commits to avoid unnecessary build usage.

The original FastAPI implementation remains in `/backend` as the reference implementation, Alembic migration source, and regression-test oracle. It is no longer part of the production request path.

GitHub Pages remains available as a static validation/fallback surface:

https://cbw29512.github.io/dinnerdiceanddragons/

See `USAGE.md` for the production configuration and smoke-test checklist.

## Current stage

The production Table-first path is implemented across authenticated Player, GM, and Venue signals, hard-fit matching, persistent Tables, Event formation, registrations, venue booking decisions, and the Game Hub. Production acceptance testing with real test accounts remains the release gate.

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

The browser-only local run is useful for static work. Native production API behavior is validated through the Netlify function contract tests and deployed Netlify environment.

## Automated checks

The repository validates the reference backend and production browser/runtime experience with backend tests, migration checks, PostgreSQL contracts, authentication/RLS smoke tests, static page/link checks, JavaScript tests, native Netlify API contract tests, Playwright browser/accessibility/reflow checks, Lighthouse gates, supply-chain checks, CodeQL, and the generated Netlify full-stack deployment artifact contract.
