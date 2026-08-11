# Dinner, Dice & Dragons — GameSeries Model

## Purpose

A recurring Table Match should become one durable `GameSeries` plus individual session records. The series preserves continuity; sessions preserve real-world flexibility.

## Core Model

```text
Recurring Table Match
        ↓
GM reviews venue + Player requests
        ↓
GameSeries
        ↓
Session 1
Session 2
Session 3
...
```

The series owns shared identity such as title, GM, system, primary venue, recurrence, table expectations, and commitment model.

Each session owns its real date, status, venue approval, Player registrations, waitlist, cancellation/reschedule exception, attendance, completion, and reputation eligibility.

## GM as Table Coordinator

The Game Master is the primary operational point of contact for the table.

### The GM controls
- which compatible venue option becomes the table's selected venue
- which Player join requests are accepted or declined
- core-party membership
- session-only Player approval where applicable
- table expectations and game-specific requirements
- operational communication with the venue
- headcount changes and session coordination

### The Venue controls
- whether its space is actually available
- whether a requested booking is approved or declined
- venue policies, hours, capacity, and operational restrictions
- venue-side cancellations/reschedules

The venue does **not** choose the Player roster.

### The Player controls
- whether to request a seat
- whether to accept table expectations
- whether to commit to a whole series or eligible individual sessions
- their own attendance intent and cancellation actions

A Player request does not become a confirmed seat until the GM accepts it.

A venue recommendation does not become the table's primary venue until the GM accepts that option. Production booking may then require the venue to confirm the request as a second approval.

## Two-Sided Venue Agreement

Venue use is intentionally mutual:

```text
Venue offers compatible capacity
        ↓
GM accepts venue
        ↓
Venue confirms booking
        ↓
Venue agreement complete
```

Neither side can unilaterally force the arrangement.

## Player Approval Flow

```text
Compatible Player sees table
        ↓
Player requests to join
        ↓
GM reviews request
        ↓
Accept → confirmed/core/session seat
Decline → no seat; no public reputation penalty
```

Declining a join request must not create a public negative reputation event for either party.

## Commitment Models

### Whole Series
Best for campaigns. A GM-approved Player joins the recurring group and is provisionally expected for future sessions, while remaining able to cancel individual occurrences.

### Session-by-Session
Best for recurring one-shots, organized play, and drop-in tables. Players request eligible dates independently and the GM approves seats.

### Hybrid
A GM-approved stable core party commits to the series while remaining seats can be filled by GM-approved session guests or a waitlist.

## Rules

1. The GM is the table coordinator and approval authority for Player roster and selected venue option.
2. Venue booking requires venue-side agreement when venue approval is required.
3. Joining a whole series does not prohibit individual-session cancellation.
4. Cancelling one occurrence does not remove the Player from the series unless they explicitly leave the series.
5. A GM can cancel/reschedule one session without ending the series.
6. Venue conflicts create session exceptions, not recurrence changes by default.
7. Each session independently satisfies `GM-selected venue + venue approved when required + minimum GM-approved Players = Confirmed`.
8. Each session independently records attendance and creates reputation evidence after completion.
9. Series-level statistics may summarize sessions, but session records remain authoritative.
10. A moved session keeps its relationship to the original recurrence occurrence for audit/history.
11. Whole-series commitment should make future session management easier, not turn life events into automatic penalties.
12. Ending a series is a distinct action from cancelling a session.
13. Declined Player requests are private workflow outcomes, not reputation events.
14. The production authorization layer must enforce that only the series GM (or authorized moderator/admin) can approve/remove Players or choose the table venue.

## Prototype Storage

The current GitHub Pages prototype stores the selected recurring match in `sessionStorage` and the created Forming GameSeries/commitment state in `localStorage`.

This is validation behavior only. Production storage must use durable authenticated records and server-side role permissions. Client-side controls alone are not authorization.
