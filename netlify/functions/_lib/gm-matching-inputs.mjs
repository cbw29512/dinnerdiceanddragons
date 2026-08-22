import { activeGameSystem, gameSystemById } from "./catalog.mjs";
import { createSignalAvailability } from "./availability.mjs";
import { requireRole } from "./auth.mjs";
import { matchingSignalStatus } from "./matching-participation.mjs";
import { expireSupersededSignals } from "./signal-replacement.mjs";
import {
  SupabaseRestError,
  eq,
  insertRows,
  selectMany,
  selectOne,
  withTransaction
} from "./supabase-rest.mjs";
import { asArray, asInteger } from "./http.mjs";
import { enumValue, optionalText, signalAvailability } from "./matching-input-common.mjs";

const GM_FORMATS = new Set([
  "learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"
]);

async function gmProfile(userId) {
  const profile = await selectOne("gm_profiles", { user_id: eq(userId) });
  if (!profile) throw new SupabaseRestError("Complete GM onboarding before creating supply.", 409);
  return profile;
}

export async function createGMSupply(user, payload) {
  await requireRole(user.id, "gm");
  const profile = await gmProfile(user.id);
  const system = await activeGameSystem(payload?.system_slug);
  const minimum = asInteger(payload.minimum_players, "minimum_players", { min: 1 });
  const maximum = asInteger(payload.maximum_players, "maximum_players", { min: 1 });
  if (maximum < minimum) {
    throw new SupabaseRestError("maximum_players cannot be below minimum_players.", 422);
  }
  const availabilityInputs = asArray(payload?.availability, "availability", { min: 1, max: 12 });
  const id = crypto.randomUUID();
  const status = await matchingSignalStatus(user.id);
  const signal = {
    id,
    gm_profile_id: profile.id,
    game_system_id: system.id,
    preferred_format: enumValue(payload.preferred_format, "preferred_format", GM_FORMATS),
    preferred_cadence: optionalText(payload.preferred_cadence, "preferred_cadence", 32),
    minimum_players: minimum,
    maximum_players: maximum,
    table_style: optionalText(payload.table_style, "table_style"),
    status,
    updated_at: new Date().toISOString()
  };

  return withTransaction(async () => {
    await insertRows("gm_supply_signals", [signal], { returning: false });
    const availability = await createSignalAvailability({
      linkTable: "gm_supply_availability_windows",
      ownerColumn: "gm_supply_signal_id",
      ownerId: id,
      inputs: availabilityInputs
    });
    await expireSupersededSignals({
      table: "gm_supply_signals",
      ownerColumn: "gm_profile_id",
      ownerId: profile.id,
      gameSystemId: system.id,
      keepId: id
    });
    return {
      id,
      status,
      system_slug: system.slug,
      availability,
      preferred_format: signal.preferred_format,
      preferred_cadence: signal.preferred_cadence,
      minimum_players: minimum,
      maximum_players: maximum,
      table_style: signal.table_style
    };
  });
}

export async function listGMSupplies(user) {
  await requireRole(user.id, "gm");
  const profile = await gmProfile(user.id);
  const rows = await selectMany("gm_supply_signals", {
    gm_profile_id: eq(profile.id), order: "created_at.desc,id.asc", limit: 100
  });
  const results = [];
  for (const signal of rows) {
    const system = await gameSystemById(signal.game_system_id);
    results.push({
      id: signal.id,
      status: signal.status,
      system_slug: system?.slug || "other-rpg",
      availability: await signalAvailability(
        "gm_supply_availability_windows", "gm_supply_signal_id", signal.id,
        { linkTable: "gm_availability_windows", ownerColumn: "gm_profile_id", ownerId: profile.id }
      ),
      preferred_format: signal.preferred_format,
      preferred_cadence: signal.preferred_cadence || null,
      minimum_players: Number(signal.minimum_players),
      maximum_players: Number(signal.maximum_players),
      table_style: signal.table_style || null
    });
  }
  return results;
}
