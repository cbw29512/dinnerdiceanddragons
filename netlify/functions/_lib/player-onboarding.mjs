import { activeGameSystems, gameSystemById } from "./catalog.mjs";
import { ensureRole } from "./auth.mjs";
import { listAvailability, replaceAvailability } from "./availability.mjs";
import {
  SupabaseRestError,
  deleteRows,
  eq,
  inList,
  insertRows,
  selectMany,
  selectOne,
  withTransaction
} from "./supabase-rest.mjs";
import { asBoolean, asNumber } from "./http.mjs";
import {
  enumValue,
  onboardingSystems,
  optionalText,
  postalCode,
  prepareDisplayName,
  uniqueStrings,
  upsertProfile
} from "./onboarding-common.mjs";

const PLAYER_FORMATS = new Set([
  "any", "learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"
]);
const PLAYER_COMFORT = new Set(["new", "learning", "comfortable", "very_experienced"]);

async function clearPlayerSystems(profileId) {
  const existing = await selectMany("player_system_experiences", { player_profile_id: eq(profileId) });
  if (existing.length) {
    await deleteRows("player_system_experiences", { id: inList(existing.map((row) => row.id)) });
  }
}

export async function savePlayerOnboarding(user, payload) {
  const { systems, slugs } = onboardingSystems(payload, "Player");
  const catalog = await activeGameSystems(slugs);

  return withTransaction(async () => {
    const prepared = await prepareDisplayName(user, payload.display_name);
    await ensureRole(user.id, "player");
    const profile = await upsertProfile("player_profiles", user.id, {
      bio: optionalText(payload.bio, "bio", 10000),
      postal_code: postalCode(payload.postal_code),
      travel_radius_miles: asNumber(payload.travel_radius_miles, "travel_radius_miles", { min: 1, max: 100 }),
      preferred_format: enumValue(payload.preferred_format ?? "any", "preferred_format", PLAYER_FORMATS),
      willing_to_learn_new_system: asBoolean(payload.willing_to_learn_new_system, "willing_to_learn_new_system"),
      environment_preferences: uniqueStrings(payload.environment_preferences ?? [], "environment_preferences", { maxItems: 20 }),
      accessibility_notes_private: optionalText(payload.accessibility_notes_private, "accessibility_notes_private", 10000)
    });

    await clearPlayerSystems(profile.id);
    for (let index = 0; index < systems.length; index += 1) {
      const item = systems[index];
      await insertRows("player_system_experiences", [{
        id: crypto.randomUUID(),
        player_profile_id: profile.id,
        game_system_id: catalog.get(slugs[index]).id,
        years_playing: asNumber(item.years_playing, "years_playing", { min: 0, max: 80 }),
        comfort_level: enumValue(item.comfort_level, "comfort_level", PLAYER_COMFORT),
        experience_notes: optionalText(item.experience_notes, "experience_notes")
      }], { returning: false });
    }

    const availability = await replaceAvailability({
      linkTable: "player_availability_windows",
      ownerColumn: "player_profile_id",
      ownerId: profile.id,
      inputs: payload.availability,
      max: 14
    });

    return {
      player_profile_id: profile.id,
      display_name: prepared.display,
      role: "player",
      system_slugs: slugs,
      availability_count: availability.length
    };
  });
}

export async function loadPlayerOnboarding(user) {
  const profile = await selectOne("player_profiles", { user_id: eq(user.id) });
  if (!profile) throw new SupabaseRestError("Player onboarding has not been completed.", 404);

  const experiences = await selectMany("player_system_experiences", {
    player_profile_id: eq(profile.id),
    order: "id.asc"
  });
  if (!experiences.length) throw new SupabaseRestError("Player onboarding has not been completed.", 404);

  const systems = [];
  for (const item of experiences) {
    const system = await gameSystemById(item.game_system_id);
    systems.push({
      system_slug: system?.slug || "other-rpg",
      years_playing: Number(item.years_playing),
      comfort_level: item.comfort_level,
      experience_notes: item.experience_notes || null
    });
  }

  const availability = await listAvailability({
    linkTable: "player_availability_windows",
    ownerColumn: "player_profile_id",
    ownerId: profile.id
  });
  if (!availability.length) throw new SupabaseRestError("Player onboarding has not been completed.", 404);

  return {
    display_name: user.display_name || "",
    bio: profile.bio || null,
    postal_code: profile.postal_code,
    travel_radius_miles: Number(profile.travel_radius_miles),
    preferred_format: profile.preferred_format,
    willing_to_learn_new_system: Boolean(profile.willing_to_learn_new_system),
    environment_preferences: profile.environment_preferences || [],
    accessibility_notes_private: profile.accessibility_notes_private || null,
    systems,
    availability
  };
}
