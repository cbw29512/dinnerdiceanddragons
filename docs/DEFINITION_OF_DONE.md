# Dinner, Dice & Dragons — Definition of Done

## Purpose

The prototype exists to validate one question before production infrastructure: **can a first-time visitor understand how Dinner, Dice & Dragons turns Player demand, GM availability, and public venue capacity into an actual local game night?**

The prototype is not production software and must not pretend that local-only or sample interactions are shared/live features.

## Prototype success journey

A first-time visitor should understand this lifecycle without owner explanation:

**Demand Signals → Table Match → Forming → Confirmed → Game Hub → Played**

They should also understand the three primary role actions:

- **🎲 Find My Table** — Player demand
- **🧙 Form a Table** — GM supply
- **🍽️ Fill My Tables** — Venue capacity

## Release gates

### 1. Positioning

- Brand is consistently **Dinner, Dice & Dragons**.
- Primary promise is clear: turn local tabletop interest into actual game nights.
- Site explains the three-sided model within the first viewport or immediately after it.
- No surface presents people-swiping as the core product.
- No unexplained/opaque compatibility score is shown.
- Product remains TTRPG-system neutral even when examples use D&D heavily.

### 2. Player journey — Find My Table

A Player can understand and preview supplying:

- location / ZIP
- travel radius
- availability
- RPG systems and system-specific experience
- desired game format
- table/play-style preferences
- relevant environment/accessibility needs

Player discovery must show:

- lifecycle state such as Forming or Confirmed
- system and game type
- schedule
- venue/environment
- seats
- distance when available
- Table Fit information
- GM trust information
- joining method
- clear route to full table details

### 3. GM journey — Form a Table

A GM can understand and preview supplying:

- availability
- travel radius
- systems and system-specific GM experience
- desired cadence
- GM/table style
- table expectations

The GM journey then demonstrates:

**GM signal → nearby compatible venue window → forming game listing → Player discovery → confirmed Game Hub**

The prototype must clearly state that complete Table Match will also incorporate aggregate compatible Player demand.

### 4. Venue journey — Fill My Tables

A venue can understand, without knowing TTRPG rules:

- what the product does for the business
- that the GM runs the game
- how the venue controls table inventory
- days/hours offered
- table count and capacity
- recurrence
- purchase policy
- age/alcohol/environment/accessibility information
- approval control

The venue-facing value demonstration must include:

- expected headcount
- recurrence / future sessions
- expected vs actual visits
- repeat-group potential
- cancellation/no-show concept

### 5. Table Match

The prototype must demonstrate or clearly reserve the inputs for:

- system / edition
- schedule and duration
- geographic distance
- venue window
- venue capacity
- Player demand
- minimum/maximum Players
- experience fit
- game format/cadence
- play style
- age/environment fit
- accessibility/seating needs

Match explanations must be criterion-based, not a mysterious AI percentage.

### 6. Lifecycle

The terms below must be used consistently:

- **Potential Match** — meaningful overlap detected; commitments not established
- **Forming** — GM/game/venue exists and Players can commit/request
- **Confirmed** — venue approval + minimum Player commitment satisfied
- **Played** — attendance can be recorded
- **Repeating** — next session can be scheduled with reduced friction

A forming game must not be described as confirmed.

### 7. Game detail pages

Each sample table page must show:

- explicit lifecycle state
- title/system/type
- date/time/duration
- public venue/environment
- open seats
- joining method
- Table Fit/table culture
- GM trust information
- safety link
- correct Player onboarding anchor
- explanation of what moves the table forward

### 8. Game Hub

The Hub represents **post-confirmation operations**, not generic community chat.

It must demonstrate:

- GM view
- Player view
- Venue view
- expected headcount
- recurrence
- table announcements
- GM ↔ Venue operational communication
- Player table discussion
- structured Player → Venue questions
- venue traffic evidence

Private emails, home addresses, moderation reports, and unnecessary private profile data must not appear in Venue views.

### 9. Trust and safety

- Code of Conduct is accessible from every major journey.
- Public-venue-first approach is explicit.
- Table expectations exist before commitment.
- Experience self-rating is separate from earned platform history.
- Trust is structured and role-specific rather than one generic star score.
- Reports are described as private allegations requiring review, not automatic verdicts.

### 10. Accessibility / usability

- meaningful page title and description
- skip link
- semantic `main` and navigation landmarks
- keyboard-operable controls
- visible focus states
- programmatic form labels
- understandable form errors/status
- status not conveyed by color alone
- reduced-motion support
- responsive mobile layout
- no dead internal page links
- no broken fragment links on core journeys

A formal WCAG 2.2 AA audit remains required before production.

### 11. Prototype honesty

Any localStorage/sample behavior must say it is prototype behavior. Shared persistence, authentication, seat reservation, messaging, Calendar sync, and reputation must not be represented as production-live until they actually exist.

### 12. Technical quality

- static site deploy succeeds
- internal links and referenced scripts validate in CI
- browser JavaScript syntax validates
- Apps Script syntax validates while Apps Script remains in repo
- important modules log meaningful failures
- no single JS module should become a monolith; split files approaching ~150 lines where practical
- production data schema remains separate from UI card markup

## Not required to validate the prototype

- native mobile app
- generic social feed
- private-home matching
- POS integration
- national launch
- opaque AI-first matching
- production backend

## Prototype exit criterion

The prototype is strong enough for local research when a Player, GM, and restaurant manager can each independently answer:

1. **What do I provide?**
2. **What does Dinner, Dice & Dragons match for me?**
3. **What happens after a match?**
4. **Why is this better than posting in a generic group?**
5. **What information is private?**
