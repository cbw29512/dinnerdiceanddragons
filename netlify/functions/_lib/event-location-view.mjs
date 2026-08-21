import {
  getEvent as getLifecycleEvent,
  getGameHub as getLifecycleGameHub,
  listGameHubs as listLifecycleGameHubs
} from "./lifecycle.mjs";
import { eq, selectOne } from "./supabase-rest.mjs";

async function eventVenue(eventId) {
  try {
    const event = await selectOne("events", { id: eq(eventId) });
    if (!event) return null;
    const venue = await selectOne("venues", { id: eq(event.venue_id) });
    return venue ? { event, venue } : null;
  } catch (error) {
    console.error("[DDD Event Location] Unable to load Venue context", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

function publicVenueFields(venue) {
  try {
    return {
      venue_name: venue?.name || "Public Venue",
      venue_location_kind: "public_venue",
      venue_location_label: "Public venue",
      venue_address_line1: venue?.address_line1 || "",
      venue_address_line2: venue?.address_line2 || null,
      venue_city: venue?.city || "",
      venue_state_region: venue?.state_region || "",
      venue_postal_code: venue?.postal_code || null
    };
  } catch (error) {
    console.error("[DDD Event Location] Unable to project public Venue", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

async function decorateEvent(event) {
  try {
    if (!event?.id) return event;
    const context = await eventVenue(event.id);
    return context ? { ...event, ...publicVenueFields(context.venue) } : event;
  } catch (error) {
    console.error("[DDD Event Location] Unable to decorate Event location", { error_type: String(error?.name || "Error") });
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
      results.push(context ? { ...hub, venue_name: context.venue.name, venue_location_kind: "public_venue" } : hub);
    }
    return results;
  } catch (error) {
    console.error("[DDD Event Location] Unable to list Game Hubs", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
