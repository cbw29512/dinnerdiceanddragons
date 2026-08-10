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
- [x] Reputation/fair-start model
- [x] Identity/anti-troll architecture
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
- [x] Structured Player availability model
- [x] Player-demand aggregation by system/time
- [x] GM/venue schedule overlap

### Matching
- [x] Homepage explains Table Match premise
- [x] Venue-window matching prototype
- [x] Combine Player demand + GM availability + venue capacity
- [x] Explainable Table Fit score/criteria
- [x] Player-specific venue travel radius checks
- [x] Minimum viable Player commitment
- [x] Forming-table state
- [ ] System/date/play-style discovery filters
- [ ] Calendar-style discovery
- [ ] Map-style discovery concept

### Conversion and lifecycle
- [x] Forming game listing template
- [x] Dedicated SEO game pages
- [x] Recurrence/headcount fields
- [x] Minimum Players separate from maximum seats
- [x] Forming → Confirmed state demo
- [x] Venue approval requirement demo
- [x] Waitlist / cancellation recovery demo
- [x] Confirmed → Completed demo
- [x] Reputation eligibility gated behind completion
- [x] Three-way Game Hub prototype
- [ ] Attendance recording UI
- [ ] Structured post-session feedback demo
- [ ] Schedule Next Session demo

### Trust and identity
- [x] Unique display-name architecture
- [x] Durable one-user/multi-role identity model
- [x] Verified-interaction Reputation Ledger design
- [x] New-to-DDD neutral reputation state
- [x] Fair-discovery audit concept
- [x] Public Reputation & Trust explanation page
- [x] Anti-troll implementation checklist
- [ ] Production authentication integration
- [ ] Production rate limiting / blocking
- [ ] Venue claim verification implementation

### Quality
- [x] Responsive mobile baseline
- [x] Keyboard-equivalent controls
- [x] Semantic/accessibility baseline
- [x] SEO titles/descriptions
- [x] GitHub Pages deployment
- [x] Static automated checks
- [ ] Browser accessibility smoke tests
- [ ] Fragment-link automated validation

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
- newcomer vs established successful-match rate
- would-play/host/return-again signals

## Phase 3 — Controlled Shared Pilot

**Goal:** Add only enough shared persistence to run the local experiment safely.

Required before public writes:
- [ ] production identity/authentication choice implemented
- [ ] permission model implemented
- [ ] validation and abuse controls implemented
- [ ] privacy review

Pilot capabilities:
- [ ] shared Player demand records
- [ ] shared GM availability records
- [ ] shared venue windows
- [ ] Table Match records
- [ ] forming/confirmed/completed table states
- [ ] registrations and waitlists
- [ ] headcount
- [ ] calendar sync
- [ ] role-aware Game Hub messages
- [ ] attendance
- [ ] ReputationEvents / snapshots
- [ ] structured feedback

Do not treat any temporary persistence layer as permanent architecture.

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
- [ ] forming/confirmed/completed lifecycle
- [ ] join/request/waitlist
- [ ] calendar and reminders
- [ ] Game Hub
- [ ] attendance/reliability
- [ ] Reputation Ledger
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
