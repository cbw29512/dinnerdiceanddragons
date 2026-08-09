# Dinner, Dice & Dragons — Decision Log

This file records important product and architecture decisions so the project does not drift as it grows.

## Decision 001 — Events are the center of the product

**Status:** Accepted

Users do not primarily match with other users. Players discover games/events, and those events connect Players, Game Masters, and Venues.

This decision drives the future data model and recommendation system.

## Decision 002 — Swipe on games, not people

**Status:** Accepted

The Discover interface may use swipe-style interaction, but the object being judged is the game/event rather than another player.

This reduces the dating-app feel and better matches the platform's community purpose.

## Decision 003 — Public venues first

**Status:** Accepted for MVP

Initial events should focus on restaurants, breweries, cafes, game stores, libraries, and other public/community venues.

Private-home games are deferred until the platform has stronger trust, moderation, and verification systems.

## Decision 004 — Trust system instead of simplistic public ratings

**Status:** Accepted

Avoid relying on a single public star score for people.

Prefer structured evidence such as completed games, attendance, reliability, would-play-again responses, and other specific signals. Reports remain private moderation data.

## Decision 005 — Table Expectations are mandatory event data

**Status:** Accepted

Players should be able to understand table tone, rules, age guidance, PvP policy, content expectations, experience requirements, and related information before joining.

The platform should record acknowledgement of those expectations.

## Decision 006 — Multi-system architecture

**Status:** Accepted

The underlying product must not hard-code Dungeons & Dragons as the only RPG system.

D&D may be the launch focus, but the model must support Pathfinder, Call of Cthulhu, Cyberpunk RED, Shadowrun, and other tabletop RPGs.

## Decision 007 — Browse without account

**Status:** Accepted

Visitors should be able to browse public events and venue information without registering. Authentication is required when the user performs an action such as joining or hosting.

## Decision 008 — Initial hosting on GitHub

**Status:** Accepted

GitHub will initially be the project's source-code and documentation home. GitHub Pages is the preferred initial public prototype host while the concept is being validated.

The prototype must not lock the future production application into a static-only architecture.

## Decision 009 — Production backend direction

**Status:** Provisional

Current direction for the eventual interactive application is FastAPI + PostgreSQL + Docker.

Final production frontend architecture remains open while the GitHub Pages prototype is being designed.

## Decision 010 — North-star metric

**Status:** Accepted

The primary success metric is **Successful Tables Played**: real-world RPG sessions that actually occur.

Registrations, views, swipes, and other engagement metrics are supporting metrics rather than the primary outcome.

## Decision 011 — Working brand

**Status:** Provisional

Current working name: **Dinner, Dice & Dragons**.

The name should be researched for trademark and existing-use risk before substantial branding spend or final launch.

## Decision 012 — Accessibility is a release requirement

**Status:** Accepted

Accessibility is part of the design from the beginning. Swipe interactions must always have button and keyboard equivalents, and public UI should follow current WCAG-oriented practices.

---

## How to add decisions

Use the next sequential number and record:

- Decision
- Status
- Why it was made
- Consequences or follow-up work when relevant
