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
import { asArray, asBoolean, asNumber, asString } from "./http.mjs";
import {
  enumValue,
  onboardingSystems,
  optionalText,
  postalCode,
  prepareDisplayName,
  upsertProfile
} from "./onboarding-common.mjs";

const GM_COMFORT = new Set(["learning", "comfortable", "very_comfortable", "expert"]);
const GM_FORMATS = new Set([
  "learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"
]);
const PLAYER_EXPERIENCE = new Set(["new_players", "some_experience", "experienced", "any"]);

async function clearGMSystems(profileId) {
  const existing = await selectMany("gm_system_experiences", { gm_profile_id: eq(profileId) });
  if (!existing.length) return;
  const ids = existing.map((row) => row.id);
  await deleteRows("gm_system_formats", { gm_system_experience_id: inList(ids) });
  await deleteRows("gm_system_experiences", { id: inList(ids) });
}

export async function saveGMOnboarding(user, payload) {
  const { systems, slugs } = onboardingSystems(payload, "GM");
  const catalog = await activeGameSystems(slugs);

  return withTransaction(async () => {
    const prepared = await prepareDisplayName(user, payload.display_name);
    await ensureRole(user.id, "gm");
    const profile = await upsertProfile("gm_profiles", user.id, {
      bio: optionalText(payload.bio, "bio", 10000),
      postal_code: postalCode(payload.postal_code),
      travel_radius_miles: asNumber(payload.travel_radius_miles, "travel_radius_miles", { min: 1, max: 100 }),
      beginner_friendly: asBoolean(payload.beginner_friendly, "beginner_friendly"),
      gm_style: asString(payload.gm_style, "gm_style", { min: 1, max: 2000 })
    });

    await clearGMSystems(profile.id);
    for (let index = 0; index < systems.length; index += 1) {
      const item = systems[index];
      const formats = asArray(item.formats, "formats", { min: 1, max: 5 })
        .map((value) => enumValue(value, "format", GM_FORMATS));
      if (new Set(formats).size !== formats.length) {
        throw new SupabaseRestError("Each GM game format may appear only once per system.", 422);
      }
      const experienceId = crypto.randomUUID();
      await insertRows("gm_system_experiences", [{
        id: experienceId,
        gm_profile_id: profile.id,
        game_system_id: catalog.get(slugs[index]).id,
        years_playing: asNumber(item.years_playing, "years_playing", { min: 0, max: 80 }),
        years_gming: asNumber(item.years_gming, "years_gming", { min: 0, max: 80 }),
        comfort_level: enumValue(item.comfort_level, "comfort_level", GM_COMFORT),
        preferred_player_experience: enumValue(
          item.preferred_player_experience ?? "any",
          "preferred_player_experience",
          PLAYER_EXPERIENCE
        ),
        experience_notes: optionalText(item.experience_notes, "experience_notes")
      }], { returning: false });
      await insertRows(
        "gm_system_formats",
        formats.map((format) => ({ gm_system_experience_id: experienceId, format })),
        { returning: false }
      );
    }

    const availability = await replaceAvailability({
      linkTable: "gm_availability_windows",
      ownerColumn: "gm_profile_id",
      ownerId: profile.id,
      inputs: payload.availability,
      max: 14
    });

    return {
      gm_profile_id: profile.id,
      display_name: prepared.display,
      role: "gm",
      system_slugs: slugs,
      availability_count: availability.length
    };
  });
}

export async function loadGMOnboarding(user) {
  const profile = await selectOne("gm_profiles", { user_id: eq(user.id) });
  if (!profile) throw new SupabaseRestError("GM onboarding has not been completed.", 404);
  const experiences = await selectMany("gm_system_experiences", {
    gm_profile_id: eq(profile.id),
    order: "id.asc"
  });
  if (!experiences.length) throw new SupabaseRestError("GM onboarding has not been completed.", 404);

  const systems = [];
  for (const item of experiences) {
    const system = await gameSystemById(item.game_system_id);
    const formats = await selectMany("gm_system_formats", {
      gm_system_experience_id: eq(item.id),
      order: "format.asc"
    });
    if (!formats.length) throw new SupabaseRestError("GM onboarding has not been completed.", 404);
    systems.push({
      system_slug: system?.slug || "other-rpg",
      years_playing: Number(item.years_playing),
      years_gming: Number(item.years_gming),
      comfort_level: item.comfort_level,
      preferred_player_experience: item.preferred_player_experience,
      formats: formats.map((row) => row.format),
      experience_notes: item.experience_notes || null
    });
  }

  const availability = await listAvailability({
    linkTable: "gm_availability_windows",
    ownerColumn: "gm_profile_id",
    ownerId: profile.id
  });
  if (!availability.length) throw new SupabaseRestError("GM onboarding has not been completed.", 404);

  return {
    display_name: user.display_name || "",
    bio: profile.bio || null,
    postal_code: profile.postal_code,
    travel_radius_miles: Number(profile.travel_radius_miles),
    beginner_friendly: Boolean(profile.beginner_friendly),
    gm_style: profile.gm_style,
    systems,
    availability
  };
}
