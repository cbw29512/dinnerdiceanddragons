import { activeGameSystem, gameSystemById } from "./catalog.mjs";
import { createSignalAvailability, listAvailability, normalizeAvailability, publicAvailability } from "./availability.mjs";
import { managedVenue, requireRole } from "./auth.mjs";
import {
  SupabaseRestError,
  eq,
  insertRows,
  selectMany,
  selectOne
} from "./supabase-rest.mjs";
import { asArray, asBoolean, asInteger, asString, requireUuid } from "./http.mjs";

const PLAYER_FORMATS = new Set(["any", "learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"]);
const GM_FORMATS = new Set(["learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"]);
const SUPPORT = new Set([
  "consistent_space", "dedicated_rpg_area", "private_room", "food", "snacks", "beverages",
  "discounts", "loyalty_rewards", "prize_support", "store_credit", "tabletop_supplies",
  "terrain_minis", "storage", "event_promotion", "staff_support", "other"
]);

function enumValue(value, name, allowed) {
  const text = asString(value, name, { min: 1, max: 120 });
  if (!allowed.has(text)) throw new SupabaseRestError(`${name} is invalid.`, 422);
  return text;
}

function optionalText(value, name, max = 2000) {
  return asString(value, name, { min: 0, max, nullable: true });
}

function uniqueStrings(value, name, { max = 20, allowed = null } = {}) {
  const items = asArray(value ?? [], name, { min: 0, max }).map((item) => asString(item, name, { min: 1, max: 120 }));
  if (new Set(items.map((item) => item.toLowerCase())).size !== items.length) throw new SupabaseRestError(`${name} contains duplicate values.`, 422);
  if (allowed && items.some((item) => !allowed.has(item))) throw new SupabaseRestError(`${name} contains an unsupported value.`, 422);
  return items;
}

async function playerProfile(userId) {
  const profile = await selectOne("player_profiles", { user_id: eq(userId) });
  if (!profile) throw new SupabaseRestError("Complete Player onboarding before creating demand.", 409);
  return profile;
}

async function gmProfile(userId) {
  const profile = await selectOne("gm_profiles", { user_id: eq(userId) });
  if (!profile) throw new SupabaseRestError("Complete GM onboarding before creating supply.", 409);
  return profile;
}

async function signalAvailability(linkTable, ownerColumn, ownerId, fallback = null) {
  const specific = await listAvailability({ linkTable, ownerColumn, ownerId });
  if (specific.length || !fallback) return specific;
  return listAvailability(fallback);
}

export async function createPlayerDemand(user, payload) {
  await requireRole(user.id, "player");
  const profile = await playerProfile(user.id);
  const system = await activeGameSystem(payload?.system_slug);
  const availabilityInputs = asArray(payload?.availability, "availability", { min: 1, max: 12 });
  const id = crypto.randomUUID();
  const signal = {
    id,
    player_profile_id: profile.id,
    game_system_id: system.id,
    preferred_format: enumValue(payload.preferred_format ?? "any", "preferred_format", PLAYER_FORMATS),
    preferred_cadence: optionalText(payload.preferred_cadence, "preferred_cadence", 32),
    minimum_age_preference: payload.minimum_age_preference == null ? null : asInteger(payload.minimum_age_preference, "minimum_age_preference", { min: 0, max: 120 }),
    table_style_preferences: uniqueStrings(payload.table_style_preferences ?? [], "table_style_preferences"),
    environment_preferences: uniqueStrings(payload.environment_preferences ?? [], "environment_preferences"),
    status: "active",
    updated_at: new Date().toISOString()
  };
  await insertRows("player_demand_signals", [signal], { returning: false });
  const availability = await createSignalAvailability({
    linkTable: "player_demand_availability_windows",
    ownerColumn: "player_demand_signal_id",
    ownerId: id,
    inputs: availabilityInputs
  });
  return {
    id,
    status: "active",
    system_slug: system.slug,
    availability,
    preferred_format: signal.preferred_format,
    preferred_cadence: signal.preferred_cadence,
    minimum_age_preference: signal.minimum_age_preference,
    table_style_preferences: signal.table_style_preferences,
    environment_preferences: signal.environment_preferences
  };
}

export async function listPlayerDemands(user) {
  await requireRole(user.id, "player");
  const profile = await playerProfile(user.id);
  const rows = await selectMany("player_demand_signals", {
    player_profile_id: eq(profile.id), order: "created_at.desc,id.asc", limit: 100
  });
  const results = [];
  for (const signal of rows) {
    const system = await gameSystemById(signal.game_system_id);
    results.push({
      id: signal.id, status: signal.status, system_slug: system?.slug || "other-rpg",
      availability: await signalAvailability(
        "player_demand_availability_windows", "player_demand_signal_id", signal.id,
        { linkTable: "player_availability_windows", ownerColumn: "player_profile_id", ownerId: profile.id }
      ),
      preferred_format: signal.preferred_format,
      preferred_cadence: signal.preferred_cadence || null,
      minimum_age_preference: signal.minimum_age_preference == null ? null : Number(signal.minimum_age_preference),
      table_style_preferences: signal.table_style_preferences || [],
      environment_preferences: signal.environment_preferences || []
    });
  }
  return results;
}

export async function createGMSupply(user, payload) {
  await requireRole(user.id, "gm");
  const profile = await gmProfile(user.id);
  const system = await activeGameSystem(payload?.system_slug);
  const minimum = asInteger(payload.minimum_players, "minimum_players", { min: 1, max: 20 });
  const maximum = asInteger(payload.maximum_players, "maximum_players", { min: 1, max: 20 });
  if (maximum < minimum) throw new SupabaseRestError("maximum_players cannot be below minimum_players.", 422);
  const id = crypto.randomUUID();
  const signal = {
    id,
    gm_profile_id: profile.id,
    game_system_id: system.id,
    preferred_format: enumValue(payload.preferred_format, "preferred_format", GM_FORMATS),
    preferred_cadence: optionalText(payload.preferred_cadence, "preferred_cadence", 32),
    minimum_players: minimum,
    maximum_players: maximum,
    table_style: optionalText(payload.table_style, "table_style"),
    status: "active",
    updated_at: new Date().toISOString()
  };
  await insertRows("gm_supply_signals", [signal], { returning: false });
  const availability = await createSignalAvailability({
    linkTable: "gm_supply_availability_windows",
    ownerColumn: "gm_supply_signal_id",
    ownerId: id,
    inputs: asArray(payload?.availability, "availability", { min: 1, max: 12 })
  });
  return {
    id, status: "active", system_slug: system.slug, availability,
    preferred_format: signal.preferred_format, preferred_cadence: signal.preferred_cadence,
    minimum_players: minimum, maximum_players: maximum, table_style: signal.table_style
  };
}

export async function listGMSupplies(user) {
  await requireRole(user.id, "gm");
  const profile = await gmProfile(user.id);
  const rows = await selectMany("gm_supply_signals", { gm_profile_id: eq(profile.id), order: "created_at.desc,id.asc", limit: 100 });
  const results = [];
  for (const signal of rows) {
    const system = await gameSystemById(signal.game_system_id);
    results.push({
      id: signal.id, status: signal.status, system_slug: system?.slug || "other-rpg",
      availability: await signalAvailability(
        "gm_supply_availability_windows", "gm_supply_signal_id", signal.id,
        { linkTable: "gm_availability_windows", ownerColumn: "gm_profile_id", ownerId: profile.id }
      ),
      preferred_format: signal.preferred_format,
      preferred_cadence: signal.preferred_cadence || null,
      minimum_players: Number(signal.minimum_players), maximum_players: Number(signal.maximum_players),
      table_style: signal.table_style || null
    });
  }
  return results;
}

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
  await insertRows("recurring_availability_rules", [rule], { returning: false });
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
    special_support_offerings: uniqueStrings(payload.special_support_offerings ?? [], "special_support_offerings", { max: 30, allowed: SUPPORT }),
    special_support_notes: optionalText(payload.special_support_notes, "special_support_notes")
  };
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
}

export async function listVenueTableWindows(user, venueId) {
  const { safeVenueId, venue } = await venueWindowOwner(user, venueId);
  const windows = await selectMany("venue_table_windows", { venue_id: eq(safeVenueId), order: "active.desc,id.asc", limit: 100 });
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
