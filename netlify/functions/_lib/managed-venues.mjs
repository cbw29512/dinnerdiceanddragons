import { managedVenue, requireRole } from "./auth.mjs";
import { normalizeAvailability, publicAvailability } from "./availability.mjs";
import { asArray, asInteger, asString, requireUuid } from "./http.mjs";
import { SupabaseRestError, eq, insertRows, selectMany, selectOne, updateRows } from "./supabase-rest.mjs";

function optional(value, name, max = 2000) {
  return asString(value, name, { min: 0, max, nullable: true });
}

export async function listManagedVenues(user) {
  try {
    await requireRole(user.id, "venue_manager");
    const managers = await selectMany("venue_managers", { user_id: eq(user.id), limit: 100 });
    const results = [];
    for (const manager of managers) {
      const venue = await selectOne("venues", { id: eq(manager.venue_id) });
      if (!venue) continue;
      results.push({
        id: venue.id, name: venue.name, city: venue.city, state_region: venue.state_region,
        postal_code: venue.postal_code, verified: Boolean(venue.verified), active: Boolean(venue.active),
        manager_role: manager.role, manager_verified: Boolean(manager.verified_at)
      });
    }
    return results;
  } catch (error) {
    console.error("[DDD Venues] Unable to list managed Venues", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

export async function replaceVenueCalendar(user, venueId, payload) {
  try {
    await requireRole(user.id, "venue_manager");
    const id = requireUuid(venueId, "venue_id");
    await managedVenue(user.id, id, { verified: false });
    const venue = await selectOne("venues", { id: eq(id) });
    if (!venue?.active) throw new SupabaseRestError("Venue is not active.", 409);
    const availability = asArray(payload?.availability, "availability", { min: 1, max: 14 }).map(normalizeAvailability);
    const tableCount = asInteger(payload?.table_count, "table_count", { min: 1, max: 100 });
    const seats = asInteger(payload?.max_people_per_table, "max_people_per_table", { min: 1, max: 100 });
    const purchasePolicy = optional(payload?.purchase_policy, "purchase_policy");
    const environmentNotes = optional(payload?.environment_notes, "environment_notes");
    const old = await selectMany("venue_table_windows", { venue_id: eq(id), active: "is.true", limit: 100 });
    const created = [];
    try {
      for (const rule of availability) {
        await insertRows("recurring_availability_rules", [rule], { returning: false });
        const windowId = crypto.randomUUID();
        await insertRows("venue_table_windows", [{
          id: windowId, venue_id: id, recurring_rule_id: rule.id,
          table_count: tableCount, max_people_per_table: seats,
          purchase_policy: purchasePolicy, approval_required: false,
          environment_notes: environmentNotes, active: true,
          special_support_offerings: [], special_support_notes: null
        }], { returning: false });
        created.push({ id: windowId, availability: publicAvailability(rule) });
      }
    } catch (error) {
      for (const row of created) await updateRows("venue_table_windows", { id: eq(row.id) }, { active: false }, { returning: false }).catch(() => {});
      throw error;
    }
    const now = new Date().toISOString();
    for (const row of old) await updateRows("venue_table_windows", { id: eq(row.id) }, { active: false, updated_at: now }, { returning: false });
    return {
      venue_id: id, matching_eligible: Boolean(venue.verified),
      table_count: tableCount, max_people_per_table: seats, availability: created.map((row) => row.availability)
    };
  } catch (error) {
    console.error("[DDD Venues] Unable to replace Venue calendar", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
