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

## Decision 017 — Display names use canonical comparison while preserving chosen presentation

**Status:** Accepted for production identity implementation

A DDD display name is public presentation data, not the user's durable identity or authentication identifier. Display-name changes must never change `User.id` or any ownership/history relationships.

**Policy:**

- User-facing spelling is Unicode-normalized with NFKC and surrounding/repeated whitespace is collapsed before storage.
- A cleaned display name must contain at least one character and no more than 80 Unicode code points.
- Non-printable non-whitespace characters are rejected so invisible/control characters cannot be used to create misleading names.
- `display_name_normalized` is derived from the cleaned name with Unicode `casefold()` and is globally unique in PostgreSQL.
- Case-only and Unicode compatibility variants therefore cannot claim separate identities.
- A separate reservation key removes spacing/punctuation from the canonical form for platform-name checks, preventing trivial variants such as `A-d-m-i-n` from bypassing the reserved list.
- Reserved names are limited to platform/impersonation-sensitive terms such as admin, moderator, support, staff, system, official, and Dinner, Dice & Dragons brand variants. Ordinary RPG names and character names are not broadly reserved.
- The reserved list is maintained server-side and may be expanded as abuse patterns are observed.

**Consequences:**

- The API must use one shared display-name preparation function for account creation and display-name changes.
- The database unique constraint on `display_name_normalized` remains the final concurrency-safe uniqueness guarantee.
- UI availability checks are advisory; a transaction can still lose a race and must surface a useful “name already taken” response.
- Email addresses and auth-provider IDs are not substitutes for public display names.

## Decision 018 — Production onboarding writes follow domain boundaries, not pilot form boundaries

**Status:** Accepted

The validation prototype intentionally combines several future concepts into a small number of browser forms. Production persistence must not copy those form boundaries into the relational model when the fields belong to different lifecycle domains.

**Consequences:**

- Supabase/Auth-derived identity remains authoritative for email and the current DDD User. Production onboarding does not accept a client-supplied `user_id`, profile owner ID, or authoritative email.
- Step 2 Player onboarding persists the public display name, PlayerProfile fields, PlayerSystemExperience rows, and typed recurring Player availability windows.
- Step 2 GM onboarding persists the public display name, GMProfile fields, GMSystemExperience/GMSystemFormat rows, and typed recurring GM availability windows.
- Player table-style/demand preferences remain future `PlayerDemandSignal` data in Step 3 rather than being forced into PlayerProfile.
- GM cadence/supply preferences remain future `GMSupplySignal` data in Step 3 rather than being forced into GMProfile.
- Venue identity/manager data remains separate from venue table inventory. Day/time/capacity/purchase/approval fields remain future `VenueTableWindow` data in Step 3.
- Table-specific expectations remain attached to future games/events rather than being stored as permanent GMProfile data.
- During the migration, the UI must clearly distinguish account-saved production data from any still-local preview data; it must not claim that unsaved future-step fields are already available to production matching.

## Decision 019 — The MVP GameSystem catalog is migration-seeded with stable IDs and slugs

**Status:** Accepted

System experience records must reference canonical GameSystem rows. The production database therefore needs the same initial catalog in every environment before authenticated onboarding can persist Player or GM system selections.

**Consequences:**

- Alembic seeds the validated MVP system choices with deterministic UUIDs and stable lowercase slugs.
- Browser/API contracts use canonical slugs; clients do not invent or persist database UUIDs.
- The initial catalog contains D&D 5e (2014), D&D 5e (2024), Pathfinder 2e, Call of Cthulhu, Cyberpunk RED, Shadowrun, and a temporary `other-rpg` catch-all matching the current validated UI.
- `other-rpg` is not treated as a substitute for a future custom-system/catalog workflow. It is only a compatibility choice until that workflow is explicitly designed.
- Catalog rows are reference data, not user-owned profile data, and remain independently administrable after seeding.

---

## How to add decisions

Use the next sequential number and record:

- Decision
- Status
- Why it was made
- Consequences or follow-up work when relevant
