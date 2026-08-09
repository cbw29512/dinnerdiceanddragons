# Dinner, Dice & Dragons — Definition of Done

## Purpose

This document defines what must be true before the first public prototype is considered complete enough to show to players, Game Masters, and potential partner venues.

The prototype is not the final production platform. Its job is to validate the core experience, messaging, accessibility direction, and local-market concept before we invest in full backend infrastructure.

---

## Prototype Goal

A visitor should be able to understand the product within seconds and successfully walk through the full concept:

> Discover a local tabletop RPG event, understand what kind of table it is, inspect the Game Master and venue, decide whether they would join, and understand how the platform creates a safer, more reliable real-world gaming experience.

---

## Release Gate

The prototype is DONE only when all required sections below pass.

### 1. Brand and Positioning

- Working brand is displayed consistently as **Dinner, Dice & Dragons**.
- The primary value proposition is clear without needing explanation from the owner.
- The site clearly communicates that users are discovering games/tables, not swiping on people.
- The site clearly supports tabletop RPGs beyond one system, even if D&D examples dominate the initial content.
- Core calls to action are obvious:
  - Find a Game
  - Host a Game
  - Partner as a Venue

### 2. Homepage

The homepage must include:

- Clear hero statement
- Primary CTA to find a game
- Secondary CTA to host a game
- Explanation of how the platform works
- Featured upcoming games
- Trust and safety explanation
- Venue partnership explanation
- Local-community positioning
- Footer with basic navigation and legal placeholders

### 3. Game Discovery

Visitors must be able to browse realistic sample events through at least two interfaces:

- Card-based Discover view
- Search/filter or list view

The prototype should visually reserve room for later Map and Calendar views even if those are not fully interactive yet.

Each event card must show enough information to make a meaningful decision:

- Game title
- RPG system / edition
- Event type
- Date and time
- Venue
- Seats available
- Beginner friendliness
- Roleplay / combat / puzzle emphasis
- Accessibility indicators
- GM trust indicators

### 4. Game Detail Page

Each sample game page must display:

- Event title and description
- RPG system / edition
- Event type
- Date / start time / estimated duration
- Venue
- Seat capacity and seats remaining
- GM profile summary
- Table Expectations / Table Culture
- Joining method: Open Table or Request to Join
- Clear join-interest action in prototype form
- Accessibility information
- Safety/reporting language

### 5. Game Master Profile

A sample GM profile must demonstrate the intended trust model without reducing the person to a single public star score.

Display examples such as:

- Games hosted
- Player seats hosted
- Would-play-again percentage
- Reliability signal
- Communication signal
- Beginner-friendly recognition
- Systems run
- Preferred game styles

### 6. Venue Profile

A sample venue profile must show why businesses benefit from the platform.

Include:

- Venue description
- Location
- Available game nights
- Table capacity
- Food / drink details
- Accessibility details
- Parking
- Noise / lighting indicators
- Wi-Fi / power outlet indicators
- Alcohol-served indicator
- Example Dinner, Dice & Dragons special or venue promotion

### 7. Table Expectations

Every game detail must demonstrate structured table expectations.

Minimum fields:

- Tone
- Age guidance
- System / edition
- Roleplay emphasis
- Combat emphasis
- Puzzle emphasis
- PvP policy
- Homebrew policy
- Character-death expectations
- Mature-content indicator
- New-player friendliness
- Session duration
- Alcohol-served indicator

The prototype must make this information visible before any join action.

### 8. Trust and Safety

The prototype must clearly communicate:

- Public-venue-first launch strategy
- Structured post-game feedback concept
- Attendance / no-show accountability concept
- Private moderation/reporting workflow
- Reports do not automatically equal guilt
- Private complaints are not exposed publicly

### 9. Accessibility

The prototype must be usable without a mouse.

Required:

- Semantic headings and landmarks
- Keyboard-accessible navigation
- Visible focus states
- Accessible button labels
- Form labels where forms exist
- Sufficient text/background contrast
- No information conveyed by color alone
- Reduced-motion consideration for card/swipe interactions
- Swipe actions must have equivalent visible buttons
- Images must have meaningful alt text when informative

Target: WCAG 2.2 AA-oriented implementation practices.

### 10. Responsive Design

The prototype must work cleanly on:

- Mobile phone width
- Tablet width
- Standard desktop width

No horizontal scrolling for primary content.

### 11. SEO Foundation

Required public pages must have:

- Unique page title
- Meta description
- Semantic HTML structure
- Canonical-friendly clean URLs
- Open Graph-ready metadata placeholders
- Human-readable headings
- Local-search language in sample content

Suggested URL patterns:

- `/games/<slug>`
- `/venues/<slug>`
- `/rpg/<city-state>`
- `/dnd/<city-state>`

### 12. Performance

The GitHub Pages prototype should:

- Load without a backend
- Avoid large unnecessary dependencies
- Use optimized images
- Avoid blocking JavaScript for core reading/navigation
- Remain functional enough to understand without animation

### 13. Project Quality

Before release:

- No broken internal links
- No placeholder lorem ipsum
- No obvious spelling errors
- No inaccessible unlabeled controls
- No dead primary CTA
- README explains how to run locally
- README explains how GitHub Pages deployment works
- Roadmap and project charter are current

---

## Explicitly Not Required for Prototype Completion

These are deferred until the real application phase:

- Real authentication
- PostgreSQL
- FastAPI backend
- Real event creation
- Real seat reservation
- Real messaging
- Real notifications
- Real moderation queue
- Real attendance records
- Real ratings storage
- Payments
- Native mobile app
- AI matching
- DNDCards integration
- Private-home games

---

## Prototype Acceptance Test

A first-time visitor should be able to answer all of these after using the site for five minutes:

1. What is Dinner, Dice & Dragons?
2. How do I find a game?
3. What information tells me whether a table fits me?
4. How does the platform make meeting strangers safer?
5. How does a GM benefit?
6. Why would a restaurant or other venue participate?
7. What happens after a successful game?

If those answers are not obvious from the interface, the prototype is not done.

---

## North-Star Prototype Test

The prototype succeeds if a real local player, GM, or venue owner reacts with:

> “I understand this, and I would use it.”

That is the validation target before production backend work begins.
