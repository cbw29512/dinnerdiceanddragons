import { userRoles } from "./auth.mjs";
import { gameSystemById } from "./catalog.mjs";
import { playerIsMatched, synchronizeEvent } from "./event-participation-state.mjs";
import { SupabaseRestError, eq, selectMany, selectOne } from "./supabase-rest.mjs";
import { requireUuid } from "./http.mjs";

function registrationResponse(registration) {
  return {
    id: registration.id,
    event_id: registration.event_id,
    status: registration.status,
    expectations_acknowledged_at: registration.expectations_acknowledged_at || null,
    requested_at: registration.requested_at,
    responded_at: registration.responded_at || null,
    cancelled_at: registration.cancelled_at || null
  };
}

async function eventViewerRoles(user, event, { hub = false } = {}) {
  const durable = await userRoles(user.id);
  const roles = [];
  const gm = await selectOne("gm_profiles", { id: eq(event.gm_profile_id) });
  if (durable.includes("gm") && gm?.user_id === user.id) roles.push("gm");

  if (durable.includes("venue_manager")) {
    const manager = await selectOne("venue_managers", {
      venue_id: eq(event.venue_id),
      user_id: eq(user.id),
      verified_at: "not.is.null"
    });
    if (manager) roles.push("venue_manager");
  }

  if (durable.includes("player")) {
    const profile = await selectOne("player_profiles", { user_id: eq(user.id) });
    if (profile) {
      const registration = await selectOne("registrations", {
        event_id: eq(event.id),
        player_profile_id: eq(profile.id)
      });
      const permitted = hub
        ? registration?.status === "confirmed"
        : Boolean(registration || await playerIsMatched(event, profile.id));
      if (permitted) roles.push("player");
    }
  }
  return [...new Set(roles)];
}

export async function getEvent(user, eventId, { hub = false } = {}) {
  const event = await selectOne("events", { id: eq(requireUuid(eventId, "event_id")) });
  if (!event) throw new SupabaseRestError(hub ? "Game Hub was not found." : "Event not found.", 404);
  const roles = await eventViewerRoles(user, event, { hub });
  if (!roles.length) throw new SupabaseRestError(hub ? "Game Hub was not found." : "Event not found.", 404);

  const state = await synchronizeEvent(event);
  const currentEvent = { ...state.event, status: state.status };
  const [system, venue, expectations] = await Promise.all([
    gameSystemById(currentEvent.game_system_id),
    selectOne("venues", { id: eq(currentEvent.venue_id) }),
    selectOne("table_expectations", { event_id: eq(currentEvent.id) })
  ]);
  const profile = roles.includes("player")
    ? await selectOne("player_profiles", { user_id: eq(user.id) })
    : null;
  const registration = profile
    ? await selectOne("registrations", { event_id: eq(currentEvent.id), player_profile_id: eq(profile.id) })
    : null;

  return {
    id: currentEvent.id,
    slug: currentEvent.slug,
    title: currentEvent.title,
    description: currentEvent.description,
    status: currentEvent.status,
    event_type: currentEvent.event_type,
    join_mode: currentEvent.join_mode,
    starts_at: currentEvent.starts_at,
    ends_at: currentEvent.ends_at,
    min_players: Number(currentEvent.min_players),
    max_players: Number(currentEvent.max_players),
    confirmed_players: state.confirmed,
    minimum_age: currentEvent.minimum_age == null ? null : Number(currentEvent.minimum_age),
    beginner_friendly: Boolean(currentEvent.beginner_friendly),
    system_name: system?.name || "Tabletop RPG",
    system_edition: system?.edition || null,
    venue_name: venue?.name || "Venue",
    venue_city: venue?.city || "",
    venue_state_region: venue?.state_region || "",
    viewer_roles: roles,
    booking: {
      id: state.booking.id,
      status: state.booking.status,
      expected_guests: Number(state.booking.expected_guests),
      requested_start: state.booking.requested_start,
      requested_end: state.booking.requested_end
    },
    expectations: expectations
      ? Object.fromEntries(Object.entries(expectations).filter(([key]) => !["id", "event_id"].includes(key)))
      : null,
    your_registration: registration ? registrationResponse(registration) : null
  };
}

function capabilities(roles) {
  return {
    viewer_roles: roles,
    can_manage_registrations: roles.includes("gm"),
    can_manage_booking: roles.includes("venue_manager")
  };
}

export async function getGameHub(user, eventId) {
  const event = await selectOne("events", { id: eq(requireUuid(eventId, "event_id")) });
  if (!event) throw new SupabaseRestError("Game Hub was not found.", 404);
  const roles = await eventViewerRoles(user, event, { hub: true });
  if (!roles.length) throw new SupabaseRestError("Game Hub was not found.", 404);
  const projected = await getEvent(user, event.id, { hub: true });
  const queue = [];
  if (roles.includes("gm")) {
    const registrations = await selectMany("registrations", {
      event_id: eq(event.id),
      order: "requested_at.asc,id.asc",
      limit: 100
    });
    for (const registration of registrations) {
      const profile = await selectOne("player_profiles", { id: eq(registration.player_profile_id) });
      const account = profile ? await selectOne("users", { id: eq(profile.user_id) }) : null;
      queue.push({
        registration_id: registration.id,
        display_name: account?.display_name || "Player",
        status: registration.status,
        requested_at: registration.requested_at,
        expectations_acknowledged: Boolean(registration.expectations_acknowledged_at)
      });
    }
  }
  return { event: projected, capabilities: capabilities(roles), registration_queue: queue };
}

export async function listGameHubs(user) {
  const events = await selectMany("events", { order: "starts_at.asc,id.asc", limit: 100 });
  const results = [];
  for (const event of events) {
    const roles = await eventViewerRoles(user, event, { hub: true });
    if (!roles.length) continue;
    const system = await gameSystemById(event.game_system_id);
    const venue = await selectOne("venues", { id: eq(event.venue_id) });
    results.push({
      event_id: event.id,
      title: event.title,
      status: event.status,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      venue_name: venue?.name || "Venue",
      venue_city: venue?.city || "",
      venue_state_region: venue?.state_region || "",
      system_name: system?.name || "Tabletop RPG",
      system_edition: system?.edition || null
    });
  }
  return results;
}
