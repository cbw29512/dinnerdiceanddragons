# Dinner, Dice & Dragons — Canonical Product Vision

> This document is the product north star. New features, UI changes, data-model changes, and roadmap decisions must be checked against it before implementation.

## Core Product Thesis

Dinner, Dice & Dragons is not primarily a social network, generic event directory, or paid-GM marketplace.

It is a **local tabletop table-formation platform** that turns three kinds of supply and demand into complete, recurring in-person RPG tables:

1. **Players who want to play**
2. **GMs who want to run games**
3. **Venues that have tables / capacity to host**

The platform's job is to turn incomplete demand into a complete table.

## Product Mental Model

The central product object is the **Table**.

Example:

> Saturday, 6:00 PM — Seminar Brewing — D&D 5e — 6 seats — GM confirmed — 4 players interested — 2 seats needed.

The system should continuously help that table become complete.

## Core Promise

**Let's Build a Table.**

Dinner, Dice & Dragons should specialize in turning:

- local player demand
- GM availability
- venue capacity
- compatible schedules

into:

- confirmed one-shots
- campaigns
- recurring tabletop communities

## Three-Sided Marketplace

### Player

A player can declare demand even when no event exists yet.

Player intent includes:

- location / travel radius
- availability
- RPG system
- experience level
- campaign vs one-shot preference
- age/accessibility preferences where applicable
- free vs paid preference

The player should be able to say:

> I want to play.

### GM

A GM can declare supply without having to bring a complete player group or venue.

GM intent includes:

- availability
- game systems
- preferred party size
- experience / beginner friendliness
- one-shot or campaign
- free or paid table
- venue needed or already selected

The GM should be able to say:

> I want to run a game.

### Venue

A venue can publish unused or gaming-friendly capacity without having to organize the RPG itself.

Venue intent includes:

- available tables
- capacity
- allowed dates/times
- accessibility
- food/drink availability
- reservation requirements
- discounts/promotions
- recurring slow-night availability

The venue should be able to say:

> I have a table.

## Table Formation Engine

The core matching flow is deterministic first, smarter later.

Initial matching criteria:

1. Compatible geographic radius
2. Compatible date / time
3. Compatible RPG system
4. GM available
5. Enough compatible player demand
6. Venue capacity available
7. Price / age / accessibility constraints compatible
8. Produce a potential table

The system should explicitly surface partially formed tables:

- Needs Players
- Needs a GM
- Needs a Venue
- Almost Ready
- Ready to Confirm
- Confirmed

## Homepage Principle

The homepage should not behave like a static event listing.

It should show **live formation activity**.

Examples:

### Almost Ready

- GM confirmed
- venue confirmed
- 4/6 players
- 2 players needed

### Needs a GM

- 5 interested players
- compatible schedule
- RPG system selected
- venue available or still needed

### Needs a Venue

- GM confirmed
- players confirmed
- date/time window available

The homepage should communicate momentum and opportunity.

## Scheduling and Availability

Calendar and availability are first-class product capabilities.

Each player, GM, and venue may maintain recurring and date-specific availability.

The system should answer questions such as:

> What is the next date when the GM, enough players, and a compatible venue are all available?

This solves a recurring tabletop problem: coordinating the next session.

Recurring campaigns should be able to reuse prior availability and suggest next sessions automatically.

## Waitlists and Seat Recovery

Cancelled seats should become opportunities, not dead capacity.

Flow:

1. Player cancels
2. Seat becomes open
3. Compatible waitlist candidates are identified
4. Candidates are notified
5. First accepted / prioritized eligible candidate fills the seat
6. GM and venue receive updated attendance

## Persistent Campaign Communities

A successful table can become a campaign.

A campaign should support:

- recurring schedule
- player roster
- attendance history
- private campaign communication
- announcements
- venue coordination
- session history
- linked characters
- future session scheduling

The goal is retention through continued play, not endless rediscovery.

## Communication Model

Do not attempt to recreate Discord.

Communication should remain table-focused and structured.

Communication surfaces:

- Table Chat — players + GM
- Venue Coordination — GM + venue
- Announcements — GM to table
- Private GM Messages — player ↔ GM
- System Notices — confirmations, cancellations, waitlist fills, schedule updates

## Reliability Reputation

Attendance and follow-through matter more than generic stars alone.

### Player reputation may include

- sessions attended
- attendance percentage
- late cancellations / no-shows
- campaigns completed
- number of GMs played with

### GM reputation may include

- sessions completed
- cancellation rate
- player return rate
- players hosted
- beginner-friendly designation
- ratings/reviews

### Venue reputation may include

- events hosted
- reservation reliability
- accessibility details
- gaming suitability
- food/drink availability

Reputation must avoid punitive or discriminatory design and should use transparent rules.

## Venue Value Proposition

Venues are not side listings. They are a core marketplace participant.

Venue benefits:

- fill slow nights
- predictable group size
- repeat customers
- reservation coordination
- local promotion
- tabletop-specific event traffic

Longer-term venue analytics may include:

- gaming events hosted
- attendee visits
- unique vs returning attendees
- average group size
- attributed promotions / coupon usage
- estimated or measured event-driven revenue

The platform should eventually be able to show tangible venue ROI.

## Empty-Night Marketplace

Venues may publish slow-night table capacity.

Example:

> Tuesday 6–10 PM — 4 gaming tables available — food discount offered.

Dinner, Dice & Dragons can then match compatible GMs and players into that capacity.

This transforms unused venue capacity into tabletop events.

## Beginner Funnel

New players must not need prior knowledge to participate.

Primary beginner path:

1. Choose location
2. Choose availability
3. Choose interests / preferred game type
4. Join a beginner-friendly table
5. Generate or receive a legal character if needed
6. Show up and play

A prominent entry point should be:

> I've Never Played Before

## Character Forge Integration

When a game requires a character, the player should be able to create one directly from the table.

The Forge should receive table constraints such as:

- system
- edition
- level
- allowed source mode
- campaign restrictions
- GM-specific legal constraints

The generated character then links back to the player's seat/table.

## DNDCards Integration

Dinner, Dice & Dragons finds and organizes the table.

Character Forge creates legal characters.

DNDCards helps run the adventure.

Ecosystem flow:

Dinner, Dice & Dragons
→ forms the table
→ Character Forge creates characters
→ DNDCards supports running the session

These products should reinforce one another without making any single one mandatory for basic participation.

## Local SEO Strategy

The platform should support indexable local discovery pages such as:

- /dnd/florence-sc
- /pathfinder/florence-sc
- /call-of-cthulhu/florence-sc
- /dnd/charleston-sc
- /dnd/myrtle-beach-sc
- /dnd/columbia-sc

Useful SEO landing concepts:

- Dungeons & Dragons Games in Florence, SC
- Beginner D&D Games Near Florence
- Places to Play D&D in Florence
- Dungeon Masters in Florence

SEO pages should reflect real platform inventory/demand rather than thin duplicate pages.

## Geographic Rollout

Do not launch as a thin nationwide marketplace.

Initial validation market: **Florence, South Carolina**.

Suggested expansion sequence after product-market proof:

1. Florence
2. Myrtle Beach
3. Columbia
4. Charleston
5. Charlotte / nearby regional markets

Dense local liquidity is more valuable than many disconnected users across the country.

## Monetization Principles

Do not require the V1 product to monetize every participant.

Potential future monetization:

### Players

- free discovery and participation
- optional premium conveniences later

### GMs

- free community tables
- possible transaction fee on paid games
- optional premium tools later

### Venues

- free partner listing / participation
- optional premium analytics or promotion tools later

### Platform / ecosystem

- paid event ticketing fee
- digital adventures
- DNDCards content
- Character Forge premium capabilities
- creator/publisher marketplace later

Revenue must not interfere with table formation during the early liquidity-building phase.

## MVP Scope

The MVP should prove that complete real-world tables can be formed.

### Player MVP

- profile
- location / radius
- availability
- game preferences
- express demand
- discover tables
- request / claim seat
- RSVP

### GM MVP

- profile
- availability
- create table/game intent
- set system / capacity / schedule
- manage players
- manage seats

### Venue MVP

- profile / claim venue
- publish available capacity
- approve / confirm table requests
- basic upcoming-event view

### Platform/Admin MVP

- approve/moderate listings where necessary
- manage reports
- inspect formation state
- resolve basic disputes / data issues

### MVP explicitly does NOT require

- full social network
- full Discord replacement
- advanced AI matching
- publisher marketplace
- complex loyalty system
- deep analytics
- nationwide launch
- every DNDCards / Forge capability

## Canonical Table States

The product should model the table lifecycle explicitly.

Suggested state flow:

1. Draft
2. Forming
3. Needs GM
4. Needs Players
5. Needs Venue
6. Almost Ready
7. Ready to Confirm
8. Confirmed
9. In Progress
10. Completed
11. Cancelled

A single table may simultaneously need more than one resource during formation; implementation should represent requirements rather than relying only on one mutually exclusive status field.

## Anti-Drift Rules

The following are non-negotiable unless this document is intentionally revised:

1. **The Table is the central product object.**
2. **Players, GMs, and Venues are equal marketplace participants.**
3. **A GM is not required to initiate a table.**
4. **Player demand can exist before an event exists.**
5. **Venue capacity can exist before an event exists.**
6. **The platform must help incomplete tables become complete.**
7. **Availability/calendar data is core, not an add-on.**
8. **Local density comes before nationwide breadth.**
9. **Do not rebuild Discord, D&D Beyond, or StartPlaying wholesale.**
10. **Beginner participation must remain extremely simple.**
11. **The venue must receive measurable business value.**
12. **A completed table should naturally be able to become a recurring campaign.**
13. **DNDCards and Character Forge are integrations/ecosystem accelerators, not prerequisites for basic use.**
14. **Accessibility and local SEO remain product requirements.**
15. **Every major new feature should answer: does this help form, fill, run, retain, or prove the value of a table?**

## Product Decision Test

Before accepting a major feature, ask:

1. Does it help a table form?
2. Does it help fill missing players, GM, or venue capacity?
3. Does it reduce scheduling friction?
4. Does it increase attendance/reliability?
5. Does it help a one-shot become a recurring community?
6. Does it prove value to a venue?
7. Does it simplify the beginner experience?
8. Does it create defensibility without bloating the MVP?

If the answer is no across the board, the feature probably does not belong in the core product.

## North-Star Metric

The most important early metric should not be registrations or page views.

It should be something close to:

> **Completed tabletop sessions successfully formed through Dinner, Dice & Dragons.**

Supporting metrics:

- tables formed
- formation completion rate
- time to complete a table
- seat fill rate
- attendance rate
- repeat-table rate
- campaign conversion rate
- venue repeat-host rate

## Product Tagline / Internal Guiding Phrase

**Dinner, Dice & Dragons — Let's Build a Table.**
