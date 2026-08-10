# Dinner, Dice & Dragons — Initial Data Schema

## Purpose

This is the logical data model for the future production application. The GitHub Pages prototype may use static sample JSON, but sample data should mirror this schema so the prototype can migrate cleanly to FastAPI + PostgreSQL later.

The central modeling rule is:

> Users discover Events. Events connect Players, Game Masters, and Venues.

A second core rule is:

> Experience is system-specific and self-described; community reputation is earned separately from completed platform activity.

---

## Core Entities

### User
- `id` UUID
- `email` string, unique
- `display_name` string
- `status` enum: active, suspended, banned, deleted
- `created_at` timestamp
- `updated_at` timestamp
- `last_login_at` timestamp nullable

A user may have a PlayerProfile, GMProfile, VenueManager relationship, Moderator role, or several of these.

---

### PlayerProfile
- `id` UUID
- `user_id` FK -> User
- `bio` text nullable
- `travel_radius_miles` integer nullable
- `availability_summary` text nullable
- `preferred_format` enum nullable: any, learn_to_play, one_shot, short_campaign, long_campaign, organized_play
- `willing_to_learn_new_system` enum: yes, maybe, no
- `games_attended_count` integer derived/cache
- `attendance_rate` decimal derived/cache
- `created_at` timestamp
- `updated_at` timestamp

Do not store one global player skill level. System-specific experience belongs in PlayerSystemExperience.

---

### GMProfile
- `id` UUID
- `user_id` FK -> User
- `bio` text nullable
- `beginner_friendly` boolean
- `games_hosted_count` integer derived/cache
- `player_seats_hosted_count` integer derived/cache
- `would_play_again_percent` decimal derived/cache nullable
- `reliability_score` decimal derived/cache nullable
- `communication_score` decimal derived/cache nullable
- `created_at` timestamp
- `updated_at` timestamp

Do not store one global GM skill rating. System-specific experience belongs in GMSystemExperience.

---

### GameSystem
- `id` UUID
- `name` string
- `edition` string nullable
- `slug` string unique
- `publisher_name` string nullable
- `active` boolean

Examples: D&D 5e 2014, D&D 5e 2024, Pathfinder 2e, Call of Cthulhu 7e, Cyberpunk RED, Shadowrun, Other.

---

### PlayerSystemExperience

Self-described player experience for one system/edition.

Fields:
- `id` UUID
- `player_profile_id` FK -> PlayerProfile
- `game_system_id` FK -> GameSystem
- `years_playing` decimal nullable
- `comfort_level` enum: new, learning, comfortable, very_experienced
- `experience_notes` text nullable
- `created_at` timestamp
- `updated_at` timestamp

Unique constraint:
- `(player_profile_id, game_system_id)`

Rule:
- This is self-reported profile information, not a community rating.

---

### GMSystemExperience

Self-described GM experience for one system/edition.

Fields:
- `id` UUID
- `gm_profile_id` FK -> GMProfile
- `game_system_id` FK -> GameSystem
- `years_playing` decimal nullable
- `years_gming` decimal nullable
- `comfort_level` enum: learning, comfortable, very_comfortable, expert
- `preferred_player_experience` string nullable
- `experience_notes` text nullable
- `created_at` timestamp
- `updated_at` timestamp

Unique constraint:
- `(gm_profile_id, game_system_id)`

---

### GMSystemFormat

Many-to-many list of formats a GM is comfortable running for a specific system.

Fields:
- `gm_system_experience_id` FK -> GMSystemExperience
- `format` enum: learn_to_play, one_shot, short_campaign, long_campaign, organized_play

Composite primary key:
- `(gm_system_experience_id, format)`

---

### Venue
- `id` UUID
- `name` string
- `slug` string unique
- `description` text nullable
- `venue_type` enum: restaurant, brewery, cafe, game_store, library, community_center, other
- `address_line_1` string
- `address_line_2` string nullable
- `city` string
- `state_region` string
- `postal_code` string
- `country_code` string
- `latitude` decimal nullable
- `longitude` decimal nullable
- `website_url` string nullable
- `phone` string nullable
- `verified` boolean
- `active` boolean
- `serves_food` boolean
- `serves_alcohol` boolean
- `wifi_available` boolean nullable
- `power_available` boolean nullable
- `parking_notes` text nullable
- `noise_level` enum nullable: quiet, moderate, lively
- `lighting_notes` text nullable
- `accessibility_notes` text nullable
- `created_at` timestamp
- `updated_at` timestamp

---

### VenueManager
- `id` UUID
- `venue_id` FK -> Venue
- `user_id` FK -> User
- `role` enum: owner, manager, staff
- `verified_at` timestamp nullable
- `created_at` timestamp

Unique constraint: `(venue_id, user_id)`

---

### VenueAvailability
- `id` UUID
- `venue_id` FK -> Venue
- `day_of_week` integer 0-6
- `start_time` time
- `end_time` time
- `table_count` integer
- `max_people_per_table` integer nullable
- `notes` text nullable
- `active` boolean

---

### Event
- `id` UUID
- `slug` string unique
- `title` string
- `description` text
- `gm_profile_id` FK -> GMProfile
- `game_system_id` FK -> GameSystem
- `venue_id` FK -> Venue
- `event_type` enum: one_shot, campaign_session, learn_to_play, organized_play, other
- `join_mode` enum: instant, approval_required
- `status` enum: draft, published, full, cancelled, completed
- `starts_at` timestamp with timezone
- `ends_at` timestamp with timezone nullable
- `estimated_duration_minutes` integer nullable
- `min_players` integer nullable
- `max_players` integer
- `minimum_age` integer nullable
- `beginner_friendly` boolean
- `created_at` timestamp
- `updated_at` timestamp
- `published_at` timestamp nullable

Discovery/swipe interactions target Event records, never User records.

---

### TableExpectations
- `id` UUID
- `event_id` FK -> Event, unique
- `tone` string nullable
- `age_guidance` string nullable
- `roleplay_level` integer 1-5 nullable
- `combat_level` integer 1-5 nullable
- `puzzle_level` integer 1-5 nullable
- `pvp_policy` enum: no, limited, allowed
- `homebrew_policy` string nullable
- `character_death_policy` string nullable
- `mature_content` boolean
- `alcohol_at_venue` boolean
- `new_players_welcome` boolean
- `break_expectations` string nullable
- `safety_framework` text nullable
- `additional_notes` text nullable
- `updated_at` timestamp

---

### EventInterest
- `id` UUID
- `event_id` FK -> Event
- `user_id` FK -> User
- `reaction` enum: interested, passed, saved
- `created_at` timestamp

Unique constraint: `(event_id, user_id)`

---

### Registration
- `id` UUID
- `event_id` FK -> Event
- `player_profile_id` FK -> PlayerProfile
- `status` enum: requested, confirmed, waitlisted, declined, cancelled, removed
- `table_expectations_acknowledged_at` timestamp nullable
- `requested_at` timestamp
- `responded_at` timestamp nullable
- `cancelled_at` timestamp nullable

Unique constraint: `(event_id, player_profile_id)`

---

### Attendance
- `id` UUID
- `event_id` FK -> Event
- `player_profile_id` FK -> PlayerProfile
- `registration_id` FK -> Registration nullable
- `status` enum: attended, late_cancel, no_show, excused_absence
- `recorded_by_user_id` FK -> User
- `recorded_at` timestamp
- `notes` text nullable

Unique constraint: `(event_id, player_profile_id)`

---

### Feedback

Structured post-game feedback used to derive community reputation separately from self-described experience.

Fields:
- `id` UUID
- `event_id` FK -> Event
- `author_user_id` FK -> User
- `subject_type` enum: event, gm, venue
- `subject_id` UUID
- `matched_description` boolean nullable
- `started_reasonably_on_time` boolean nullable
- `boundaries_respected` boolean nullable
- `table_respectful` boolean nullable
- `would_play_again` boolean nullable
- `venue_suitable` boolean nullable
- `private_comment` text nullable
- `created_at` timestamp

Free-text comments should not be published automatically. Public trust signals should be derived from structured aggregate signals with minimum sample thresholds.

---

### Report
- `id` UUID
- `reporter_user_id` FK -> User
- `event_id` FK -> Event nullable
- `subject_user_id` FK -> User nullable
- `venue_id` FK -> Venue nullable
- `category` enum: harassment, discrimination, threat, unwanted_sexual_behavior, theft, disruptive_behavior, intoxication_disruption, repeated_no_show, boundary_violation, other
- `description` text
- `severity` enum: low, medium, high, critical
- `status` enum: submitted, triaged, investigating, resolved, dismissed
- `created_at` timestamp
- `updated_at` timestamp

A report is an allegation requiring review, not an automatic public penalty.

---

### ModerationCase
- `id` UUID
- `status` enum: open, investigating, action_taken, no_action, closed
- `priority` enum: low, medium, high, urgent
- `assigned_moderator_user_id` FK -> User nullable
- `subject_user_id` FK -> User nullable
- `opened_at` timestamp
- `closed_at` timestamp nullable
- `internal_notes` text nullable

---

### Party
- `id` UUID
- `name` string
- `slug` string unique
- `created_by_user_id` FK -> User
- `game_system_id` FK -> GameSystem nullable
- `active` boolean
- `created_at` timestamp

---

### PartyMember
- `id` UUID
- `party_id` FK -> Party
- `user_id` FK -> User
- `role` enum: gm, player
- `status` enum: invited, active, left, removed
- `joined_at` timestamp nullable

Unique constraint: `(party_id, user_id)`

---

### VenueOffer
- `id` UUID
- `venue_id` FK -> Venue
- `title` string
- `description` text
- `price_text` string nullable
- `starts_at` timestamp nullable
- `ends_at` timestamp nullable
- `active` boolean

---

## Relationship Summary

```text
User
 ├── PlayerProfile ──< PlayerSystemExperience >── GameSystem
 ├── GMProfile ──< GMSystemExperience >── GameSystem
 │                    └──< GMSystemFormat
 ├── VenueManager ──> Venue
 └── moderation roles

GMProfile ──< Event >── Venue
               │
               ├── GameSystem
               ├── TableExpectations
               ├── EventInterest
               ├── Registration ──> PlayerProfile
               ├── Attendance ──> PlayerProfile
               ├── Feedback
               └── Report

Party ──< PartyMember >── User
```

---

## Data Integrity Rules

1. Events must reference a valid GM, Venue, and GameSystem before publication.
2. `max_players` must be greater than zero.
3. A player may have only one active registration per event.
4. A user may express Discover interest without registering.
5. Confirmation requires Table Expectations acknowledgement.
6. Attendance must only be recorded for events that have started or completed, except authorized corrections.
7. Public trust signals must be computed from structured data and minimum sample thresholds.
8. Moderation records must never be exposed through public-profile APIs.
9. Self-described Player/GM experience must never be presented as platform-verified expertise unless a separate verification mechanism is added.
10. Player/GM experience is unique per profile + GameSystem and must not be collapsed into one global skill score.
11. Deleting a user should not destroy audit-critical moderation or event records; production design should use appropriate anonymization/retention policies.
12. Timestamps should be stored timezone-aware, preferably UTC, with venue/local timezone retained where needed for display.

---

## Prototype Sample Data

The static GitHub Pages prototype should mirror these entities, especially GameSystem, PlayerSystemExperience, GMSystemExperience, Venue, GMProfile, Event, TableExpectations, and EventInterest-style interactions.

---

## Future Schema Work

Before production database implementation, define authentication/provider tables, permissions, notifications, messaging/privacy, venue reservation workflow, waitlist ordering, geographic indexing, audit logging, retention/deletion policy, verification records, venue analytics, and anti-abuse records.

No production migration should be created until these decisions are reviewed against the MVP Definition of Done.
