# Dinner, Dice & Dragons

## Project Purpose

Dinner, Dice & Dragons is a local tabletop RPG community platform designed to connect players, Game Masters, games, and public partner venues.

The central product idea is simple:

> Help people find a table, not just a game.

The platform should make it easy for someone to discover an RPG event that fits how they like to play, reserve a seat, meet safely at a public venue, play, and decide whether they want to play with that table again.

---

## Core Product Loop

**Discover -> Match -> Meet -> Play -> Review -> Play Again**

The Event/Table is the center of the system.

Users do not swipe on people. They discover and react to games/events.

---

## Primary Participants

### Players
Need a simple way to find local games and compatible tables.

### Game Masters
Need players, reliable venues, scheduling tools, reputation signals, and repeat-group support.

### Venues
Restaurants, breweries, cafes, game stores, libraries, and community spaces need a way to attract recurring tabletop groups and fill tables, especially during slower periods.

### Moderators/Admins
Need tools to handle reports, safety issues, abuse patterns, and platform quality.

---

## Working Brand

**Dinner, Dice & Dragons**

Candidate taglines:

- Find your table. Meet your party. Roll for adventure.
- Come for dinner. Stay for the adventure.
- I went to dinner and a roleplaying game broke out.

Brand should remain welcoming to the broader tabletop RPG community, even if Dungeons & Dragons is the initial launch focus.

---

## Product Principles

1. **The game is the discovery object, not the person.**
2. **Public venues first.** Initial launch should strongly favor restaurants, breweries, cafes, libraries, game stores, and community spaces.
3. **Trust is evidence-based.** Avoid simplistic public star ratings where possible.
4. **Safety is a core feature, not an add-on.**
5. **Compatibility should focus on play style and logistics.**
6. **Players should be able to browse before creating an account.**
7. **A successful real-world table is more valuable than a vanity metric.**
8. **The internal data model should support multiple RPG systems from the start.**

---

## Discovery Experience

Users should eventually be able to discover games in three primary ways:

### Discover
Swipe-style or card-style recommendation interface.

- Interested
- Pass
- View Table

The user reacts to the event, not the host or players.

### Map
See nearby upcoming games and partner venues.

### Calendar
Traditional date-based event browsing and filtering.

---

## Example Game Card

A game card should be able to communicate:

- Game title
- RPG system and edition
- One-shot, campaign, learn-to-play, organized play, etc.
- Date and time
- Venue
- Seats remaining
- Beginner friendliness
- Accessibility indicators
- Roleplay / combat / puzzle emphasis
- DM trust/reliability signals
- Table expectations

---

## Joining Models

Game Masters should be able to choose between:

### Open Table
Player joins immediately if a seat is available.

### Request to Join
Player requests a seat and the GM approves or declines.

This supports both open community nights and longer-running campaigns.

---

## Table Expectations / Table Culture

Every event should include a clear expectations card before a player joins.

Possible fields:

- Tone
- Age guidance
- RPG system / edition
- Character level
- Roleplay emphasis
- Combat emphasis
- Puzzle emphasis
- PvP allowed or not
- Homebrew policy
- Character death expectations
- Mature-content indicator
- Alcohol served at venue
- New-player friendliness
- Session duration
- Break expectations
- Any selected safety/boundary framework

A player should explicitly acknowledge that they reviewed the table expectations before joining.

---

## Trust, Safety, and Reputation

The platform should avoid reducing people to a single public score.

### Game Master Signals
Possible public signals:

- Games hosted
- Player seats hosted
- Would-play-again percentage
- Reliability
- Communication
- Accuracy of event description
- Beginner-friendly recognition
- Verified host/venue relationships

### Player Signals
Keep public player reputation objective and limited.

Possible public signals:

- Games attended
- Attendance rate
- Reliable Adventurer badge
- Community Regular badge
- Positive table history

Private complaints and moderation data should not be exposed publicly.

### Structured Post-Game Feedback
Possible questions:

- Did the game match its description?
- Did the game begin reasonably on time?
- Were established table boundaries respected?
- Was the table respectful?
- Would you play with this GM/table again?

### Reporting
A report should create a moderation case, not an automatic public punishment.

Potential report categories:

- Harassment
- Discrimination
- Threats
- Unwanted sexual behavior
- Theft
- Severe disruptive behavior
- Intoxication-related disruption
- Repeated no-show
- Table-boundary violation
- Other

Repeated independent reports may create internal risk signals for moderators.

---

## Attendance and No-Show Protection

Attendance matters because no-shows hurt GMs, players, and venues.

After a game:

- GM or authorized host marks attendance.
- Attendance contributes to reliability signals.
- Chronic no-shows may lose instant-join privileges and be limited to request-to-join until reliability improves.

The system should avoid public shaming.

---

## Venue Experience

Partner venues should eventually have profiles and dashboards.

Possible venue attributes:

- Available gaming nights
- Table count
- Maximum group sizes
- Food/drink requirements
- Accessibility information
- Parking
- Noise level
- Lighting
- Wi-Fi
- Power outlets
- Outside-material policy
- Alcohol served

Possible venue dashboard metrics:

- Games hosted
- Confirmed player visits
- Actual attendance
- Average session length
- Optional event-night revenue data if the venue chooses to provide it

---

## Venue Offers

Venues may eventually attach tabletop-specific offers to events, such as:

- Adventurer Special
- Party meal bundles
- GM perks
- Recurring tabletop-night promotions

The business value proposition is not merely allowing gamers to occupy tables. The platform should help venues monetize recurring tabletop traffic.

---

## Event Creation Wizard

A GM should create a game through a guided flow rather than a giant form.

Suggested steps:

1. Select RPG system.
2. Select event type.
3. Describe the table and play style.
4. Select venue.
5. Select date/time/duration.
6. Select seat count.
7. Choose Open Table or Request to Join.
8. Configure Table Expectations.
9. Review and publish.

Published games should appear in Discover, Map, Calendar, and their own SEO-friendly event page.

---

## Groups / Parties

After a successful game, the system should encourage repeat play.

A group/party may have:

- Name
- Members
- GM(s)
- Previous games
- Next scheduled session

A GM should eventually be able to select **Schedule Next Session** from an existing party.

---

## Multi-System Support

Do not make the database D&D-only.

Possible systems include:

- Dungeons & Dragons 5e (2014)
- Dungeons & Dragons 5e (2024)
- Pathfinder 2e
- Call of Cthulhu
- Cyberpunk RED
- Shadowrun
- Other tabletop RPGs

The brand can launch around D&D while the product architecture remains system-neutral.

---

## Initial MVP Definition of Done

Version 1 should support the complete real-world loop:

> A person can discover an appropriate local RPG table, reserve or request a seat, understand the table expectations, show up safely at a participating public venue, play, have attendance recorded, and provide structured post-game feedback.

### MVP Capabilities

- Accounts
- Player profiles
- GM profiles
- Venue profiles
- Create game
- Game detail page
- Discover/card interface
- Search/filter
- Map view
- Calendar view
- Join/request seat
- Table Expectations
- Attendance tracking
- Structured post-game feedback
- Reporting/moderation workflow
- Basic notifications
- SEO-friendly game, venue, and location pages
- Accessibility-conscious UI and keyboard operation
- Admin/moderator console

### Explicitly Not MVP

- Native mobile apps
- Payment processing
- Marketplace
- Complex achievements
- AI-based matching
- Restaurant POS integrations
- DNDCards integration
- Private-home games

These may be added after product-market validation.

---

## North-Star Metric

**Successful Tables Played**

The key metric is completed real-world RPG sessions, not registrations, swipes, or page views.

Supporting metrics may include:

- Completed games per month
- Seats filled
- Attendance rate
- Repeat-table rate
- Number of active GMs
- Number of active partner venues
- Player return rate

---

## Launch Strategy

Do not launch nationally with an empty map.

Start with one local market and prove density.

Initial target concept:

- 3-5 venues
- ~10 active GMs
- 50-100 players
- Track completed games and repeat participation

Once the model works in one city, document the playbook and replicate it elsewhere.

---

## Technical Direction

### Phase 1: GitHub-hosted prototype

Use GitHub as the project source of truth and GitHub Pages for a low-cost public prototype.

The prototype may use static HTML/CSS/JavaScript or another static-site approach so it can deploy cleanly to GitHub Pages.

Focus on demonstrating the user journey with realistic sample data:

- Homepage
- Find a Game
- Discover
- Game Details
- GM Profiles
- Venue Profiles
- Table Expectations

### Phase 2: Real application

When the concept is validated, add the application backend.

Planned direction:

- FastAPI backend
- PostgreSQL database
- Docker-based deployment
- Authentication
- Real event creation
- Reservations / join requests
- Ratings and trust system
- Moderation

Frontend architecture should remain replaceable enough that the GitHub Pages prototype does not force the long-term application into a bad design.

---

## SEO Direction

Public pages should use clean, indexable URLs where practical.

Examples:

- `/games/<game-slug>`
- `/venues/<venue-slug>`
- `/rpg/florence-sc`
- `/dnd/florence-sc`

SEO content should focus on actual local search intent such as finding tabletop RPG games, D&D groups, Pathfinder games, learn-to-play nights, and gaming venues.

---

## Accessibility Direction

Accessibility is a release requirement rather than a later cleanup task.

Design should target current WCAG good practices including:

- Semantic structure
- Keyboard navigation
- Visible focus states
- Sufficient contrast
- Text alternatives where needed
- Accessible form labels and error messaging
- Reduced-motion considerations
- No critical interactions that require swiping or pointer input

The swipe-style Discover interface must always have equivalent buttons and keyboard controls.

---

## Business Model Ideas — Later Validation

Potential future revenue streams:

- Premium venue tools
- Venue analytics
- Featured venues
- Promoted events
- Ticketed-event transaction fees
- Premium GM tools
- Marketplace
- DNDCards integration
- Physical tabletop products
- Merchandise
- B2B convention/event tools

Do not optimize for monetization before local table density exists.

---

## Open Decisions

These are intentionally not locked yet:

- Final trademark-safe brand name
- Final logo / visual identity
- Exact frontend framework for the production app
- Authentication provider
- Mapping provider
- Notification channels
- Verification model
- Exact moderation thresholds
- Monetization model
- Final launch venue partners

---

## Project Management Rule

This file is the living product charter and source of truth for the project vision.

When a major product decision changes:

1. Update this file.
2. Record the decision in `docs/DECISIONS.md` once that file exists.
3. Update the roadmap or Definition of Done if scope changes.
4. Create GitHub issues for actionable implementation work.

The goal is to prevent important product decisions from being lost in chat, scattered notes, or code comments.

---

## Current Status

**Stage:** Product definition / pre-development

**Current priority:** Lock Definition of Done, initial Data Schema, trust/safety requirements, and GitHub Pages prototype scope before production coding begins.
