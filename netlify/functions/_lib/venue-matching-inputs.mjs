import { normalizeAvailability, publicAvailability } from "./availability.mjs";
import { managedVenue, requireRole } from "./auth.mjs";
import {
  SupabaseRestError,
  eq,
  insertRows,
  selectMany,
  selectOne,
  withTransaction
} from "./supabase-rest.mjs";
import { asBoolean, asInteger, requireUuid } from "./http.mjs";
import { optionalText, uniqueStrings } from "./matching-input-common.mjs";

const SUPPORT = new Set([
  "consistent_space", "dedicated_rpg_area", "private_room", "food", "snacks", "beverages",
  "discounts", "loyalty_rewards", "prize_support", "store_credit", "tabletop_supplies",
  "terrain_minis", "storage", "event_promotion", "staff_support", "other"
]);

async function venueWindowOwner(user, venueId) {
  await requireRole(user.id, "venue_manager");
  const safeVenueId = requireUuid(venueId, "venue_id");
  await managedVenue(user.id, safeVenueId, { verified: false });
  const venue = await selectOne("venues", { id: eq(safeVenueId) });
  if (!venue || !venue.active) throw new SupabaseRestError("Venue is not available.", 404);
  return { safeVenueId, venue };
}

export async function createVenueTableWindow(user, venueId, payload) {
  const { safeVenueId, venue } = await venueWindowOwner(user, venueId);
  const rule = normalizeAvailability(payload?.availability);
  const id = crypto.randomUUID();
  const row = {
    id,
    venue_id: safeVenueId,
    recurring_rule_id: rule.id,
    table_count: asInteger(payload.table_count, "table_count", { min: 1, max: 100 }),
    max_people_per_table: asInteger(payload.max_people_per_table, "max_people_per_table", { min: 1, max: 100 }),
    purchase_policy: optionalText(payload.purchase_policy, "purchase_policy"),
    approval_required: asBoolean(payload.approval_required, "approval_required"),
    environment_notes: optionalText(payload.environment_notes, "environment_notes"),
    active: true,
    special_support_offerings: uniqueStrings(
      payload.special_support_offerings ?? [],
      "special_support_offerings",
      { max: 30, allowed: SUPPORT }
    ),
    special_support_notes: optionalText(payload.special_support_notes, "special_support_notes")
  };

  return withTransaction(async () => {
    await insertRows("recurring_availability_rules", [rule], { returning: false });
    await insertRows("venue_table_windows", [row], { returning: false });
    return {
      id,
      venue_id: safeVenueId,
      active: true,
      matching_eligible: Boolean(venue.verified),
      availability: publicAvailability(rule),
      table_count: row.table_count,
      max_people_per_table: row.max_people_per_table,
      purchase_policy: row.purchase_policy,
      approval_required: row.approval_required,
      special_support_offerings: row.special_support_offerings,
      special_support_notes: row.special_support_notes,
      environment_notes: row.environment_notes
    };
  });
}

export async function listVenueTableWindows(user, venueId) {
  const { safeVenueId, venue } = await venueWindowOwner(user, venueId);
  const windows = await selectMany("venue_table_windows", {
    venue_id: eq(safeVenueId), order: "active.desc,id.asc", limit: 100
  });
  const results = [];
  for (const row of windows) {
    const rule = await selectOne("recurring_availability_rules", { id: eq(row.recurring_rule_id) });
    if (!rule) continue;
    results.push({
      id: row.id,
      venue_id: row.venue_id,
      active: Boolean(row.active),
      matching_eligible: Boolean(venue.verified),
      availability: publicAvailability(rule),
      table_count: Number(row.table_count),
      max_people_per_table: Number(row.max_people_per_table),
      purchase_policy: row.purchase_policy || null,
      approval_required: Boolean(row.approval_required),
      special_support_offerings: row.special_support_offerings || [],
      special_support_notes: row.special_support_notes || null,
      environment_notes: row.environment_notes || null
    });
  }
  return results;
}
