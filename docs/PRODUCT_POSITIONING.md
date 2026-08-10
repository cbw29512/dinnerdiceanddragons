# Dinner, Dice & Dragons — Product Positioning

## Core promise

> Dinner, Dice & Dragons turns local tabletop interest into actual game nights.

The platform is not primarily a social network, chat app, general event calendar, or paid GM marketplace. Its core job is to form viable local in-person RPG tables.

## Three entry points

### Player — Find My Table
Players provide:
- systems/editions they want to play
- availability
- system-specific experience
- game format preferences
- table preferences
- ZIP/location and travel radius

The platform should show compatible nearby games and, later, aggregate unmet Player demand that can attract GMs.

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
- nearby GM demand
- expected group sizes
- recurrence
- upcoming tabletop traffic
- pilot/venue analytics

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

> local GM + local Players + physical venue + scheduling + compatibility + trust + measurable venue traffic.

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

GM CTA: **Form a Table**

Venue CTA: **Fill My Tables**

Platform explanation:

> Players tell us what they want to play. GMs tell us what they can run. Local venues tell us when they have tables. We find the overlap.
