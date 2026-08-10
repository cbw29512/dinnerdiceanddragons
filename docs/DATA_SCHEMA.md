# Dinner, Dice & Dragons — MVP Data Schema

## Purpose

This schema supports the Table Match product model and keeps the pilot migratable to a relational production backend later.

## Core product rule

A successful table forms from the overlap of three structured signals:

- Player demand
- GM availability/capability
- Venue capacity

The Game is created from a viable Table Match rather than being the only source of discovery.

Experience is system-specific and self-described. Community reputation is earned separately from completed platform activity.

## Users and role profiles

### User
`id`, `email`, `display_name`, `status`, `created_at`, `updated_at`, `last_login_at`

### PlayerProfile
`id`, `user_id`, `bio`, `postal_code`, `travel_radius_miles`, `preferred_format`, `willing_to_learn_new_system`, `environment_preferences`, `accessibility_notes_private`, derived `games_attended_count`, derived `attendance_rate`

### GMProfile
`id`, `user_id`, `bio`, `postal_code`, `travel_radius_miles`, `beginner_friendly`, `gm_style`, derived `games_hosted_count`, derived `player_seats_hosted_count`, derived `would_play_again_percent`, derived `reliability_score`

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

## Availability and demand

### PlayerAvailabilityWindow
`id`, `player_profile_id`, `day_of_week`, `start_time`, `end_time`, `recurrence`, `timezone`, `active`

### GMAvailabilityWindow
`id`, `gm_profile_id`, `day_of_week`, `start_time`, `end_time`, `recurrence`, `timezone`, `active`

### PlayerDemandSignal
A structured expression that a Player wants a kind of local game.

`id`, `player_profile_id`, `game_system_id`, `preferred_format`, `preferred_cadence`, `minimum_age_preference`, `table_style_preferences`, `environment_preferences`, `status`, `created_at`, `updated_at`

Status: `active`, `paused`, `matched`, `expired`

A demand signal references the Player's current location radius and availability windows rather than duplicating private location data.

### GMSupplySignal
A structured expression that a GM is willing to form/run a kind of table.

`id`, `gm_profile_id`, `game_system_id`, `preferred_format`, `preferred_cadence`, `minimum_players`, `maximum_players`, `table_style`, `status`, `created_at`, `updated_at`

Status: `active`, `paused`, `matched`, `expired`

## Venue supply

### Venue
`id`, `name`, `slug`, `venue_type`, public address fields, `postal_code`, coordinates, website/phone, `verified`, amenities, accessibility/parking/noise/lighting notes, `active`

### VenueManager
`id`, `venue_id`, `user_id`, `role`, `verified_at`

### VenueTableWindow
`id`, `venue_id`, `day_of_week`, `start_time`, `end_time`, `table_count`, `max_people_per_table`, `recurrence`, `purchase_policy`, `approval_required`, `environment_notes`, `active`

## Table Match

### TableMatch
Represents a potential viable overlap before a published game exists.

`id`, `gm_supply_signal_id`, `venue_table_window_id`, `game_system_id`, `proposed_start`, `proposed_end`, `timezone`, `minimum_players`, `maximum_players`, `compatible_player_count`, `distance_summary`, `status`, `created_at`, `updated_at`

Status: `potential`, `invited`, `forming`, `rejected`, `expired`, `converted`

### TableMatchPlayer
Stores which Player demand signals are compatible with a Table Match without publicly exposing those Players as a list before they choose to commit.

`table_match_id`, `player_demand_signal_id`, `fit_flags`, `distance_miles`, `availability_overlap`, `status`

Status: `eligible`, `notified`, `interested`, `declined`, `committed`

### MatchExplanation
Optional normalized record for explainable criteria.

`id`, `table_match_id`, `criterion`, `result`, `summary`, `weight` nullable

Example criteria: system, schedule, distance, experience, format, play_style, environment, accessibility, venue_capacity.

Do not expose an unexplained compatibility percentage without the underlying criteria.

## Venue booking

### VenueBookingRequest
`id`, `venue_table_window_id`, `gm_profile_id`, `table_match_id` nullable, `game_series_id` nullable, `event_id` nullable, `requested_start`, `requested_end`, `tables_requested`, `expected_guests`, `status`, `venue_message`, `gm_message`, timestamps

Status: `requested`, `question`, `approved`, `declined`, `cancelled`

## Games and recurrence

### GameSeries
Used for campaigns/recurring groups.

`id`, `table_match_id` nullable, `title`, `gm_profile_id`, `game_system_id`, `venue_id`, `cadence`, `expected_sessions`, `starts_on`, `ends_on` nullable, `active`

Cadence: `one_time`, `weekly`, `every_other_week`, `monthly`, `custom`

### Event
One actual playable session.

`id`, `game_series_id` nullable, `table_match_id` nullable, `slug`, `title`, `description`, `gm_profile_id`, `game_system_id`, `venue_id`, `event_type`, `join_mode`, `status`, `starts_at`, `ends_at`, `min_players`, `max_players`, `minimum_age`, `beginner_friendly`, timestamps

Status progression: `draft`, `venue_requested`, `forming`, `confirmed`, `full`, `cancelled`, `completed`

A `forming` event can accept commitments. A `confirmed` event has satisfied the venue and minimum-Player requirements defined for that table.

### TableExpectations
`id`, `event_id`, tone/age/style fields, PvP/homebrew/death policies, mature content, alcohol, new-player flag, breaks, safety framework, environment notes, accessibility notes, other notes

### Registration
`id`, `event_id`, `player_profile_id`, `status`, expectations_acknowledged_at`, `requested_at`, `responded_at`, `cancelled_at`

Status: `requested`, `confirmed`, `waitlisted`, `declined`, `cancelled`, `removed`

### Headcount rule

`expected_guests = GM count + confirmed registrations + explicitly registered assistants`

Venue headcount should be derived, not manually maintained when registrations are available.

## Game Hub communication

### Message
`id`, `event_id`, `sender_user_id`, `channel_type`, `recipient_user_id` nullable, `venue_id` nullable, `category` nullable, `body`, `created_at`, `read_at` nullable, `moderation_status`

Channel types:
- `table_announcement` — GM/Venue/System → relevant table participants
- `table_discussion` — GM + confirmed Players
- `gm_venue` — private GM ↔ Venue operations
- `player_gm` — private Player ↔ GM
- `player_venue_question` — structured Player ↔ Venue question
- `system_notification`

Player-to-venue categories: `accessibility`, `food_allergies`, `parking`, `seating`, `venue_policy`, `other`

Raw email addresses and home addresses are never exposed as messaging identifiers.

## Calendar

### CalendarEventSync
`id`, `event_id`, `provider`, `external_event_id`, `status`, `last_synced_at`, `sync_error`

Confirmed events create/update the appropriate shared calendar record. Rescheduling updates the stored external event rather than creating duplicates.

## Attendance and reputation

### Attendance
`id`, `event_id`, `player_profile_id`, `registration_id`, `status`, `recorded_by_user_id`, `recorded_at`, `notes`

Status: `attended`, `late_cancel`, `no_show`, `excused_absence`

### Feedback
`id`, `event_id`, `author_user_id`, `subject_type`, `subject_id`, structured signals, `private_comment`, `created_at`

Subject types: `event`, `gm`, `venue`, `table`

GM signals may include description accuracy, start reliability, boundaries respected, table respect, and would-play-again.

Venue signals may include table suitability, welcoming staff, noise suitability, accessibility accuracy, and would-return.

Venue → table signals evaluate the group/event rather than publicly rating individual customers.

Public trust signals use aggregate structured data with minimum sample thresholds. Free-text feedback is private by default.

## Venue analytics

### VenueEventMetrics
`id`, `event_id`, `venue_id`, `expected_guests`, `actual_guests`, `reserved_minutes`, `tables_used`, optional `venue_reported_sales`, `created_at`

Derived venue metrics:
- games hosted
- expected guest visits
- actual guest visits
- average party size
- average table duration
- repeat groups/campaigns
- cancellation/no-show rate

Sales are optional and only stored when voluntarily provided by the venue.

## Safety

### Report
Private allegation/report record with reporter, event/subject/venue references, category, description, severity, status, timestamps.

### ModerationCase
Private administrative case with status, priority, moderator, subject, notes, timestamps.

Reports are never automatic public penalties.

## Relationship summary

```text
User
 ├── PlayerProfile
 │     ├──< PlayerAvailabilityWindow
 │     ├──< PlayerSystemExperience >── GameSystem
 │     └──< PlayerDemandSignal
 │
 ├── GMProfile
 │     ├──< GMAvailabilityWindow
 │     ├──< GMSystemExperience >── GameSystem
 │     └──< GMSupplySignal
 │
 └── VenueManager ──> Venue ──< VenueTableWindow

PlayerDemandSignal ──< TableMatchPlayer >── TableMatch
GMSupplySignal ──────────────────────────────┘
VenueTableWindow ────────────────────────────┘

TableMatch ──> GameSeries ──< Event
                              ├── Registration ──> PlayerProfile
                              ├── Message
                              ├── CalendarEventSync
                              ├── Attendance
                              ├── Feedback
                              └── VenueEventMetrics
```

## Controlled-pilot tab concept

If Sheets is used temporarily, the minimum logical collections become:

`Users`, `Players`, `PlayerAvailability`, `PlayerSystems`, `PlayerDemand`, `GMs`, `GMAvailability`, `GMSystems`, `GMSupply`, `Venues`, `VenueWindows`, `TableMatches`, `TableMatchPlayers`, `VenueBookingRequests`, `GameSeries`, `Games`, `Registrations`, `Messages`, `CalendarEvents`, `Attendance`, `Feedback`, `VenueMetrics`, `Reports`.

This tab list is conceptual until the controlled-pilot implementation is deliberately resumed.

## Integrity rules

1. A Table Match must reference a GM supply signal, venue window, system, proposed time, and explainable compatibility information.
2. Player compatibility must be evaluated against Player availability and travel radius without exposing private home locations to other users.
3. An Event cannot become Forming without a GM, system, proposed/approved public venue, valid schedule, seat range, and table expectations.
4. An Event cannot become Confirmed until venue approval requirements and minimum Player commitment are satisfied.
5. Venue capacity cannot be double-booked.
6. Expected headcount updates when registrations change.
7. Players cannot see private GM/Venue operational messages.
8. Venues cannot see private Player/GM table discussion or unnecessary Player profile data.
9. Private email/home-address data is never exposed as a messaging identifier.
10. Public reputation is aggregate structured feedback; moderation reports remain private.
11. Self-described experience is never presented as platform-verified expertise.
12. Store timestamps timezone-aware and preserve venue timezone for display/scheduling.
13. Stable IDs should survive migration between pilot and production storage.
