# Dinner, Dice & Dragons — Three-Way Matching Contract

**Status:** Canonical product invariant  
**Date:** 2026-08-18

## North-star rule

Dinner, Dice & Dragons is a three-sided local tabletop marketplace. The platform succeeds when it finds a compatible overlap among:

1. a Game Master who can run a type of game, in an area, during a time window;
2. Players who want that type of game, can travel to that area, and can attend during that time window; and
3. a Venue that can host the resulting group size in that area during that time window.

When all three sides are compatible, DD&D should surface the opportunity immediately and move it toward a confirmed Table.

> **GM supply + Player demand + Venue capacity + compatible place/time = BOOM: a Table can happen.**

No side is subordinate to another during discovery. Each side independently publishes what it can offer or needs, and the platform finds the overlap.

## Time belongs to the concrete signal

Profile-level availability is reusable/default availability only. Production matching must keep **what** and **when** coupled on the concrete marketplace signal.

A GM may truthfully say:

- D&D 5e — Saturday 6–10 PM;
- Call of Cthulhu — Tuesday 6–9 PM.

Those windows must not be cross-combined. The D&D supply signal owns its Saturday availability and the Call of Cthulhu supply signal owns its Tuesday availability.

The same rule applies to Players: a Player may be available for one game/system on one night and a different game/system on another night.

Canonical typed ownership:

- `GMSupplySignal` → `GMSupplyAvailabilityWindow` → `RecurringAvailabilityRule`
- `PlayerDemandSignal` → `PlayerDemandAvailabilityWindow` → `RecurringAvailabilityRule`
- `VenueTableWindow` → `RecurringAvailabilityRule`

Legacy profile-owned availability may be used only as a backward-compatibility fallback for old signals that do not yet have signal-owned windows. New matching signals must persist at least one concrete availability window.

## GM signal

A GM must be able to say, in practical terms:

> I can run this type of game, on these days/times, in this area, for this many Players.

Minimum matching inputs:

- game system / edition;
- game format where relevant (learn-to-play, one-shot, campaign, etc.);
- recurring or one-time availability windows;
- geographic area / postal code;
- maximum travel radius;
- minimum and maximum Player count;
- beginner-friendly / experience expectations where relevant;
- optional game/table style preferences.

The GM does not need to have a Venue or existing Players before publishing supply.

## Player signal

A Player must be able to say, in practical terms:

> I want to play this type of game, I can attend on these days/times, and I can travel within this area.

Minimum matching inputs:

- game system / edition or willingness to learn;
- game format preference where relevant;
- recurring or one-time availability windows;
- geographic area / postal code;
- maximum travel radius;
- experience level where relevant;
- optional table-style / environment preferences.

A Player does not need to find a pre-existing Event before publishing demand.

Multiple compatible Player demand signals may combine into enough demand to support a Table.

## Venue signal

A Venue must be able to say, in practical terms:

> We can host this many people, during these days/times, at this location, under these operating rules.

Minimum matching inputs:

- public location / coordinates;
- recurring or one-time table availability;
- number of tables available;
- maximum people per table;
- approval requirements;
- optional purchase/minimum-spend policy;
- environment/accessibility information;
- what the Venue brings to the Table.

Venue value is not defined by food service. A Venue may contribute consistent space, snacks or beverages, discounts, loyalty rewards, GM/host rewards, prize support, store credit, terrain/minis, supplies, promotion, staff support, private rooms, or other Venue-defined benefits.

The Venue does not need to select a specific RPG system merely to publish general tabletop capacity.

## Hard-fit matching order

A fully viable Table opportunity requires all of the following:

1. **Game fit** — GM capability and Player demand are compatible with the same game system / relevant format.
2. **Time fit** — GM, enough Players, and Venue capacity overlap for a concrete occurrence or compatible recurring window.
3. **Geographic fit** — the Venue is within the GM's and participating Players' travel constraints.
4. **Player-count fit** — enough compatible Players exist to meet the GM/Table minimum without exceeding the GM/Table or Venue maximum.
5. **Venue-capacity fit** — the Venue can physically host the expected Table size during that occurrence.
6. **Policy fit** — age, approval, accessibility, environment, and other hard requirements are not incompatible.

Soft preferences may rank compatible opportunities but must not override a failed hard requirement.

## Incomplete opportunities are valuable

The platform must not wait for a complete three-way match before showing useful opportunity.

Examples:

- 5 Players want D&D Saturday evenings in Florence; **needs GM + Venue**.
- GM can run Pathfinder Friday evenings; 4 compatible Players exist; **needs Venue**.
- Venue has six-person tables Tuesday evenings; GM and Players align; **almost ready**.
- GM + Venue align but only 3 of 5 minimum Players exist; **needs 2 Players**.

These are persistent formation opportunities, not failed searches.

## The BOOM moment

When the matcher determines that the hard-fit rules pass for a GM, enough Players, a Venue, and a concrete time window, the product must create or update the persistent `GameTable` immediately. An Event is **not** required to exist first.

Compatible Players are invited to the materialized Table; matching does not silently commit them. The GM, Players, and Venue still complete the required confirmation/approval workflow before the scheduled Event becomes confirmed.

Conceptually:

```text
GM
"I can run D&D 5e Saturdays 6–10 PM near Florence for 4–6 Players"
          +
PLAYERS
"We want D&D 5e Saturdays and can travel to Florence"
          +
VENUE
"We can host one 6-person Table Saturdays 6–10 PM"
          ↓
      HARD-FIT MATCH
          ↓
        BOOM!
          ↓
   VIABLE GAME TABLE
          ↓
 HUMAN CONFIRMATIONS
          ↓
   SCHEDULED EVENT
```

The GM gets Players and a place to run. The Players get a runnable local game. The Venue receives a predictable group for a predictable block of time and may attach its own purchase policies, incentives, or host benefits.

## Value exchange

### GM wins

- compatible Players are found;
- Venue logistics are solved;
- recurring space may be available;
- Venue-specific perks may include meals, drinks, discounts, GM rewards, loyalty punches, prizes, store credit, or other support.

### Players win

- they find an actual runnable Table rather than merely a list of people;
- schedule/location compatibility is established before commitment;
- Venue expectations and table expectations are visible;
- recurring groups can become easier to sustain.

### Venue wins

- known group size;
- known arrival window;
- known expected duration;
- repeat traffic potential;
- ability to set purchase/operating rules;
- ability to advertise whatever it uniquely brings to the Table.

## Product implications

- Homepage paths remain equal: **I Want to Play / I Want to Run / I Have a Table**.
- PlayerDemandSignal, GMSupplySignal, and VenueTableWindow remain independent first-class inputs.
- The matcher must operate on signals, not require a GM-created Event as the starting object.
- A persistent GameTable represents formation/retention.
- A TableMatch represents a concrete explainable hard-fit opportunity.
- An Event represents a scheduled occurrence after formation.
- Matching results must be explainable: system, time, geography, player count, capacity, and relevant policy criteria.
- The UI must prominently surface incomplete states such as **Needs GM**, **Needs Players**, **Needs Venue**, and **Almost Ready**.
- Payments remain deferred until traction; this matching/value loop must work without payment infrastructure.

## V1 proof

The V1 marketplace is successful only when real independent signals can produce this outcome:

**GM supply + compatible Player demand + compatible Venue capacity → viable Table → scheduled Event → people show up → Table repeats.**

That is the core product loop. Future features must support it rather than obscure it.
