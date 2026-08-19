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

Production frontend target: **Netlify via GitHub continuous deployment from `main`**.

- Netlify build configuration lives in `netlify.toml`.
- Netlify publishes only the generated `dist/` frontend artifact.
- Browser API requests stay same-origin at `/api/...` and are proxied by `netlify/functions/api-proxy.mjs`.
- The FastAPI service remains containerized and is supplied to Netlify through the server-only `DDD_API_ORIGIN` environment variable.
- Netlify skips deploys for backend/docs/test-only commits to avoid unnecessary build usage.

The final Netlify URL will become the canonical public URL after the GitHub repository is connected and the production smoke test passes.

GitHub Pages remains available as a static validation/fallback surface:

https://cbw29512.github.io/dinnerdiceanddragons/

See `USAGE.md` for the short production connection checklist.

## Current stage

The production Table-first path is implemented across authenticated Player, GM, and Venue signals, hard-fit matching, persistent Tables, Event formation, registrations, venue booking decisions, and the Game Hub. Production acceptance testing with real accounts remains the release gate.

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

## Automated checks

The repository validates the production backend and browser experience with backend tests, migration checks, PostgreSQL contracts, authentication/RLS smoke tests, static page/link checks, JavaScript tests, Playwright browser/accessibility/reflow checks, Lighthouse gates, supply-chain checks, CodeQL, the Docker runtime contract, and the generated Netlify deployment artifact contract.
