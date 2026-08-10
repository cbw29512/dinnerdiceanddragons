# Dinner, Dice & Dragons

## Project Purpose

Dinner, Dice & Dragons turns **local tabletop RPG interest into actual game nights**.

The product coordinates three independent signals:

- **Players** — what they want to play, when they can attend, how far they will travel, and what table fits them.
- **Game Masters** — what they can run, when they can run it, how far they will travel, and what kind of table they host.
- **Venues** — when they want groups, how much capacity they have, and what business/environment rules apply.

The platform finds the overlap and helps move it through a real-world lifecycle:

**Demand signals → Table Match → Forming → Confirmed → Game Hub → Played → Trust + repeat**

The primary success metric is not signups, posts, or swipes. It is **successful in-person tabletop sessions**.

---

## Core Product Actions

### 🎲 Find My Table
A Player creates a structured demand signal. The platform should surface confirmed games and forming tables that fit, and eventually surface aggregate Player demand to suitable GMs without exposing private Player data.

### 🧙 Form a Table
A GM creates a supply signal. The platform compares the GM's availability and game systems with nearby Player demand and willing venue capacity.

### 🍽️ Fill My Tables
A venue offers specific table inventory. The platform helps turn selected windows into predictable groups and gives the venue useful headcount and traffic information.

---

## Table Match

A Table Match is the central differentiator.

A viable match considers:

- RPG system / edition
- day and time
- session duration
- travel radius / distance
- venue availability
- venue capacity
- minimum and maximum Players
- Player experience preference
- game format and cadence
- table/play style
- age/environment fit
- accessibility and seating needs
- venue policies

Matching must be explainable. Do not present a mysterious compatibility percentage without showing the criteria behind it.

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
8. **Reputation is earned from completed platform activity and remains separate from self-description.**
9. **Safety and table expectations are matching inputs, not afterthoughts.**
10. **Venues receive operational information, not unnecessary private Player data.**
11. **Players should browse before account creation.**
12. **Do not build generic social features unless they help a table form or happen.**
13. **Infrastructure follows the validated workflow; it does not define it.**

---

## Trust Model

Avoid a simplistic public five-star popularity score as the primary trust signal.

Useful structured signals include:

### GM
- games hosted
- completed as scheduled
- description accuracy
- boundaries respected
- would-play-again aggregate

### Player
- sessions joined
- attendance rate
- late cancellations / no-shows
- structured table-respect feedback

### Venue
- sessions hosted
- accessibility/environment information accuracy
- table suitability
- would-return aggregate

Moderation reports remain private and are not automatic public penalties.

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

Primary product statement:

> Dinner, Dice & Dragons turns local tabletop interest into actual game nights.

Supporting explanation:

> Players tell us what they want to play. GMs tell us what they can run. Local venues tell us when they have tables. We find the overlap.

Brand remains welcoming to the broader TTRPG community even if Dungeons & Dragons is an initial demand driver.

---

## Pilot Hypothesis

In one local market, enough structured Player demand, GM availability, and willing venue capacity can be coordinated to create recurring in-person RPG sessions more reliably than unstructured social posts.

The pilot should test:

- number of useful demand signals
- potential Table Matches detected
- forming tables created
- confirmed tables
- sessions actually played
- cancellation/no-show rate
- repeat sessions/groups
- expected vs actual venue visits
- participant and venue willingness to repeat

---

## Technology Direction

GitHub Pages remains the validation surface.

Google Sheets + Apps Script may be used only as a controlled pilot persistence layer if useful. It is not a permanent architectural commitment.

If the workflow is validated, the production architecture can move to an authenticated application backed by a proper relational database. Current long-term direction remains compatible with FastAPI + PostgreSQL + Docker, but the product workflow should be proven before infrastructure is locked.
