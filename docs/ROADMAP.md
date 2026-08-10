# Dinner, Dice & Dragons — Roadmap

## Phase 0 — Product Definition

**Goal:** Define the product around successful physical-table formation before locking infrastructure.

- [x] Living project charter
- [x] Product positioning / competitive premise
- [x] Definition of Done
- [x] Initial data schema
- [x] Location/travel-radius model
- [x] Three-way Game Hub model
- [x] Trust and safety baseline
- [x] Accessibility baseline
- [x] SEO page direction
- [ ] Production moderation workflow
- [ ] Brand/name risk research

## Phase 1 — Table Match Prototype

**Goal:** Demonstrate the full three-sided product loop with realistic sample data.

### Demand signals
- [x] Find My Table Player onboarding
- [x] Form a Table GM onboarding
- [x] Fill My Tables Venue onboarding
- [x] System-specific experience model
- [x] ZIP + travel-radius constraints
- [x] GM/venue schedule overlap
- [ ] Structured Player availability model
- [ ] Player-demand aggregation by system/time/radius

### Matching
- [x] Homepage explains Table Match premise
- [x] Venue-window matching prototype
- [ ] Combine Player demand + GM availability + venue capacity
- [ ] Explainable Table Fit criteria
- [ ] Minimum viable Player commitment
- [ ] Forming-table state
- [ ] System/date/play-style filters
- [ ] Calendar-style discovery
- [ ] Map-style discovery concept

### Conversion
- [x] Forming game listing template
- [x] Dedicated SEO game pages
- [x] Recurrence/headcount fields
- [x] Three-way Game Hub prototype
- [ ] Forming → Confirmed state demo
- [ ] Waitlist / cancellation recovery demo
- [ ] Schedule Next Session demo

### Quality
- [x] Responsive mobile baseline
- [x] Keyboard-equivalent controls
- [x] Semantic/accessibility baseline
- [x] SEO titles/descriptions
- [x] GitHub Pages deployment
- [x] Static automated checks
- [ ] Browser accessibility smoke tests

## Phase 2 — Florence Pilot Preparation

**Goal:** Prove that structured matching creates actual local sessions.

- [ ] Recruit 3–5 willing public venues
- [ ] Recruit ~10 active GMs across multiple systems
- [ ] Recruit 50–100 interested Players
- [ ] Collect real Player demand signals
- [ ] Collect real GM availability signals
- [ ] Collect real venue table windows
- [ ] Manually/semiautomatically identify first Table Matches
- [ ] Create venue onboarding one-pager
- [ ] Create GM onboarding one-pager
- [ ] Create reporting policy
- [ ] Create post-session feedback form
- [ ] Define pilot dashboard

### Pilot metrics

Track:
- demand signals collected
- potential Table Matches
- forming tables
- confirmed tables
- sessions actually played
- time from signal to confirmed table
- seat fill rate
- cancellation/no-show rate
- repeat groups
- expected venue visits
- actual venue visits
- would-play/host/return-again signals

## Phase 3 — Controlled Shared Pilot

**Goal:** Add only enough shared persistence to run the local experiment safely.

Possible temporary implementation: Google Sheets + Apps Script behind a controlled pilot.

Required before public writes:
- [ ] identity/authentication decision
- [ ] permission model
- [ ] validation and abuse controls
- [ ] privacy review

Pilot capabilities:
- [ ] shared Player demand records
- [ ] shared GM availability records
- [ ] shared venue windows
- [ ] Table Match records
- [ ] forming/confirmed table states
- [ ] registrations
- [ ] headcount
- [ ] calendar sync
- [ ] role-aware Game Hub messages
- [ ] attendance
- [ ] structured feedback

Do not treat the temporary persistence layer as permanent architecture.

## Phase 4 — Production MVP

**Goal:** Replace validated pilot workflows with a secure application.

Likely backend direction after validation:
- FastAPI
- PostgreSQL
- Docker

Capabilities:
- [ ] authentication
- [ ] Player / GM / Venue profiles
- [ ] structured availability
- [ ] geographic matching
- [ ] demand aggregation
- [ ] explainable Table Match engine
- [ ] forming/confirmed lifecycle
- [ ] join/request/waitlist
- [ ] calendar and reminders
- [ ] Game Hub
- [ ] attendance/reliability
- [ ] structured feedback
- [ ] reporting/moderation
- [ ] venue traffic analytics
- [ ] admin tools

## Phase 5 — Retention and Density

- [ ] Schedule Next Session
- [ ] recurring groups/campaigns
- [ ] cancellation recovery / replacement Players
- [ ] demand alerts to GMs
- [ ] open-table alerts to Players
- [ ] venue opportunity alerts
- [ ] improved Table Fit recommendations
- [ ] GM recognition
- [ ] venue promotions/tabletop specials

## Phase 6 — Business Validation

Only after local table density exists:

- [ ] premium venue analytics/tools
- [ ] promoted table windows
- [ ] premium GM tools
- [ ] ticketed events
- [ ] marketplace
- [ ] DNDCards integration
- [ ] merchandise / physical products
- [ ] B2B event tools

## Explicitly Deferred

- native mobile apps
- private-home game discovery
- POS integration
- generic social feed
- complex achievements
- AI-first opaque matching
- national launch before proving one local market
