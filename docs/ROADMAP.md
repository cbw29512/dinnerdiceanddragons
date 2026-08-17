# Dinner, Dice & Dragons — Roadmap

**Operating rule:** Dinner, Dice & Dragons is a United States-wide platform for geographically local in-person Table Matches. Florence, South Carolina is the first concentrated density pilot, not a product boundary.

**Current production critical path:** Production Foundation -> Production Table Match -> Table Formation -> Production Game Hub -> Played/Trust -> Launch Readiness.

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

**Status note:** This phase records prototype validation. Remaining unchecked prototype-only demonstrations are not production blockers unless the equivalent capability is also required in the production phases below.

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
- [x] Production authentication integration
- [ ] Production rate limiting / blocking
- [x] Initial production Venue claim verification backend path

### Quality
- [x] Responsive mobile baseline
- [x] Keyboard-equivalent controls
- [x] Semantic/accessibility baseline
- [x] SEO titles/descriptions
- [x] GitHub Pages deployment
- [x] Static automated checks
- [x] Browser accessibility smoke tests
- [x] Fragment-link automated validation

## Phase 2 — Florence Density Pilot Preparation

**Goal:** Prepare the first concentrated local-density test while keeping product access and architecture United States-wide.

**Execution note:** Market recruitment and pilot preparation may proceed in parallel with production engineering. The Florence pilot validates density and operations; it does not gate nationwide product access or create Florence-specific architecture.

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

## Phase 3 — Production Foundation — **IN PROGRESS**

**Goal:** Establish the secure shared production foundation required by all three marketplace sides without introducing Florence-specific architecture.

### Established production foundation

- [x] FastAPI application/service boundary
- [x] PostgreSQL production schema and versioned migrations
- [x] Supabase Auth integration
- [x] Durable User identity with multi-role support
- [x] Server-side authentication/ownership enforcement for implemented production endpoints
- [x] Canonical multi-system GameSystem catalog
- [x] Player production onboarding/profile persistence
- [x] Game Master production onboarding/profile persistence
- [x] Player/Game Master structured availability and recurrence persistence
- [x] PlayerDemandSignal, GMSupplySignal, and VenueTableWindow production models/tables
- [x] Authenticated Player/GM/Venue matching-input create/list APIs
- [x] Deterministic production recurrence expansion
- [x] Automated backend, static, browser, accessibility-smoke, and fragment-link QA baseline

### Foundation work remaining

- [ ] Complete Venue production onboarding and management workflow
- [ ] Settle the canonical shared location/travel architecture before hard-fit matching
- [ ] Complete Venue verification operations beyond the initial admin approval path
- [ ] Complete production validation, rate limiting, blocking, and abuse controls for exposed write surfaces
- [ ] Complete privacy/security review for production public-write workflows

## Phase 4 — Production Table Match Engine — **NEXT CRITICAL PATH**

**Goal:** Turn independent Player demand, Game Master supply, and Venue capacity into real, explainable, geographically local Table Matches.

The production matcher must treat Player, Game Master, and Venue signals as equal opportunity starters. It must not require a GM-created Event to exist before an opportunity can be discovered.

### Hard-fit eligibility

- [ ] Match canonical RPG system and edition
- [ ] Expand recurrence into actual timezone-aware occurrence windows
- [ ] Require real date/time/duration overlap
- [ ] Apply Player travel constraints
- [ ] Apply Game Master travel constraints
- [ ] Apply Venue location and table-window constraints
- [ ] Exclude inactive/paused/expired or otherwise ineligible signals
- [ ] Enforce Venue verification/availability requirements where required
- [ ] Enforce Venue table capacity
- [ ] Enforce minimum and maximum Player counts
- [ ] Enforce hard age/environment requirements
- [ ] Enforce hard accessibility/seating requirements
- [ ] Produce deterministic pass/fail reasons for hard-fit criteria

### Persisted and explainable matching

- [ ] Add/persist TableMatch records
- [ ] Add/persist TableMatchPlayer or equivalent eligible-Player relationships
- [ ] Add/persist MatchExplanation records
- [ ] Make match recomputation deterministic and safe against stale opportunities
- [ ] Expose production matching through authenticated/authorized APIs
- [ ] Test Player-led opportunity formation
- [ ] Test Game Master-led opportunity formation
- [ ] Test Venue-led opportunity formation
- [ ] Test multiple supported RPG systems/editions
- [ ] Test a second U.S. market without code or deployment changes

### Table Fit after hard fit

- [ ] Rank only candidates that already pass hard-fit requirements
- [ ] Apply explainable soft preferences such as play style and experience
- [ ] Keep new-to-DDD reputation neutral
- [ ] Do not use opaque AI compatibility percentages as the production decision mechanism

## Phase 5 — Table Formation and Confirmation

**Goal:** Convert a viable Table Match into a real scheduled table with enforceable commitments and Venue capacity.

- [ ] Create a Forming table from a viable persisted Table Match
- [ ] Allow Players to request/commit to seats through production data
- [ ] Preserve minimum Players separately from maximum seats
- [ ] Enforce Venue approval where required
- [ ] Prevent Venue/table double-booking
- [ ] Prevent capacity overbooking
- [ ] Implement waitlist behavior
- [ ] Implement cancellation/replacement recovery
- [ ] Enforce lifecycle transitions server-side
- [ ] Promote Forming to Confirmed only when commitment and approval requirements are met
- [ ] Support individual recurring occurrences without destroying the entire series
- [ ] Add production calendar/reminder hooks for confirmed sessions

## Phase 6 — Production Game Hub and Played Lifecycle

**Goal:** Operate the real table after confirmation, record whether it happened, and produce trustworthy evidence for Players, Game Masters, and Venues.

### Shared Game Hub

- [ ] Replace sample/prototype Game Hub state with shared persisted production state
- [ ] Production Player view: seat, schedule, Venue information, announcements, table communication
- [ ] Production Game Master view: commitments, schedule, table operations, Venue coordination
- [ ] Production Venue view: schedule, expected headcount, recurrence, appropriate GM coordination
- [ ] Persist role-aware announcements/messages presented as live
- [ ] Preserve least-privilege Venue access to Player information

### Played and trust lifecycle

- [ ] Transition completed sessions to Played
- [ ] Record authorized attendance
- [ ] Gate feedback eligibility behind verified completed participation
- [ ] Generate ReputationEvents/snapshots from verified platform activity
- [ ] Preserve neutral reputation for new-to-DDD users
- [ ] Record expected versus actual Venue traffic where available
- [ ] Add structured post-session feedback
- [ ] Provide a reduced-friction repeat / next-session workflow

## Phase 7 — Production Launch Readiness

**Goal:** Prove that the deployed marketplace is secure, accessible, recoverable, honest about its state, and capable of operating without developer intervention.

### Safety and operations

- [ ] Complete production reporting/moderation workflow
- [ ] Complete rate limiting, blocking, and account restriction controls
- [ ] Enable/verify required production authentication security protections
- [ ] Complete least-privilege privacy review
- [ ] Complete production logging/error handling without sensitive-data leakage
- [ ] Document and verify deployment rollback procedure
- [ ] Document and test production backup/recovery expectations
- [ ] Verify production configuration/secrets boundaries
- [ ] Provide minimum administrative tooling required to operate the marketplace

### Accessibility and quality

- [ ] Complete formal WCAG 2.2 AA production audit
- [ ] Keep keyboard-only critical journeys passing
- [ ] Keep responsive/reflow critical journeys passing
- [ ] Keep internal-link and fragment validation passing
- [ ] Keep backend, lint/format, static QA, and browser regression suites passing
- [ ] Add production integration tests for real backend contracts
- [ ] Verify production workflows never silently fall back to sample/localStorage success

### Production exit test

- [ ] Three independent real users representing Player, Game Master, and Venue can complete the full marketplace loop without developer intervention
- [ ] Real signals produce a geographically and temporally viable local match
- [ ] Match is persisted and explainable
- [ ] Table reaches Forming and then Confirmed through real commitments/approval
- [ ] Production Game Hub is used by the three roles
- [ ] Session reaches Played with eligible attendance/trust/Venue evidence
- [ ] Group can pursue a repeat session without rebuilding the table from scratch
- [ ] A second U.S. market can use the same deployed system without code changes or a Florence-specific deployment

## Phase 8 — Retention, Density, and Business Expansion

**Goal:** Improve marketplace density, repeat play, Venue value, and monetization only after the core production loop works.

### Retention and density

- [ ] Advanced recurring groups/campaign management
- [ ] Demand alerts to Game Masters
- [ ] Open-table alerts to Players
- [ ] Venue opportunity alerts
- [ ] Improved Table Fit recommendations
- [ ] Game Master recognition
- [ ] Venue promotions/tabletop specials
- [ ] Advanced cancellation/replacement automation

### Business validation

Only after real local table density exists:

- [ ] Premium Venue analytics/tools
- [ ] Promoted table windows
- [ ] Premium Game Master tools
- [ ] Ticketed events
- [ ] Marketplace
- [ ] DNDCards integration
- [ ] Merchandise / physical products
- [ ] B2B event tools

## Explicitly Deferred

**Not deferred:** nationwide U.S. product access and architecture. Only broad national marketing/acquisition spend is deferred until local-density validation.

- native mobile apps
- private-home game discovery
- POS integration
- generic social feed
- complex achievements
- AI-first opaque matching
- large-scale national marketing/acquisition spend before local-density validation
