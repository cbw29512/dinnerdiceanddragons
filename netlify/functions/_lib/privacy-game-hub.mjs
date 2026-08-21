import { getGameHub as getBaseGameHub } from "./lifecycle.mjs";
import { eq, selectOne } from "./supabase-rest.mjs";

export async function getPrivacyGameHub(user, eventId) {
  try {
    const hub = await getBaseGameHub(user, eventId);
    const eventRow = await selectOne("events", { id: eq(eventId) });
    const venue = eventRow ? await selectOne("venues", { id: eq(eventRow.venue_id) }) : null;
    const viewerRoles = hub.capabilities?.viewer_roles || [];
    return {
      ...hub,
      event: {
        ...hub.event,
        venue_address_line1: venue?.address_line1 || null,
        venue_address_line2: venue?.address_line2 || null,
        venue_postal_code: venue?.postal_code || null
      },
      capabilities: {
        viewer_roles: viewerRoles,
        post_channels: [],
        can_manage_registrations: viewerRoles.includes("gm"),
        can_manage_booking: viewerRoles.includes("venue_manager"),
        can_post_announcement: viewerRoles.includes("gm"),
        can_report_problem: true
      }
    };
  } catch (error) {
    console.error("[DDD Privacy] Unable to build privacy-safe Game Hub", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
