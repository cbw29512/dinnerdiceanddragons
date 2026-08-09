# Dinner, Dice & Dragons

A local tabletop RPG community platform for connecting players, Game Masters, games, and public partner venues.

> Find your table. Meet your party. Roll for adventure.

## Live Prototype

https://cbw29512.github.io/dinnerdiceanddragons/

## Current Stage

This repository contains the live static validation prototype plus the product documentation that governs future development.

## Prototype Surfaces

- `index.html` — homepage and ZIP/radius game discovery
- `join.html` — Player and Game Master onboarding previews
- `find-venue.html` — GM partner-venue discovery by ZIP/radius
- `venues.html` — partner venue pitch and listing preview
- `conduct.html` — community Code of Conduct
- `games/<slug>/` — dedicated SEO-friendly game detail pages

## JavaScript Modules

- `data.js` — sample events
- `discovery.js` — event-card rendering and interactions
- `geo.js` — shared ZIP lookup and distance calculation
- `location.js` — Player/event geographic filtering
- `game-detail.js` — saved-distance display on game pages
- `venues-data.js` — sample willing partner venues
- `venue-discovery.js` — GM/venue geographic matching
- `forms.js` — local prototype signup persistence and validation

## Run Locally

Serve the repository with a basic static HTTP server so browser fetch behavior matches GitHub Pages:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Automated Checks

`.github/workflows/site-checks.yml` runs on pushes and pull requests. It checks required HTML metadata/landmarks, local links and script references, and JavaScript syntax. The checker uses only Python's standard library plus the Node runtime provided by the GitHub-hosted runner.

## Project Source of Truth

Read these before implementing product features:

- `PROJECT.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/DATA_SCHEMA.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `docs/LOCATION_MATCHING.md`
- `docs/UX_AUDIT.md`

GitHub Issues contain the actionable implementation backlog.

## Architecture Direction

The prototype is static. Production direction remains FastAPI + PostgreSQL + Docker after the local-market concept is validated. The production frontend remains an explicit future decision.
