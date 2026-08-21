import {
  getEvent as getLifecycleEvent,
  getGameHub as getLifecycleGameHub,
  listGameHubs as listLifecycleGameHubs
} from "./lifecycle.mjs";
import { eq, selectOne } from "./supabase-rest.mjs";
import { publicVenueLocation } from "./venue-location-kind.mjs";

async function eventVenue(eventId) {
  const event = await selectOne("events", { id: eq(eventId) });
  if (!event) return null;
  const venue = await selectOne("venues", { id: eq(event.venue_id) });
  return venue ? { event, venue } : null;
}

async function decorateEvent(event) {
  try {
    if (!event?.id) return event;
    const context = await eventVenue(event.id);
    if (!context) return event;
    const location = publicVenueLocation(context.venue, { formed: true });
    return {
      ...event,
      venue_name: context.venue.name || location.name,
      venue_location_kind: location.location_kind,
      venue_location_label: location.location_label,
      venue_address_line1: location.address_line1,
      venue_address_line2: location.address_line2,
      venue_city: location.city,
      venue_state_region: location.state_region,
      venue_postal_code: location.postal_code
    };
  } catch (error) {
    console.error("[DDD Event Location] Unable to decorate Event location", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}

export async function getEvent(user, eventId, options = {}) {
  try {
    return decorateEvent(await getLifecycleEvent(user, eventId, options));
  } catch (error) {
    console.error("[DDD Event Location] Unable to load Event", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

export async function getGameHub(user, eventId) {
  try {
    const hub = await getLifecycleGameHub(user, eventId);
    return { ...hub, event: await decorateEvent(hub.event) };
  } catch (error) {
    console.error("[DDD Event Location] Unable to load Game Hub", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

export async function listGameHubs(user) {
  try {
    const hubs = await listLifecycleGameHubs(user);
    const results = [];
    for (const hub of hubs) {
      const context = await eventVenue(hub.event_id);
      if (!context) {
        results.push(hub);
        continue;
      }
      const location = publicVenueLocation(context.venue, { formed: true });
      results.push({
        ...hub,
        venue_name: context.venue.name || location.name,
        venue_location_kind: location.location_kind
      });
    }
    return results;
  } catch (error) {
    console.error("[DDD Event Location] Unable to list Game Hubs", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
