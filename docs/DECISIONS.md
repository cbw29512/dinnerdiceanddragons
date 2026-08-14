# Dinner, Dice & Dragons — Decision Log

This file records important product and architecture decisions so the project does not drift as it grows.

## Decision 001 — Events are the center of public discovery

**Status:** Accepted

Players discover games/events rather than browsing people. Events connect Players, Game Masters, and Venues.

## Decision 002 — Swipe on games, not people

**Status:** Accepted

The Discover interface may use swipe-style interaction, but the object being judged is the game/event rather than another person.

## Decision 003 — Public venues first

**Status:** Accepted for MVP

Initial events focus on restaurants, breweries, cafes, game stores, libraries, and other public/community venues. Private-home games are deferred.

## Decision 004 — Trust system instead of simplistic public ratings

**Status:** Accepted

Prefer structured evidence such as completed games, attendance, reliability, would-play-again responses, and specific signals. Reports remain private moderation data.

## Decision 005 — Table Expectations are mandatory event data

**Status:** Accepted

Players should understand table tone, rules, age guidance, PvP policy, content expectations, experience requirements, and related information before joining.

## Decision 006 — Multi-system architecture

**Status:** Accepted

The product must not hard-code Dungeons & Dragons as the only RPG system.

## Decision 007 — Browse without account

**Status:** Accepted

Visitors may browse public events and venue information without registering. Authentication is required for actions such as joining or hosting in production.

## Decision 008 — Initial hosting on GitHub

**Status:** Accepted

GitHub is initially the source-code/documentation home and GitHub Pages hosts the validation prototype.

## Decision 009 — Production backend direction

**Status:** Provisional

Current direction is FastAPI + PostgreSQL + Docker. Final production frontend remains open.

## Decision 010 — North-star metric

**Status:** Accepted

The primary success metric is **Successful Tables Played**.

## Decision 011 — Working brand

**Status:** Provisional

Current working name: **Dinner, Dice & Dragons**. Trademark/existing-use research is required before major branding spend.

## Decision 012 — Accessibility is a release requirement

**Status:** Accepted

Accessibility is part of the design from the beginning. Critical interactions must have keyboard/button equivalents.

## Decision 013 — GM availability is the scheduling anchor

**Status:** Accepted

The GM runs the game, so a new table begins with when and where the GM can actually run one.

The operational chain is:

**GM availability -> matching venue window -> confirmed game -> Player discovery**

Player availability remains important for event matching, but it is evaluated after a viable GM + venue combination exists.

**Consequences:**

- GM onboarding must prominently collect reusable availability windows.
- The Create Game wizard begins by selecting GM availability.
- Venue discovery must rank/filter by both distance and schedule overlap.
- A recurring party's next session also begins with GM availability.

## Decision 014 — Venues publish specific table windows

**Status:** Accepted

A venue does not make an open-ended promise to "host RPGs." It publishes inventory-like table windows it is comfortable offering.

A venue window includes day/date, start/end time, recurrence, number of tables, guest capacity, purchase policy, approval requirements, and operating instructions.

**Consequences:**

- Venue profiles and VenueTableWindow records are separate concepts.
- GMs only see/request compatible offered windows.
- Venues retain control over when RPG groups are acceptable.
- Production matching needs schedule-overlap logic in addition to geographic matching.

## Decision 015 — Restaurant acquisition starts with a four-week low-risk pilot

**Status:** Accepted as initial go-to-market approach

The easiest initial venue ask is:

> One table or small set of tables, on one slower recurring night, for a four-week trial. The venue sets the hours, group size, purchase rule, and approval requirements. The GM runs the game.

No long-term commitment is required during validation.

**Pilot metrics:** confirmed guests, actual attendance, repeat groups, cancellations/no-shows, qualitative venue feedback, optional spend feedback, and whether the venue chooses to continue.

## Decision 016 — Supabase Auth + PostgreSQL for the first production identity/data foundation

**Status:** Accepted for initial production implementation

Dinner, Dice & Dragons will use **Supabase Auth** as the initial authentication provider and **PostgreSQL** as the durable relational data store. The initial managed database target may be Supabase Postgres, while application models and migrations remain portable PostgreSQL and the API/policy layer remains FastAPI.

**Why:**

- Auth provides verified-email flows and standards-based signed JWTs that FastAPI can verify server-side.
- Supabase Auth is backed by PostgreSQL and integrates naturally with a relational application schema.
- The initial local/pilot scale fits comfortably within the provider's entry tiers without forcing a bespoke authentication system.
- Using an external mature identity provider avoids storing or verifying user passwords in DDD application code.
- Standard PostgreSQL tables, stable DDD internal IDs, and provider-subject mapping preserve a future migration path.

**Authorization rule:**

Authentication answers **who the user is**. The DDD application database answers **what that user is allowed to do**. Player, DM, Venue Manager, moderator, admin, ownership, booking, registration, messaging, and moderation permissions remain server-side application policy; provider metadata is not the authoritative permission store.

**Consequences:**

- `User.id` remains an immutable internal DDD identifier.
- Supabase `sub` is stored as `auth_provider_user_id` and is unique, but is not exposed as the application's public identity.
- One DDD User may hold multiple application roles.
- Anonymous visitors remain browse-only.
- Verified email is required before active participation.
- FastAPI validates signed access tokens and enforces account status, roles, ownership, and resource relationships.
- Sensitive application tables are not opened to unrestricted browser writes; database/RLS controls may be used as defense in depth, not as a replacement for API authorization.
- Provider/service secrets are server-only and never committed or shipped to the browser.
- Auth/provider migration must preserve the internal DDD User ID and application relationships.

---

## How to add decisions

Use the next sequential number and record:

- Decision
- Status
- Why it was made
- Consequences or follow-up work when relevant
