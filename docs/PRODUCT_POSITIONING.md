# Dinner, Dice & Dragons — Product Positioning

## Core promise

> Dinner, Dice & Dragons turns tabletop RPG interest across the United States into actual local game nights.

The platform is not primarily a social network, chat app, general event calendar, or paid GM marketplace. Its core job is to form viable local in-person RPG tables by coordinating Player demand, Game Master supply, and public Venue capacity.

## Product scope

Dinner, Dice & Dragons is a United States-wide tabletop RPG marketplace. Players, Game Masters, and Venues may participate anywhere in the U.S., while each in-person Table Match remains geographically local to the people and Venue involved.

**Operating rule:** nationwide platform, local Table Matches.

Florence, South Carolina is the first concentrated density pilot. It is not a product boundary.

## Three entry points

### Player — Find My Table
Players provide:
- systems/editions they want to play
- availability
- system-specific experience
- game format preferences
- table preferences
- ZIP/location and travel radius

The platform should show compatible nearby games and aggregate unmet Player demand that can attract compatible GMs and reveal where new tables could form.

### Game Master — Form a Table
GMs provide:
- systems/editions they can run
- system-specific GM experience
- availability
- preferred game formats
- table style/expectations
- ZIP/location and travel radius

The platform should show:
- compatible venue windows
- nearby Player demand by system/time
- expected likelihood that a table can form

### Venue — Fill My Tables
Venues provide:
- public business location
- table windows
- table count and capacity
- purchase/policy requirements
- accessibility/logistics

The platform should show:
- nearby compatible GM supply
- nearby Player demand
- expected group sizes
- recurrence
- upcoming tabletop traffic
- pilot/venue analytics

## Opportunity initiation

The marketplace does not require one role to initiate every table.

- Player demand can reveal that enough nearby people want the same kind of game.
- GM supply can reveal a runnable game that needs compatible Players and a Venue.
- Venue capacity can reveal an open table window that compatible GMs and Players could use.

Player demand, GM supply, and Venue capacity are equal opportunity starters. Once a viable forming table has a GM attached, the GM may become the primary operational coordinator for the group and Venue.

## System scope

Dinner, Dice & Dragons is a multi-system tabletop RPG product, not a Dungeons & Dragons-only application.

Dungeons & Dragons may remain the strongest early acquisition channel, SEO target, example system, and part of the brand identity. Ordinary marketplace workflows, matching rules, data models, and authorization must remain system-neutral.

The platform should make support for D&D, Pathfinder, Call of Cthulhu, Cyberpunk RED, Shadowrun, and other supported RPGs understandable without weakening the Dinner, Dice & Dragons brand.

## Core matching model

A viable table is created from the overlap of:
- RPG system + edition
- time availability
- geographic distance / travel radius
- GM availability
- venue table availability
- seat count
- game format
- Player experience fit
- table tone/style
- age/accessibility/venue requirements

Matching must be explainable. A future Table Fit score should show why a match exists instead of presenting an opaque recommendation.

## Demand signals

The platform should not require one role to always initiate.

Examples:
- `5 nearby Players want Pathfinder Saturday afternoon.`
- `A D&D GM is available every other Tuesday.`
- `A partner restaurant has two tables open Wednesday 6–10 PM.`

These signals can create a Table Opportunity before a Game exists.

## State model

```text
INTEREST / AVAILABILITY SIGNALS
        ↓
TABLE OPPORTUNITY
        ↓
GM + compatible venue
        ↓
GAME FORMING
        ↓
Players join/request seats
        ↓
Minimum viable headcount
        ↓
GAME CONFIRMED
        ↓
Game Hub + Calendar + reminders
        ↓
GAME HAPPENS
        ↓
Attendance + feedback + venue traffic
```

## Competitive moat

Do not try to beat:
- Discord at chat
- Facebook at social reach
- Meetup at generic event communities
- StartPlaying at online paid GM booking

Win on the combined physical-table workflow:

> local Game Master + local Players + public Venue + scheduling + compatibility + trust + measurable venue traffic.

## Product test for new features

Before adding a feature, ask:

1. Does it help discover demand?
2. Does it improve matching?
3. Does it help a viable table form?
4. Does it reduce cancellation/no-show risk?
5. Does it help the game happen successfully?
6. Does it provide useful value to a venue?

If the answer is no to all six, the feature is probably outside the MVP.

## Primary language

Player CTA: **Find My Table**

Game Master CTA: **Form a Table**

Venue CTA: **Fill My Tables**

Platform explanation:

> Players tell us what they want to play. Game Masters tell us what they can run. Venues tell us when they have tables. We find the local overlap.
