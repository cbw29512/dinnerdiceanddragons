# Dinner, Dice & Dragons — GameSeries Model

## Purpose

A recurring Table Match should become one durable `GameSeries` plus individual session records. The series preserves continuity; sessions preserve real-world flexibility.

## Core Model

```text
Recurring Table Match
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

## Commitment Models

### Whole Series
Best for campaigns. A Player joins the recurring group and is provisionally expected for future sessions, while remaining able to cancel individual occurrences.

### Session-by-Session
Best for recurring one-shots, organized play, and drop-in tables. Players choose dates independently.

### Hybrid
A stable core party commits to the series while remaining seats can be filled by session guests or a waitlist.

## Rules

1. Joining a whole series does not prohibit individual-session cancellation.
2. Cancelling one occurrence does not remove the Player from the series unless they explicitly leave the series.
3. A GM can cancel/reschedule one session without ending the series.
4. Venue conflicts create session exceptions, not recurrence changes by default.
5. Each session independently satisfies `venue approved + minimum Players = Confirmed`.
6. Each session independently records attendance and creates reputation evidence after completion.
7. Series-level statistics may summarize sessions, but session records remain authoritative.
8. A moved session keeps its relationship to the original recurrence occurrence for audit/history.
9. Whole-series commitment should make future session management easier, not turn life events into automatic penalties.
10. Ending a series is a distinct action from cancelling a session.

## Prototype Storage

The current GitHub Pages prototype stores the selected recurring match in `sessionStorage` and the created Forming GameSeries preview in `localStorage`.

This is validation behavior only. Production storage must use durable authenticated records and role permissions.
