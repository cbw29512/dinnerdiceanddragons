# Dinner, Dice & Dragons — MVP Data Schema

## Purpose

This schema supports Table Match, identity, recurring availability, and an earned reputation system that does not penalize newcomers.

## Core product rule

A successful table forms from Player demand + GM availability/capability + Venue capacity.

Experience is system-specific and self-described. Reputation is derived from verified platform activity. **No reputation history is neutral, never negative.**

## Identity

### User
`id`, `auth_provider_user_id`, `email`, `email_verified_at`, `display_name`, `display_name_normalized`, `status`, `created_at`, `updated_at`, `last_login_at`

Unique: `auth_provider_user_id`, `email`, `display_name_normalized`

Normalize display names for uniqueness by trimming whitespace and applying a consistent case-folding rule. Reserve platform/system names such as admin, moderator, support, staff, and brand names.

Status: `pending_verification`, `active`, `restricted`, `suspended`, `banned`

### UserRole
`user_id`, `role`, `verified_at` nullable

Roles: `player`, `gm`, `venue_manager`, `moderator`, `admin`

A single User may hold multiple roles. Do not create separate identities for Player and GM participation.

### PlayerProfile
`id`, `user_id`, `bio`, `postal_code`, `travel_radius_miles`, `preferred_format`, `willing_to_learn_new_system`, `environment_preferences`, `accessibility_notes_private`

### GMProfile
`id`, `user_id`, `bio`, `postal_code`, `travel_radius_miles`, `beginner_friendly`, `gm_style`

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

### RecurringAvailabilityRule
Reusable schedule rule referenced by Player, GM, or Venue availability.

`id`, `owner_type`, `owner_id`, `day_of_week`, `start_time`, `end_time`, `pattern_type`, `week_interval` nullable, `anchor_date` nullable, `monthly_ordinal` nullable, `month_interval` nullable, `timezone`, `starts_on` nullable, `ends_on` nullable, `active`, `created_at`, `updated_at`

Owner types: `player`, `gm`, `venue`

Pattern types:
- `weekly_interval` — every N weeks on a weekday; `week_interval` is 1–4
- `monthly_ordinal_weekday` — First/Second/Third/Fourth/Last weekday of every N months

Rules:
- `week_interval > 1` requires `anchor_date` so alternating cycles are deterministic.
- `monthly_ordinal_weekday` requires `monthly_ordinal` and `month_interval`.
- Multiple rules per owner are allowed and combined as an OR set. Example: every other Wednesday **or** the last Saturday of every month.
- Availability rules describe recurring opportunity windows, not guaranteed attendance for every occurrence.

### PlayerAvailabilityWindow
`id`, `player_profile_id`, `recurring_rule_id`, `active`

### GMAvailabilityWindow
`id`, `gm_profile_id`, `recurring_rule_id`, `active`

### PlayerDemandSignal
`id`, `player_profile_id`, `game_system_id`, `preferred_format`, `preferred_cadence`, `minimum_age_preference`, `table_style_preferences`, `environment_preferences`, `status`, `created_at`, `updated_at`

Status: `active`, `paused`, `matched`, `expired`

### GMSupplySignal
`id`, `gm_profile_id`, `game_system_id`, `preferred_format`, `preferred_cadence`, `minimum_players`, `maximum_players`, `table_style`, `status`, `created_at`, `updated_at`

Status: `active`, `paused`, `matched`, `expired`

## Venue supply

### Venue
`id`, `name`, `slug`, `venue_type`, public address fields, `postal_code`, coordinates, website/phone, `verified`, amenities, accessibility/parking/noise/lighting notes, `active`

### VenueManager
`id`, `venue_id`, `user_id`, `role`, `verified_at`

### VenueTableWindow
`id`, `venue_id`, `recurring_rule_id`, `table_count`, `max_people_per_table`, `purchase_policy`, `approval_required`, `environment_notes`, `active`

## Table Match

### TableMatch
`id`, `gm_supply_signal_id`, `venue_table_window_id`, `game_system_id`, `proposed_start`, `proposed_end`, `timezone`, `minimum_players`, `maximum_players`, `compatible_player_count`, `distance_summary`, `fit_score`, `status`, `created_at`, `updated_at`

Status: `potential`, `invited`, `forming`, `rejected`, `expired`, `converted`

`fit_score` measures table compatibility. It must not be reduced merely because the GM or Players lack platform reputation history.

### TableMatchPlayer
`table_match_id`, `player_demand_signal_id`, `fit_flags`, `distance_miles`, `availability_overlap`, `status`

Status: `eligible`, `notified`, `interested`, `declined`, `committed`

### MatchExplanation
`id`, `table_match_id`, `criterion`, `result`, `summary`, `weight` nullable

Example criteria: system, schedule, distance, experience, format, play_style, environment, accessibility, venue_capacity.

**Reputation is not a hard Table Match criterion.** Verified reliability may be used as a limited tie-breaker or caution signal after viable matches are established. Missing reputation history contributes zero positive and zero negative adjustment.

## Venue booking

### VenueBookingRequest
`id`, `venue_table_window_id`, `gm_profile_id`, `table_match_id` nullable, `game_series_id` nullable, `event_id` nullable, `requested_start`, `requested_end`, `tables_requested`, `expected_guests`, `status`, `venue_message`, `gm_message`, timestamps

Status: `requested`, `question`, `approved`, `declined`, `cancelled`

## Games and recurrence

### GameSeries
`id`, `table_match_id` nullable, `title`, `gm_profile_id`, `game_system_id`, `venue_id`, `recurring_rule_id` nullable, `expected_sessions`, `starts_on`, `ends_on` nullable, `active`

A recurring GameSeries may reuse a `RecurringAvailabilityRule`, but generated Events remain independent records so an individual occurrence can be cancelled/rescheduled without destroying the series.

### Event
`id`, `game_series_id` nullable, `table_match_id` nullable, `slug`, `title`, `description`, `gm_profile_id`, `game_system_id`, `venue_id`, `event_type`, `join_mode`, `status`, `starts_at`, `ends_at`, `min_players`, `max_players`, `minimum_age`, `beginner_friendly`, timestamps

Status: `draft`, `venue_requested`, `forming`, `confirmed`, `full`, `cancelled`, `completed`

### TableExpectations
`id`, `event_id`, tone/age/style fields, PvP/homebrew/death policies, mature content, alcohol, new-player flag, breaks, safety framework, environment notes, accessibility notes, other notes

### Registration
`id`, `event_id`, `player_profile_id`, `status`, expectations_acknowledged_at`, `requested_at`, `responded_at`, `cancelled_at`

Status: `requested`, `confirmed`, `waitlisted`, `declined`, `cancelled`, `removed`

`expected_guests = GM count + confirmed registrations + explicitly registered assistants`

## Game Hub communication

### Message
`id`, `event_id`, `sender_user_id`, `channel_type`, `recipient_user_id` nullable, `venue_id` nullable, `category` nullable, `body`, `created_at`, `read_at` nullable, `moderation_status`

Channel types: `table_announcement`, `table_discussion`, `gm_venue`, `player_gm`, `player_venue_question`, `system_notification`

Raw email addresses and home addresses are never exposed as messaging identifiers.

## Calendar

### CalendarEventSync
`id`, `event_id`, `provider`, `external_event_id`, `status`, `last_synced_at`, `sync_error`

## Attendance and reputation

### Attendance
`id`, `event_id`, `player_profile_id`, `registration_id`, `status`, `recorded_by_user_id`, `recorded_at`, `notes`

Status: `attended`, `late_cancel`, `no_show`, `excused_absence`

### Feedback
`id`, `event_id`, `author_user_id`, `subject_type`, `subject_id`, structured signals, `private_comment`, `created_at`

Feedback eligibility requires a verified relationship to the completed Event. Drive-by ratings are prohibited.

### ReputationEvent
Immutable evidence record from which reputation aggregates are derived.

`id`, `subject_user_id` nullable, `subject_venue_id` nullable, `event_id`, `event_type`, `source_record_type`, `source_record_id`, `occurred_at`, `created_at`

Examples: `session_attended`, `session_hosted_completed`, `late_cancel`, `no_show`, `venue_hosted_completed`, `gm_description_accurate`, `gm_would_play_again`, `venue_would_return`.

A ReputationEvent is created only from an eligible verified platform interaction. Do not allow clients to directly submit arbitrary ReputationEvents.

### ReputationSnapshot
Derived/cacheable public-safe summary.

`id`, `subject_type`, `subject_id`, `history_state`, `verified_sessions`, `attendance_rate` nullable, `completion_rate` nullable, `would_repeat_percent` nullable, `late_cancellations`, `no_shows`, `sample_size`, `calculated_at`

Subject types: `player`, `gm`, `venue`

History states:
- `new` — insufficient verified history; public label **New to DDD**
- `building` — some verified history; aggregates may remain hidden where sample size is too small
- `established` — sufficient history for meaningful aggregates
- `caution` — verified reliability thresholds have been crossed under published policy

### Reputation invariants

1. `history_state = new` is neutral.
2. New users receive no negative match adjustment.
3. Missing metrics display as **Not enough history yet**, never zero percent.
4. Public aggregate feedback requires a minimum sample threshold.
5. Self-reported years of experience never alter verified reputation metrics.
6. Reports and allegations do not directly modify public reputation.
7. Moderation actions and reputation calculations remain separate systems.
8. Reputation is recalculated from immutable evidence; public counters are not authoritative source records.
9. A single negative interaction must not automatically create a public caution label.
10. Ranking logic must be auditable for newcomer disadvantage.

### FairDiscoveryAudit
Optional analytics record used to detect whether ranking systematically disadvantages newcomers.

`id`, `subject_user_id`, `history_state_at_time`, `surface`, `eligible_match_count`, `impressions`, `join_requests_or_invites`, `successful_matches`, `period_start`, `period_end`

This is product fairness telemetry, not a public score.

## Venue analytics

### VenueEventMetrics
`id`, `event_id`, `venue_id`, `expected_guests`, `actual_guests`, `reserved_minutes`, `tables_used`, optional `venue_reported_sales`, `created_at`

## Safety

### Report
Private allegation/report record with reporter, event/subject/venue references, category, description, severity, status, timestamps.

### ModerationCase
Private administrative case with status, priority, moderator, subject, notes, timestamps.

Reports are never automatic public penalties.

## Integrity rules

1. Display names are unique after normalization; internal User IDs remain the durable identity.
2. A Table Match must reference a GM supply signal, venue window, system, proposed time, and explainable compatibility information.
3. Player compatibility must respect availability and travel radius without exposing private home locations.
4. Recurring schedule matching must resolve the actual occurrence dates from each rule, including anchor dates and ordinal weekdays.
5. Missing reputation history never reduces Table Match eligibility or fit score.
6. Reputation may not be used as a hard requirement for ordinary table discovery unless a narrowly defined safety/moderation restriction applies.
7. Event feedback requires eligible participation in that Event.
8. Public reputation is derived from verified ReputationEvents and minimum sample thresholds.
9. Reports remain private and separate from reputation.
10. An Event cannot become Confirmed until venue approval requirements and minimum Player commitment are satisfied.
11. Venue capacity cannot be double-booked.
12. Expected headcount updates when registrations change.
13. Private email/home-address data is never exposed as a messaging identifier.
14. Self-described experience is never presented as platform-verified expertise.
15. Store timestamps timezone-aware and preserve venue timezone for display/scheduling.
16. Stable IDs survive migration between pilot and production storage.
