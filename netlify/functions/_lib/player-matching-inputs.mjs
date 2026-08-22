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
import {
  enumValue,
  optionalText,
  signalAvailability,
  uniqueStrings
} from "./matching-input-common.mjs";

const PLAYER_FORMATS = new Set([
  "any", "learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"
]);

async function playerProfile(userId) {
  const profile = await selectOne("player_profiles", { user_id: eq(userId) });
  if (!profile) throw new SupabaseRestError("Complete Player onboarding before creating demand.", 409);
  return profile;
}

export async function createPlayerDemand(user, payload) {
  await requireRole(user.id, "player");
  const profile = await playerProfile(user.id);
  const system = await activeGameSystem(payload?.system_slug);
  const availabilityInputs = asArray(payload?.availability, "availability", { min: 1, max: 12 });
  const id = crypto.randomUUID();
  const status = await matchingSignalStatus(user.id);
  const signal = {
    id,
    player_profile_id: profile.id,
    game_system_id: system.id,
    preferred_format: enumValue(payload.preferred_format ?? "any", "preferred_format", PLAYER_FORMATS),
    preferred_cadence: optionalText(payload.preferred_cadence, "preferred_cadence", 32),
    minimum_age_preference: payload.minimum_age_preference == null
      ? null
      : asInteger(payload.minimum_age_preference, "minimum_age_preference", { min: 0, max: 120 }),
    table_style_preferences: uniqueStrings(payload.table_style_preferences ?? [], "table_style_preferences"),
    environment_preferences: uniqueStrings(payload.environment_preferences ?? [], "environment_preferences"),
    status,
    updated_at: new Date().toISOString()
  };

  return withTransaction(async () => {
    await insertRows("player_demand_signals", [signal], { returning: false });
    const availability = await createSignalAvailability({
      linkTable: "player_demand_availability_windows",
      ownerColumn: "player_demand_signal_id",
      ownerId: id,
      inputs: availabilityInputs
    });
    await expireSupersededSignals({
      table: "player_demand_signals",
      ownerColumn: "player_profile_id",
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
      minimum_age_preference: signal.minimum_age_preference,
      table_style_preferences: signal.table_style_preferences,
      environment_preferences: signal.environment_preferences
    };
  });
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
      id: signal.id,
      status: signal.status,
      system_slug: system?.slug || "other-rpg",
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
