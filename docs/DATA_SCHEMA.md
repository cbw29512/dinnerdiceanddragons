# Dinner, Dice & Dragons — MVP Data Schema

## Purpose
This schema supports the Florence pilot and maps cleanly to Google Sheets + Apps Script first, then PostgreSQL later.

## Core product rule

> A Game connects a Game Master, Players, and a Venue. The GM's availability anchors scheduling; the venue provides a compatible table window; players then discover and join the published game.

> Experience is system-specific and self-described. Community reputation is earned separately from completed platform activity.

## User and profiles

### User
`id`, `email`, `display_name`, `status`, `created_at`, `updated_at`, `last_login_at`

### PlayerProfile
`id`, `user_id`, `bio`, `postal_code`, `travel_radius_miles`, `availability_summary`, `preferred_format`, `willing_to_learn_new_system`, derived `games_attended_count`, derived `attendance_rate`

### GMProfile
`id`, `user_id`, `bio`, `postal_code`, `travel_radius_miles`, `beginner_friendly`, derived `games_hosted_count`, derived `player_seats_hosted_count`, derived `would_play_again_percent`, derived `reliability_score`

### GameSystem
`id`, `name`, `edition`, `slug`, `publisher_name`, `active`

### PlayerSystemExperience
`id`, `player_profile_id`, `game_system_id`, `years_playing`, `comfort_level`, `experience_notes`

Unique: `(player_profile_id, game_system_id)`

### GMSystemExperience
`id`, `gm_profile_id`, `game_system_id`, `years_playing`, `years_gming`, `comfort_level`, `preferred_player_experience`, `experience_notes`

Unique: `(gm_profile_id, game_system_id)`

### GMSystemFormat
`gm_system_experience_id`, `format`

Formats: `learn_to_play`, `one_shot`, `short_campaign`, `long_campaign`, `organized_play`

## Scheduling

### GMAvailabilityWindow
`id`, `gm_profile_id`, `day_of_week`, `start_time`, `end_time`, `recurrence`, `active`

### Venue
`id`, `name`, `slug`, `venue_type`, public address fields, `postal_code`, coordinates, website/phone, `verified`, amenities, accessibility/parking/noise/lighting notes, `active`

### VenueManager
`id`, `venue_id`, `user_id`, `role`, `verified_at`

### VenueTableWindow
`id`, `venue_id`, `day_of_week`, `start_time`, `end_time`, `table_count`, `max_people_per_table`, `purchase_policy`, `approval_required`, `notes`, `active`

### VenueBookingRequest
`id`, `venue_table_window_id`, `gm_profile_id`, `game_series_id` nullable, `event_id` nullable, `requested_start`, `requested_end`, `tables_requested`, `expected_guests`, `status`, `venue_message`, `gm_message`, timestamps

Status: `requested`, `question`, `approved`, `declined`, `cancelled`

## Games and recurrence

### GameSeries
Used for campaigns/recurring groups.

`id`, `title`, `gm_profile_id`, `game_system_id`, `venue_id`, `cadence`, `expected_sessions`, `starts_on`, `ends_on` nullable, `active`

Cadence: `one_time`, `weekly`, `every_other_week`, `monthly`, `custom`

### Event
One actual playable session.

`id`, `game_series_id` nullable, `slug`, `title`, `description`, `gm_profile_id`, `game_system_id`, `venue_id`, `event_type`, `join_mode`, `status`, `starts_at`, `ends_at`, `min_players`, `max_players`, `minimum_age`, `beginner_friendly`, timestamps

Status progression: `draft`, `venue_requested`, `venue_approved`, `published`, `forming`, `confirmed`, `full`, `cancelled`, `completed`

### TableExpectations
`id`, `event_id`, tone/age/style fields, PvP/homebrew/death policies, mature content, alcohol, new-player flag, breaks, safety framework, notes

### Registration
`id`, `event_id`, `player_profile_id`, `status`, expectations acknowledgement, requested/responded/cancelled timestamps

Status: `requested`, `confirmed`, `waitlisted`, `declined`, `cancelled`, `removed`

### Headcount rule
`expected_guests = GM count + confirmed registrations + explicitly registered assistants`

Never require manual venue headcount entry when it can be derived from registrations.

## Game Hub communication

### Message
`id`, `event_id`, `sender_user_id`, `channel_type`, `recipient_user_id` nullable, `venue_id` nullable, `category` nullable, `body`, `created_at`, `read_at` nullable, `moderation_status`

Channel types:
- `table_announcement` — GM/Venue/System → GM + confirmed Players + Venue
- `table_discussion` — GM + confirmed Players
- `gm_venue` — private GM ↔ Venue operations
- `player_gm` — private Player ↔ GM
- `player_venue_question` — structured Player ↔ Venue customer question
- `system_notification`

Player-to-venue categories: `accessibility`, `food_allergies`, `parking`, `seating`, `venue_policy`, `other`

Raw email addresses/home addresses are never exposed through messaging.

## Calendar

### CalendarEventSync
`id`, `event_id`, `provider`, `external_event_id`, `status`, `last_synced_at`, `sync_error`

Provider initially: `google_calendar`.

Confirmed events create/update the shared Dinner, Dice & Dragons calendar event. Cancellation/rescheduling must synchronize rather than create duplicates.

## Attendance and reputation

### Attendance
`id`, `event_id`, `player_profile_id`, `registration_id`, `status`, `recorded_by_user_id`, `recorded_at`, `notes`

Status: `attended`, `late_cancel`, `no_show`, `excused_absence`

### Feedback
`id`, `event_id`, `author_user_id`, `subject_type`, `subject_id`, structured boolean/scale signals, `private_comment`, `created_at`

Subject types: `event`, `gm`, `venue`, `table`

GM signals may include description accuracy, start reliability, boundaries respected, table respectful, would play again.

Venue signals may include table suitability, welcoming staff, noise suitability, accessibility accuracy, would play here again.

Venue → table signals evaluate the group/event, not individual customers: expected attendance reasonably matched, reserved time respected, issue/report, would host again.

Public trust signals use aggregate structured data with minimum sample thresholds. Free-text feedback is private by default.

## Venue analytics

### VenueEventMetrics
`id`, `event_id`, `venue_id`, `expected_guests`, `actual_guests`, `reserved_minutes`, `tables_used`, optional `venue_reported_sales`, `created_at`

Derived venue dashboard metrics:
- games hosted
- expected guest visits
- actual guest visits
- average party size
- average table duration
- repeat groups/campaigns
- cancellation/no-show rate

Sales are optional and only recorded when a venue voluntarily provides them.

## Safety

### Report
Private allegation/report record with reporter, event/subject/venue references, category, description, severity, status, timestamps.

### ModerationCase
Private administrative case with status, priority, moderator, subject, notes, timestamps.

Reports are never automatic public penalties.

## Relationship summary

```text
User
 ├── PlayerProfile ──< PlayerSystemExperience >── GameSystem
 ├── GMProfile ──< GMSystemExperience >── GameSystem
 │       └──< GMAvailabilityWindow
 └── VenueManager ──> Venue ──< VenueTableWindow

GMProfile ──< GameSeries ──< Event >── Venue
                         │
                         ├── Registration ──> PlayerProfile
                         ├── Message (role-aware Game Hub)
                         ├── CalendarEventSync
                         ├── Attendance
                         ├── Feedback
                         └── VenueEventMetrics
```

## Google Sheets MVP tabs

For the pilot, use stable IDs and these tabs:

`Users`, `Players`, `PlayerSystems`, `GMs`, `GMSystems`, `GMAvailability`, `Venues`, `VenueWindows`, `VenueBookingRequests`, `GameSeries`, `Games`, `Registrations`, `Messages`, `CalendarEvents`, `Attendance`, `Feedback`, `VenueMetrics`, `Reports`.

## Integrity rules

1. An Event cannot publish without a GM, GameSystem, venue, approved/valid schedule, and table expectations.
2. A venue must see recurrence, expected session count, expected headcount, and requested hours before approving a recurring booking.
3. Venue capacity/table inventory cannot be double-booked.
4. Expected headcount is derived from confirmed participants and updates when registrations change.
5. Players cannot see private GM/Venue operational messages.
6. Venues cannot see private Player/GM table discussion or private player profile data.
7. Private email/home-address data is never exposed as a messaging identifier.
8. Calendar sync must update an existing external event using its stored ID.
9. Public reputation is aggregate structured feedback; moderation reports remain private.
10. Self-described experience is never presented as platform-verified expertise.
11. Store timestamps timezone-aware; preserve venue timezone for display/scheduling.
12. The Sheets MVP must preserve stable IDs so migration to PostgreSQL does not require changing public identifiers.
