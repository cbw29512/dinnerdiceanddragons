# Dinner, Dice & Dragons

A local tabletop RPG community platform for connecting players, Game Masters, games, and public partner venues.

> Find your table. Meet your party. Roll for adventure.

## Current Stage

This repository currently contains the first static public prototype plus the product documentation that governs future development.

## Prototype

The static prototype is intentionally dependency-free so it can be hosted on GitHub Pages.

Files:

- `index.html` — semantic homepage and public prototype
- `styles.css` — responsive and accessibility-conscious styling
- `data.js` — realistic sample event data shaped toward the future schema
- `app.js` — accessible prototype event-card interactions
- `.github/workflows/pages.yml` — GitHub Pages deployment

## Run Locally

Open `index.html` in a browser, or serve the repository with any basic static HTTP server.

Example with Python:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Project Source of Truth

Read these before implementing product features:

- `PROJECT.md`
- `docs/DEFINITION_OF_DONE.md`
- `docs/DATA_SCHEMA.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`

GitHub Issues contain the actionable implementation backlog.

## Architecture Direction

The prototype is static. Production direction remains FastAPI + PostgreSQL + Docker after the local-market concept is validated. The production frontend remains an explicit future decision.
