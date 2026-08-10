# Dinner, Dice & Dragons — Three-Way Game Hub

## Product rule

The Game is the shared coordination object connecting all three parties:

```text
                    GAME HUB
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      GAME MASTER    PLAYERS       VENUE
```

Communication is three-way, but permissions are role-aware. The platform must give the venue useful headcount and recurrence information without exposing private player data or forcing the restaurant to manage the game.

## Venue needs to know

For every upcoming game/session:
- game title/system
- GM display name
- date and start/end time
- recurring cadence and expected number of sessions
- tables reserved
- expected total guests = GM + confirmed players
- confirmed players count
- seats still open
- expected vs actual attendance after the event
- purchase/table policy
- current game status

The venue does not need player home addresses, personal email addresses, experience notes, moderation history, or private table discussion.

## Game Hub communication channels

### Table Announcements
Visible to GM, confirmed Players, and Venue.
- GM may post logistical/game announcements.
- Venue may post venue-wide logistics such as parking, room changes, check-in instructions, closures, or policy reminders.
- System may post confirmation, cancellation, headcount, and reminder notices.

### Table Discussion
Visible to GM and confirmed Players.
- character coordination
- game questions
- arrival coordination
- campaign/session discussion

The venue is not expected to monitor RPG chatter.

### GM ↔ Venue
Private operational channel.
- booking request
- table availability questions
- expected headcount
- schedule changes
- recurring-session coordination
- venue concerns

### Player → Venue Questions
Structured contact for legitimate customer questions without exposing private contact information.
Categories:
- accessibility
- food/allergies
- parking
- seating
- venue policy
- other

Venue replies may be private or, when appropriate, promoted into the venue FAQ.

## Headcount logic

`expected_guests = 1 GM + confirmed player registrations + other explicitly registered table staff/assistants`

Headcount updates whenever a registration becomes confirmed/cancelled/removed or a waitlisted seat is filled.

The venue dashboard should show both expected and actual attendance.

## Recurring games

Games/campaigns may be:
- one_time
- weekly
- every_other_week
- monthly
- custom

The venue must see the recurrence before approving the booking. Each generated session remains independently cancellable/reschedulable while retaining its campaign/series relationship.

## Venue analytics

Pilot metrics should include:
- games hosted
- expected guest visits
- actual guest visits
- average party size
- average table duration
- repeat campaigns/groups
- no-show/cancellation rate

Sales/revenue data is optional and should only be collected if a venue explicitly chooses to provide it.

## Feedback

### Players → GM
Structured aggregate trust signals such as description accuracy, table respect, and would-play-again.

### Players/GM → Venue
- table space suitable
- staff welcoming
- noise appropriate
- accessibility information accurate
- would play here again

### Venue → Table
Rate the table/event, not individual customers:
- expected attendance reasonably matched
- reserved time respected
- issue/report
- would host this group again

## Privacy

- Never publicly expose private email addresses or home addresses.
- Platform messages use user/venue identities, not raw contact details.
- Moderation reports are private.
- Player-to-venue questions do not grant the venue access to the player's private profile data.
- Public reputation is derived from structured aggregate signals, never unreviewed accusations.

## MVP implementation sequence

1. Game Hub prototype page with three role views.
2. Live expected-headcount calculation from registrations.
3. Recurrence/campaign fields in game creation.
4. Venue upcoming-groups dashboard.
5. Role-aware message records and announcements.
6. Calendar synchronization.
7. Attendance and post-game feedback.
8. Google Sheets + Apps Script persistence for Florence pilot.
