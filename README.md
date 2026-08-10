# Dinner, Dice & Dragons

Dinner, Dice & Dragons turns **local tabletop interest into actual game nights**.

Players tell us what they want to play. Game Masters tell us what they can run. Restaurants and community venues tell us when they have tables. The product finds the overlap and helps move a table through:

**Demand Signals → Table Match → Forming → Confirmed → Game Hub → Played**

## Core actions

- **Find My Table** — Player demand: systems, availability, travel radius, experience, and table preferences.
- **Form a Table** — GM supply: systems, availability, travel radius, GM style, and cadence.
- **Fill My Tables** — Venue capacity: table windows, capacity, policies, environment, and recurrence.

The differentiator is **physical-table formation**, not generic social networking.

## Live prototype

https://cbw29512.github.io/dinnerdiceanddragons/

## Current stage

GitHub Pages validation prototype. Shared persistence and the earlier Google Sheets + Apps Script scaffold are paused until the new three-sided Table Match workflow is validated.

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
- `docs/PRODUCT_POSITIONING.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/DATA_SCHEMA.md`
- `docs/ROADMAP.md`
- `docs/UX_AUDIT.md`
- `docs/LOCATION_MATCHING.md`
- `docs/GAME_HUB.md`

A feature should primarily help discover useful demand, improve Table Match quality, form a viable table, reduce cancellations, help the session happen, improve safety/trust, or demonstrate venue value.

## Development rule

Do not let infrastructure determine the product. The next product-risk milestone is **realistic Player-demand aggregation combined with GM availability and Venue capacity**. Backend implementation resumes after that workflow is proven.

## Local run

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Automated checks

`.github/workflows/site-checks.yml` validates page metadata/internal file links, browser JavaScript syntax, and Apps Script syntax. Fragment-link validation and browser accessibility smoke tests remain roadmap items.
