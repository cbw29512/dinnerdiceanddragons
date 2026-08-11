# Series Commitments

## Purpose

Recurring campaigns need continuity without pretending every core Player can attend every occurrence. Commitment planning is separate from cancellation and reputation.

## Core concepts

### Core Player
A Player who belongs to the recurring series. Core membership represents continuity, not guaranteed attendance for every session.

### Attendance intent
Each core Player can mark each upcoming session as:

- `yes`
- `unsure`
- `no`

A `no` entered during normal planning is not a cancellation event and has no negative reputation effect.

### Session-only guest
A Player participating in one occurrence without becoming a core series member.

### Waitlist
Eligible Players who can be promoted if a seat opens for a specific session.

## Session health

Expected attendance = core Players marked `yes` + confirmed session-only guests.

- **At risk** — expected attendance is below `min_players`.
- **Open seats** — minimum is met but attendance is below `max_players`.
- **Full / healthy** — expected attendance has reached maximum seats.

`unsure` Players do not count toward confirmed expected attendance until they change to `yes`.

## Recovery order

When a session is at risk:

1. Notify core Players still marked `unsure`.
2. Promote eligible waitlisted Players when seats are available.
3. Surface session-only openings to compatible nearby Players.
4. Consider a one-session venue/date recovery if logistics caused the deficit.
5. Cancel only if the session cannot meet its viability rules.

Recovery should preserve the GameSeries and future sessions whenever possible.

## Fairness and reputation

Planning ahead must not be punished.

- Marking `no` before a session is a planning signal, not negative reputation.
- A later cancellation after a confirmed commitment is governed by the cancellation policy.
- A no-show is only created after the session occurs and attendance is recorded.
- Leaving the core party is separate from cancelling one session.
- New Players and session-only guests remain eligible for open seats based on Table Fit, not platform seniority.

## Future data model

### SeriesMembership
`id`, `game_series_id`, `player_profile_id`, `status`, `joined_at`, `left_at` nullable

Status: `core`, `inactive`, `left`, `removed`

### SessionAttendanceIntent
`id`, `event_id`, `player_profile_id`, `intent`, `updated_at`

Intent: `yes`, `unsure`, `no`

### SessionGuestRegistration
Use normal Event Registration records for session-only guests and waitlisted Players. Do not create a second reputation path for guests.

## Product rule

A recurring series should proactively identify weak future dates while there is still time to recover them. The goal is to help the table happen, not to punish people for honest availability.