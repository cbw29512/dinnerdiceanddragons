# Dinner, Dice & Dragons

## Project Purpose

Dinner, Dice & Dragons is a local tabletop RPG community platform designed to connect Players, Game Masters, games, and public partner venues.

The central product idea is simple:

> Help a willing Game Master turn their available time into a real local game at a willing public venue, then help compatible players find and join it.

The platform should reduce the three problems that stop local RPG games from happening: finding a GM, finding an appropriate place, and finding reliable players.

---

## Scheduling Principle — GM Availability First

The Game Master runs the game, so the scheduling chain begins with the GM.

**GM availability -> compatible venue window -> confirmed game -> player discovery -> play -> feedback -> repeat**

A Player's availability matters only after there is a viable GM + venue slot to join.

A venue should not receive vague requests to "host D&D." It publishes specific table windows it is willing to offer, such as:

- Tuesday 6-10 PM
- Two tables
- Up to 6 guests per table
- One food or drink purchase per guest
- Venue approval required

The matching engine should compare the GM's availability, travel radius, and table requirements against those venue windows. Once the GM selects or receives approval for a venue window, the resulting event becomes discoverable to Players whose own location, availability, and preferences fit.

---

## Core Product Loop

**GM Available -> Venue Match -> Game Published -> Players Match -> Meet -> Play -> Review -> Play Again**

The Event/Table is still the central public discovery object, but the Event is created from the intersection of a GM and a venue slot.

Users do not swipe on people. They discover and react to games/events.

---

## Primary Participants

### Game Masters
The supply anchor for a game. Need a fast way to declare availability, find willing nearby venues, publish a clear game, fill seats, and build repeat groups.

### Venues
Restaurants, breweries, cafes, game stores, libraries, and community spaces. Need a low-risk way to expose only the table windows they actually want filled, while retaining control over capacity and customer-spending policies.

### Players
Need a simple way to find already-viable local games that match their travel radius, schedule, system preferences, and table style.

### Moderators/Admins
Need tools to handle reports, safety issues, abuse patterns, and platform quality.

---

## Working Brand

**Dinner, Dice & Dragons**

Candidate taglines:

- Players + Game Masters + local venues = game night.
- Find your table. Meet your party. Roll for adventure.
- Come for dinner. Stay for the adventure.
- I went to dinner and a roleplaying game broke out.

Brand should remain welcoming to the broader tabletop RPG community, even if Dungeons & Dragons is the initial launch focus.

---

## Product Principles

1. **GM availability is the scheduling anchor.**
2. **A venue offers specific table windows, not an open-ended promise to host RPGs.**
3. **The game is the discovery object, not the person.**
4. **Public venues first.**
5. **Trust is evidence-based.** Avoid simplistic public star ratings where possible.
6. **Safety is a core feature, not an add-on.**
7. **Compatibility should focus on play style and logistics.**
8. **Players should be able to browse before creating an account.**
9. **A successful real-world table is more valuable than a vanity metric.**
10. **The internal data model should support multiple RPG systems from the start.**

---

## Role Templates

### GM Profile — reusable

A GM fills this out once and updates it when needed:

- Display name
- Systems run
- GM experience
- Typical table style
- Players welcomed
- Home ZIP/private location anchor
- Travel radius
- **Availability windows**
- Table standards
- Trust/reliability signals

The most important operational field is availability. The UI should lead with "When can you run?" before asking the GM to find a venue.

### Venue Profile — reusable

- Business/public venue identity
- Verified address
- Contact
- Accessibility
- Age/alcohol notes
- Menu link
- General GM instructions

### Venue Table Window — repeatable

A venue may publish one or more windows:

- Day/date
- Start time
- End time
- Recurrence (one-time, weekly, every other week, monthly)
- Number of tables
- Maximum guests per table
- Purchase/minimum-spend policy
- Approval mode
- Special operating instructions

### Player Profile — reusable

- Display name
- Systems wanted
- Experience level
- Preferred table style
- Home ZIP/private location anchor
- Travel radius
- Availability
- Optional accessibility/content preferences

### Game Listing — specific

Created only after a GM has a workable venue/time combination:

- GM
- Venue + confirmed table window
- RPG system/edition
- Adventure/title
- One-shot/campaign/learn-to-play/etc.
- Character level or character rules
- Date/time/duration
- Seat count
- Joining method
- Table Expectations
- Player experience requirements

---

## Restaurant / Venue Acquisition Model

The initial pitch should be operational and low-risk:

> "Give us one table on one slower night for four weeks. You set the hours, group size, and purchase policy. The Game Master runs the event. If it brings good customers, keep offering the slot. If it does not, stop."

### What the venue controls

- Which days/times are offered
- Number of tables
- Group size
- Spending/minimum-purchase policy
- Whether every GM booking requires venue approval
- Age/alcohol constraints
- Operational instructions

### What Dinner, Dice & Dragons handles

- Makes the venue discoverable to nearby eligible GMs
- Matches GM availability to offered table windows
- Shows the venue's rules before a GM requests the slot
- Creates a clear event record once the venue/time is selected
- Helps eligible nearby Players discover the resulting game
- Tracks attendance and repeat-table activity over time

### What the GM owns

- Running the actual RPG
- Player communication and table expectations
- Being the point of contact for the gaming group
- Arriving and ending on time
- Following venue policies

### Initial venue pilot target

Start with a deliberately small ask:

- 1 slower weekly window
- 1-2 tables
- 4-8 people per table
- 4-week trial
- Venue approval for every booking initially
- No fee to the venue during validation

The pilot should track:

- Confirmed seats
- Actual attendance
- Repeat groups
- Cancellations/no-shows
- Optional venue-reported average spend or qualitative sales feedback
- Whether the venue wants to continue after four weeks

---

## Discovery Experience

Players should eventually discover confirmed games in three primary ways:

### Discover
Card-style or swipe-style recommendations.

- Interested
- Pass
- View Table

The Player reacts to the event, not the host or other Players.

### Map
See nearby confirmed games and participating venues.

### Calendar
Traditional date-based event browsing and filtering.

---

## Example Game Card

A game card should communicate:

- Game title
- RPG system and edition
- One-shot, campaign, learn-to-play, organized play, etc.
- Date and time
- Venue
- Approximate distance
- Seats remaining
- Beginner friendliness
- Accessibility indicators
- Roleplay / combat / puzzle emphasis
- GM trust/reliability signals
- Table expectations

---

## Joining Models

Game Masters should be able to choose between:

### Open Table
Player joins immediately if a seat is available.

### Request to Join
Player requests a seat and the GM approves or declines.

---

## Table Expectations / Table Culture

Every event should include a clear expectations card before a Player joins.

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

A Player should explicitly acknowledge that they reviewed the table expectations before joining.

---

## Trust, Safety, and Reputation

Avoid reducing people to a single public score.

### Game Master Signals

- Games hosted
- Player seats hosted
- Would-play-again percentage
- Reliability
- Communication
- Accuracy of event description
- Beginner-friendly recognition
- Verified venue relationships

### Player Signals

- Games attended
- Attendance rate
- Reliable Adventurer badge
- Community Regular badge
- Positive table history

Private complaints and moderation data should not be exposed publicly.

### Structured Post-Game Feedback

- Did the game match its description?
- Did it begin reasonably on time?
- Were established boundaries respected?
- Was the table respectful?
- Would you play with this GM/table again?

### Reporting

A report creates a moderation case, not an automatic public punishment.

Potential categories include harassment, discrimination, threats, unwanted sexual behavior, theft, severe disruptive behavior, intoxication-related disruption, repeated no-show, table-boundary violation, and other.

---

## Attendance and No-Show Protection

Attendance matters because no-shows hurt GMs, Players, and venues.

After a game:

- GM or authorized host marks attendance.
- Attendance contributes to reliability signals.
- Chronic no-shows may lose instant-join privileges.
- Venue-impacting cancellations should also be tracked.

The system should avoid public shaming.

---

## Venue Experience

Partner venues should eventually have profiles and dashboards showing:

- Active table windows
- Table count/capacity
- Food/drink requirements
- Accessibility information
- Parking
- Noise level
- Lighting
- Wi-Fi/power if relevant
- Alcohol served
- Games hosted
- Confirmed Player visits
- Actual attendance
- Repeat groups
- Optional event-night revenue feedback

---

## Event Creation Wizard

The GM wizard should follow the actual scheduling dependency:

1. Confirm/select GM availability window.
2. Find nearby venue windows that overlap.
3. Select/request a venue window.
4. Select RPG system and event type.
5. Describe the game and table style.
6. Select seat count.
7. Choose Open Table or Request to Join.
8. Configure Table Expectations.
9. Review and publish.

Published games appear in Discover, Map, Calendar, and their own SEO-friendly event page.

---

## Groups / Parties

After a successful game, encourage repeat play. A party may retain members, GM(s), previous games, and a next session. Scheduling the next session should again begin with GM availability and matching venue availability.

---

## Multi-System Support

Do not make the database D&D-only. Support D&D 5e (2014/2024), Pathfinder 2e, Call of Cthulhu, Cyberpunk RED, Shadowrun, and other RPGs.

---

## Initial MVP Definition of Done

Version 1 should support the complete real-world loop:

> A GM can declare availability, find/request a willing nearby venue window, publish an RPG table, and compatible nearby Players can discover it, reserve/request seats, understand expectations, attend safely, and provide structured feedback.

### MVP Capabilities

- Accounts
- Player profiles
- GM profiles with availability
- Venue profiles
- Venue table windows
- GM/venue availability matching
- Create game
- Game detail page
- Discover/search/filter
- Map view
- Calendar view
- Join/request seat
- Table Expectations
- Attendance tracking
- Structured post-game feedback
- Reporting/moderation workflow
- Basic notifications
- SEO-friendly pages
- Accessibility-conscious UI
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

---

## North-Star Metric

**Successful Tables Played**

Supporting metrics include active GMs, active venue windows, GM-to-venue match rate, published games, seats filled, attendance rate, repeat-table rate, active partner venues, and Player return rate.

---

## Launch Strategy

Do not launch nationally with an empty map. Start in one market and prove density.

Initial target concept:

- 3-5 pilot venues
- ~10 active GMs with usable availability
- 50-100 Players
- Track GM/venue matches, completed games, attendance, and venue continuation rate

Once the model works in one city, document the playbook and replicate it.

---

## Technical Direction

### Phase 1: GitHub-hosted prototype

GitHub is the project source of truth and GitHub Pages hosts the public prototype. Static HTML/CSS/JavaScript is acceptable while validating the user journey.

### Phase 2: Real application

Planned direction:

- FastAPI backend
- PostgreSQL database
- Docker-based deployment
- Authentication
- Availability matching
- Real event creation
- Reservations / join requests
- Trust/reputation
- Moderation

---

## SEO Direction

Public pages should use clean, indexable URLs such as `/games/<game-slug>`, `/venues/<venue-slug>`, `/rpg/florence-sc`, and `/dnd/florence-sc`.

---

## Accessibility Direction

Accessibility is a release requirement: semantic structure, keyboard navigation, visible focus, sufficient contrast, accessible labels/errors, reduced-motion support, and no critical swipe-only interactions.

---

## Business Model Ideas — Later Validation

Potential future revenue streams include premium venue tools/analytics, featured venues, promoted events, ticket fees, premium GM tools, marketplace, DNDCards integration, merchandise, and B2B event tools. Do not optimize monetization before local table density exists.

---

## Open Decisions

- Final trademark-safe brand name
- Final visual identity
- Exact production frontend framework
- Authentication provider
- Mapping/geocoding provider
- Notification channels
- Venue/GM verification model
- Exact moderation thresholds
- Monetization model
- Final launch partners

---

## Project Management Rule

This file is the living product charter. When a major decision changes: update this file, record the decision in `docs/DECISIONS.md`, update the roadmap/Definition of Done, and create GitHub issues for actionable work.

---

## Current Status

**Stage:** GitHub Pages validation prototype

**Current priority:** Make the prototype demonstrate the real dependency chain: GM availability -> venue window -> game creation -> Player discovery.
