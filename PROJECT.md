# Dinner, Dice & Dragons

## Project Purpose

Dinner, Dice & Dragons turns **tabletop RPG interest across the United States into actual local game nights**.

The product coordinates three independent signals:

- **Players** — what they want to play, when they can attend, how far they will travel, and what table fits them.
- **Game Masters** — what they can run, when they can run it, how far they will travel, and what kind of table they host.
- **Venues** — when they want groups, how much capacity they have, and what business/environment rules apply.

The platform finds the overlap and helps move it through a real-world lifecycle:

**Demand signals → Table Match → Forming → Confirmed → Game Hub → Played → Trust + repeat**

**Scope:** Dinner, Dice & Dragons is a United States-wide platform. Players, Game Masters, and Venues may participate anywhere in the U.S. Matching remains geographically local to each user's travel constraints and venue availability. Florence, South Carolina is the first density pilot, not a product boundary.

The primary success metric is not signups, posts, swipes, or reputation points. It is **successful in-person tabletop sessions**.

---

## Core Product Actions

### 🎲 Find My Table
A Player creates a structured demand signal. The platform surfaces confirmed games, forming tables, and useful demand opportunities without exposing private Player data.

### 🧙 Form a Table
A GM creates a supply signal. The platform compares the GM's availability and game systems with nearby Player demand and willing venue capacity.

### 🍽️ Fill My Tables
A venue offers specific table inventory. The platform helps turn selected windows into predictable groups and gives the venue useful headcount and traffic information.

---

## Table Match

A Table Match is the central differentiator.

A viable match considers RPG system/edition, day/time, session duration, travel radius, venue availability/capacity, Player count, experience preference, format/cadence, table style, age/environment fit, accessibility, and venue policies.

### Matching order

1. **Hard fit first** — system, schedule, distance, venue availability, capacity, and other required constraints determine whether a table is viable.
2. **Table Fit second** — compatible preferences explain and rank viable opportunities.
3. **Reputation last and lightly** — verified reliability may break close ties or surface meaningful caution, but lack of platform history never lowers Table Fit.

Matching must be explainable. Do not present a mysterious compatibility percentage without showing the criteria behind it.

**A new Player or GM with zero Dinner, Dice & Dragons history is neutral, not low-reputation.** New users must remain eligible for excellent matches when their logistics and preferences fit.

Users do not swipe on people. They discover games, forming tables, and useful demand opportunities.

---

## Scheduling Principle

GM availability remains a strong supply anchor because a game cannot happen without someone able to run it, but the product is **not GM-only-first**.

Player demand and venue availability can independently reveal opportunities:

- Player-led: enough nearby Players want the same system/time → show demand to compatible GMs.
- GM-led: GM has availability → show compatible venue windows and Player demand.
- Venue-led: venue has table inventory → show compatible GM supply and local demand.

The matching engine should find the intersection rather than force every table through one rigid entry path.

---

## Table Lifecycle

### Potential Match
The system detects meaningful overlap but nobody has committed.

### Forming
A GM/game/venue combination exists and Players can commit or request seats.

### Confirmed
Venue approval and minimum Player commitment are satisfied. Calendar/reminders and Game Hub coordination become active.

### Played
Attendance is recorded. Structured feedback and venue traffic metrics can be generated.

### Repeating
Successful groups can schedule the next session with less friction.

---

## Primary Participants

### Players
Need to find nearby games that fit logistics, system, table culture, environment, and experience—not hunt through scattered social posts.

### Game Masters
Need to see where demand exists, find viable public venues, fill seats, communicate clearly, and build reliable repeat groups.

### Venues
Restaurants, breweries, cafes, game stores, libraries, and community spaces. Need to expose only the inventory they want filled and understand expected headcount, recurrence, actual visits, and group reliability.

### Moderators/Admins
Need private reporting, evidence-based moderation, and tools for severe or repeated behavior problems.

---

## Product Principles

1. **A successful real-world table is the primary outcome.**
2. **The platform coordinates Player demand, GM supply, and venue capacity.**
3. **Public venues first.** Private-home discovery is deferred.
4. **The game/forming table is the discovery object, not the person.**
5. **Matching must be explainable.**
6. **Distance is a user-controlled constraint.**
7. **Experience is system-specific and self-described.**
8. **Reputation is earned from verified platform activity and remains separate from self-description.**
9. **No history is neutral. New users are never penalized for being new.**
10. **Reputation reduces uncertainty; it does not determine who deserves a table.**
11. **Safety and table expectations are matching inputs, not afterthoughts.**
12. **Venues receive operational information, not unnecessary private Player data.**
13. **Players should browse before account creation.**
14. **Do not build generic social features unless they help a table form or happen.**
15. **Infrastructure follows the validated workflow; it does not define it.**

---

## Trust and Reputation Model

Avoid a simplistic public five-star popularity score. Reputation is an evidence layer built from verified interactions.

### Reputation states

- **New to DDD** — no or insufficient verified history. This is a neutral state.
- **Building History** — some completed platform activity, but not enough evidence for strong aggregate claims.
- **Established** — enough verified activity to show aggregate reliability signals.
- **Caution** — meaningful verified reliability problems may be shown when policy thresholds are met.
- **Restricted/Suspended** — moderation state; not a popularity score.

A user never starts below neutral merely because they are new.

### GM signals
- verified games hosted/completed
- completion reliability
- description accuracy
- boundaries respected
- would-play-again aggregate
- repeat Players

### Player signals
- verified sessions joined/attended
- attendance reliability
- late cancellations/no-shows
- structured table-respect feedback
- repeat tables

### Venue signals
- verified sessions hosted
- accessibility/environment information accuracy
- table suitability
- venue cancellations
- would-return aggregate

### Fair-start rules

- Table Match does not subtract points for missing reputation history.
- New users receive normal discovery eligibility and must not be sorted permanently beneath established users.
- Reputation can only be generated from eligible verified platform interactions.
- Individual negative feedback does not automatically create a public warning.
- Public aggregates require minimum sample thresholds.
- Moderation reports remain private and are evaluated separately from public reputation.
- Self-reported experience is labeled as such and never substituted for verified platform history.

---

## Game Hub

Once a table is confirmed, discovery should stop being the main interface. The Game Hub coordinates the session.

- Table announcements: GM/Venue/System → relevant participants
- Table discussion: GM + confirmed Players
- GM ↔ Venue: private operations
- Player → Venue: structured questions such as accessibility, food/allergies, parking, seating, or policy
- Headcount and schedule: shared according to role
- Venue analytics: expected vs actual visits and recurring traffic

The venue does not need access to private RPG discussion, Player home addresses, personal email addresses, or moderation records.

---

## Working Brand

**Dinner, Dice & Dragons**

> Dinner, Dice & Dragons turns local tabletop interest into actual game nights.

> Players tell us what they want to play. GMs tell us what they can run. Local venues tell us when they have tables. We find the overlap.

Brand remains welcoming to the broader TTRPG community even if Dungeons & Dragons is an initial demand driver.

---

## Pilot Hypothesis

In one local market, enough structured Player demand, GM availability, and willing venue capacity can be coordinated to create recurring in-person RPG sessions more reliably than unstructured social posts.

The pilot should test demand signals, potential Table Matches, forming/confirmed tables, sessions actually played, cancellations/no-shows, repeat groups, expected/actual venue visits, and willingness to repeat.

The pilot must also verify that new users can obtain matches at a reasonable rate compared with established users.

---

## Technology Direction

The production architecture is now established:

- **API / policy layer:** FastAPI.
- **Primary relational data:** PostgreSQL.
- **Authentication:** Supabase Auth.
- **Initial managed database target:** Supabase Postgres, while keeping the application schema portable PostgreSQL.
- **Runtime packaging:** Docker.
- **Authorization:** durable Dinner, Dice & Dragons database roles and relationships enforced server-side by FastAPI.

The validated static frontend remains useful as the UX and regression-test surface while production workflows are migrated incrementally to authenticated APIs.

Google Sheets and Apps Script are no longer the planned shared persistence architecture. Existing prototype or fallback code may remain temporarily only where a production workflow has not yet completed migration.

Infrastructure must continue to serve the product model rather than redefine it: Player demand + GM supply + Venue capacity must produce explainable, geographically viable Table Matches and move them through the real table lifecycle.

Nationwide participation and U.S.-wide architecture are requirements now. Florence is the first concentrated density pilot used to validate marketplace behavior before significant national marketing or expansion spend.
