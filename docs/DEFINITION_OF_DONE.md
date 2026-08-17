# Dinner, Dice & Dragons — Prototype and Production Definition of Done

## Purpose

This document contains two separate acceptance contracts:

1. the original prototype Definition of Done, preserved as the validation contract that proved the product concept;
2. the Production Definition of Done, which defines when Dinner, Dice & Dragons is a real deployable three-sided marketplace.

Prototype completion does not imply production completion.

The prototype exists to validate one question before production infrastructure: **can a first-time visitor understand how Dinner, Dice & Dragons turns Player demand, GM availability, and public venue capacity into an actual local game night?**

The prototype is not production software and must not pretend that local-only or sample interactions are shared/live features.

## Prototype success journey

A first-time visitor should understand this lifecycle without owner explanation:

**Demand Signals → Table Match → Forming → Confirmed → Game Hub → Played**

They should also understand the three primary role actions:

- **🎲 Find My Table** — Player demand
- **🧙 Form a Table** — GM supply
- **🍽️ Fill My Tables** — Venue capacity

## Prototype release gates

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

The items below were not required to validate the original prototype only. They are not exclusions from the current production product scope.

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

---

## Production Definition of Done

### Production purpose

Dinner, Dice & Dragons is production-ready only when real authenticated users can use the shared production system to turn Player demand, Game Master supply, and public Venue capacity into actual local in-person tabletop RPG sessions.

The production network is United States-wide. Individual in-person Table Matches remain geographically local.

The production lifecycle is:

**Demand Signals -> Table Match -> Forming -> Confirmed -> Game Hub -> Played -> Trust + Repeat**

Production is not Done merely because pages render, accounts exist, or prototype matching looks correct. The end-to-end marketplace loop must operate on real persisted data with production authorization, privacy, reliability, and operational controls.

### 1. Product integrity

Production must preserve these non-negotiable rules:

- Player demand, Game Master supply, and Venue capacity are equal opportunity starters.
- A table does not have to begin with a GM-created Event.
- Once a viable forming table has a GM, the GM may become the primary operational coordinator.
- The product is multi-system and must not hard-code Dungeons & Dragons as the only RPG.
- Dungeons & Dragons may remain a major brand, SEO, example, and acquisition channel.
- Public/community Venues are the initial in-person hosting model.
- Games, forming tables, and Table Opportunities are discovery objects; people-swiping is not the core product.
- Successful Tables Played is the primary product outcome.
- Florence, South Carolina may be the first density pilot but cannot be a product-access boundary.

### 2. Production identity and authorization

- Supabase Auth or the currently accepted production identity provider authenticates users.
- Every authenticated person maps to one durable Dinner, Dice & Dragons User identity.
- One User may hold Player, Game Master, and Venue Manager roles simultaneously where applicable.
- Verified email is enforced where required by production participation policy.
- Public browsing remains available without requiring an account where the content is intended to be public.
- FastAPI enforces account status, roles, ownership, and resource relationships server-side.
- Client-supplied User IDs, profile owner IDs, Venue ownership IDs, or authorization metadata are never trusted as authority.
- One user cannot read or mutate another user's private role-owned records without an explicit authorized relationship.
- Venue management actions require a valid relationship to the specific Venue.

### 3. Three-sided production signals

A production user can create and manage the role-specific data required for matching:

- PlayerDemandSignal for Player demand;
- GMSupplySignal for Game Master supply;
- VenueTableWindow for Venue capacity.

Signal requirements:

- records persist in PostgreSQL;
- create/read operations use authenticated production APIs;
- ownership is derived server-side;
- active/paused/matched/expired or equivalent lifecycle behavior is enforceable where applicable;
- invalid or contradictory inputs are rejected;
- production matching reads these shared records rather than localStorage or sample arrays.

### 4. Location, travel, schedule, and recurrence

- Players and Game Masters can supply privacy-respecting location anchors and travel constraints.
- ZIP/postal-code matching remains available without requiring a private home address.
- Exact private home addresses, if ever collected, are protected and never exposed publicly.
- Venues have usable public location data and coordinates for geographic matching.
- Venue timezone is stored or deterministically available.
- Straight-line distance may be used initially when clearly identified as approximate.
- Player and GM travel limits participate in hard-fit matching.
- Recurring availability resolves to actual calendar occurrences rather than comparing labels such as 'every other Tuesday'.
- Weekly intervals, anchored alternating schedules, and supported ordinal-monthly rules behave deterministically.
- Multiple availability windows are supported.
- Timezone and DST behavior is explicit and tested.

### 5. Hard-fit Table Match engine

Before any soft ranking occurs, production matching must determine whether a table is actually viable.

Hard-fit evaluation includes, where applicable:

- canonical RPG system and edition;
- actual overlapping occurrence date/time and duration;
- Player travel constraint;
- GM travel constraint;
- Venue location and availability;
- active signal state;
- Venue availability/verification requirements;
- Venue table capacity;
- minimum and maximum Player counts;
- age requirements;
- required environment constraints;
- required accessibility/seating constraints;
- other explicitly hard table or Venue requirements.

Reputation history is not a hard-fit requirement for an ordinary table. A new user with no Dinner, Dice & Dragons history remains neutral.

### 6. Explainable and persisted Table Matches

A viable production match produces durable records rather than only a transient browser score.

Production must persist or equivalently represent:

- TableMatch;
- TableMatchPlayer or equivalent eligible-Player relationships;
- MatchExplanation.

Every match must be able to explain the important criteria that passed or failed.

The application must not rely on an unexplained AI percentage or opaque compatibility score.

Soft Table Fit ranking may rank only candidates that already pass required hard compatibility.

### 7. Forming and confirmation lifecycle

- A viable opportunity can move into Forming when the required GM/game/Venue relationship exists.
- Players can request or commit to seats through production data.
- Minimum Players remain distinct from maximum seats.
- Venue approval is enforced when the Venue requires approval.
- A table cannot become Confirmed until required Venue approval and minimum Player commitment are satisfied.
- Capacity cannot be exceeded or double-booked.
- Waitlist/cancellation recovery does not silently overbook the Venue.
- Status transitions are enforced server-side rather than trusted from arbitrary browser state.
- Recurring campaigns can manage individual occurrences without destroying the entire series.

### 8. Production Game Hub

A Confirmed table has a shared production Game Hub appropriate to each role.

Player view includes the Player's seat, schedule, Venue information, announcements, and appropriate table communication.

Game Master view includes participant commitments, schedule, operational table information, and Venue coordination.

Venue view includes only operational information needed to host the group, including schedule, expected headcount, recurrence, and appropriate GM contact/communication.

Venue views must not expose unnecessary Player email addresses, home addresses, private RPG discussion, moderation reports, or unrelated private profile information.

Any messaging feature presented as live must use real production persistence/delivery rather than a sample-only preview.

### 9. Played, attendance, reputation, and Venue evidence

- A completed session can transition to Played/completed status.
- Attendance can be recorded only by authorized participants or staff according to policy.
- Feedback eligibility is tied to a verified completed interaction.
- Reputation evidence is derived from verified platform activity.
- New-to-DDD history remains neutral.
- Missing reputation metrics are not displayed as zero-quality scores.
- Moderation allegations do not automatically become public reputation penalties.
- Venue metrics can distinguish expected guests from actual visits where data is available.
- Successful groups can move toward a reduced-friction repeat/next-session workflow.

### 10. Privacy, safety, and abuse controls

- Code of Conduct is available from major product journeys.
- Table expectations are visible before Player commitment.
- Sensitive user location information is protected.
- Role views follow least-privilege data exposure.
- Private reports and moderation cases are not public reputation records.
- Production rate limiting, abuse controls, and account restriction/blocking mechanisms are implemented for exposed write surfaces.
- Severe failures and security-relevant events generate useful server-side logs without leaking secrets or sensitive user content unnecessarily.

### 11. Accessibility and usability

- Production critical journeys meet the project's WCAG 2.2 AA target.
- A formal accessibility audit is completed before declaring production launch readiness.
- Keyboard-only operation works for all critical actions.
- Focus states are visible.
- Forms have programmatic labels and understandable validation errors.
- Status is not conveyed by color alone.
- Reduced-motion preferences are respected.
- Core flows reflow at narrow/mobile widths without requiring horizontal page scrolling.
- Skip links and semantic landmarks are present where appropriate.
- No broken critical internal links or fragment links remain.

### 12. Production technical and operational quality

- Production database migrations are versioned and reproducible.
- Application startup and health checks fail clearly when required configuration is missing.
- Secrets are never committed to the repository or shipped to the browser.
- Production and test environments use intentional configuration boundaries.
- CI validates backend tests, lint/format, migrations, frontend/static QA, browser behavior, accessibility checks, and production integration contracts.
- A failed production dependency does not silently convert a real user action into fake/sample success.
- Errors shown to users are understandable while server logs preserve diagnostic detail.
- Deployment and rollback procedures are documented.
- Backup/recovery expectations for durable production data are documented and tested before broad launch.

### 13. Production honesty and prototype isolation

- Prototype/sample data remains clearly labeled wherever it is intentionally retained.
- localStorage is not authoritative storage for production marketplace state.
- Google Sheets or Apps Script prototype persistence is not authoritative production storage.
- Production workflows do not silently fall back to sample data after a production write/read failure.
- A feature is not described as production-live until its real shared backend path exists and is operating.
- Demo Game Hub messages, sample games, and sample Venue traffic remain visibly identified as demonstrations until replaced by production records.

## Production exit criterion

Dinner, Dice & Dragons is production-ready when three independent real users representing Player, Game Master, and Venue roles can use the deployed shared system to complete the marketplace loop without developer intervention:

1. each role supplies its real production signal;
2. the system finds a geographically and temporally viable local overlap;
3. the system creates an explainable Table Match;
4. the opportunity moves to Forming;
5. Players commit/request seats;
6. required Venue approval is recorded;
7. minimum commitment produces a Confirmed table;
8. the participants use the production Game Hub;
9. the session is recorded as Played;
10. attendance and eligible trust/Venue evidence can be generated;
11. the group can pursue a repeat session without recreating the entire table from scratch.

The same production system must allow another U.S. market to participate without code changes or a Florence-specific deployment.

Passing this exit criterion means Dinner, Dice & Dragons is operating as the intended three-sided marketplace, not merely presenting a convincing prototype.
