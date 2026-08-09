# Dinner, Dice & Dragons — Location & Travel-Radius Matching

## Objective

Players and Game Masters should be able to define how far they are willing to travel, and discovery should only surface events whose venue falls within that travel radius.

The matching rule is:

> User location + travel radius -> eligible venue locations -> eligible events.

Events remain the discovery object. Location is a filter applied to events through their venue.

---

## User Location Preference

A user may provide one of two location anchors:

1. **ZIP code / postal code** — default, privacy-friendly option.
2. **Exact address** — optional higher-precision option for users who explicitly choose it.

The user also selects a travel radius in miles, for example:

- 5 miles
- 10 miles
- 25 miles
- 50 miles
- 75 miles
- 100 miles
- Custom radius

Players and GMs may have different travel preferences if needed later, but the simplest account-level default should be reusable by both roles.

---

## Privacy Rules

- Exact home addresses must never be public profile fields.
- Public profiles should show, at most, a broad area such as city/state or ZIP-derived locality if the user opts in.
- Exact addresses are used only for distance calculations and should be protected as sensitive personal data.
- ZIP-only matching should remain available so a user can use the platform without providing a home address.
- Venue addresses may be public when the venue is a verified public business or community location.

---

## Data Model Additions

### LocationPreference

Recommended production entity:

- `id` UUID
- `user_id` FK -> User, unique
- `location_type` enum: postal_code, exact_address
- `postal_code` string
- `country_code` string default `US`
- `address_line_1` string nullable, encrypted/protected
- `address_line_2` string nullable, encrypted/protected
- `city` string nullable
- `state_region` string nullable
- `latitude` decimal nullable
- `longitude` decimal nullable
- `travel_radius_miles` integer
- `show_city_publicly` boolean default false
- `created_at` timestamp
- `updated_at` timestamp

`PlayerProfile.travel_radius_miles` should eventually be removed in favor of this shared preference unless separate player/GM radii become a validated user need.

### Venue

Venue already includes:

- public address
- postal code
- latitude
- longitude

Verified venue coordinates should be geocoded and cached so distance calculations do not repeatedly call a third-party service.

---

## Matching Logic

For each published event:

1. Read the user's saved location centroid/coordinates.
2. Read the event venue coordinates.
3. Calculate distance between the two locations.
4. Include the event if `distance_miles <= travel_radius_miles`.
5. Display the calculated approximate distance on the game card.
6. Sort by compatibility, date, and/or distance depending on the active discovery mode.

For the GitHub Pages prototype, ZIP-code lookup can be performed client-side and distances can be calculated with the Haversine formula. Production should move matching server-side and use a spatially indexed database strategy.

---

## ZIP vs Driving Distance

Initial matching should be **straight-line geographic distance**, because it is deterministic and inexpensive.

This must be labeled as approximate distance.

Later, if users need true driving distance or travel time, the platform can add a routing provider. That should be a separate product/architecture decision because road-distance APIs may introduce cost, quotas, and privacy implications.

---

## Discovery UX

The Discover area should provide:

- ZIP code field
- Travel radius selector
- `Find Games Near Me` action
- Current active location summary
- Distance displayed on each matching game card
- A clear message when no games match
- A `Show all prototype games` / reset option

Swipe/card discovery, list view, map view, and calendar view should all respect the same active location filter.

---

## GM Use Case

A GM can save a default travel radius representing how far they are willing to travel to host a game.

Future venue-discovery tooling may show the GM:

- verified venues within radius
- venue gaming availability
- approximate distance
- open tabletop nights
- venue amenities

This allows a GM to discover a location before creating an event.

---

## Player Use Case

A player saves a location and radius. Discover then prioritizes or limits games to venue locations inside that radius.

Example:

> Home ZIP: 29501
> Travel radius: 25 miles
> Result: Only events at venues approximately 25 miles or less from the ZIP centroid appear.

---

## Prototype Implementation

The static GitHub Pages prototype may use the public Zippopotam.us postal-code API to translate US ZIP codes into latitude/longitude in the browser. Its official documentation states that CORS is enabled for browser JavaScript use and that ZIP lookups return location centroids.

The prototype should:

- avoid API keys
- fail gracefully when a ZIP cannot be resolved
- calculate distance locally
- avoid collecting or transmitting exact home addresses

Production must revisit provider reliability, privacy, caching, terms, rate limits, and spatial indexing before launch.

---

## Acceptance Criteria

- Player can enter a valid US ZIP code.
- Player can choose a travel radius.
- Game discovery removes events outside that radius.
- Matching game cards show approximate distance.
- Invalid/unavailable ZIP lookup produces an understandable error.
- User can reset the geographic filter.
- The feature works without requiring an exact home address.
- Exact user address is never exposed publicly.
- Keyboard and screen-reader users can operate the entire location-filter flow.
