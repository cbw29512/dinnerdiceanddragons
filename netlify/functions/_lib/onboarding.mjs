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
  updateRows,
  withTransaction
} from "./supabase-rest.mjs";
import { asArray, asBoolean, asNumber, asString } from "./http.mjs";

const PLAYER_FORMATS = new Set(["any", "learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"]);
const PLAYER_COMFORT = new Set(["new", "learning", "comfortable", "very_experienced"]);
const GM_COMFORT = new Set(["learning", "comfortable", "very_comfortable", "expert"]);
const GM_FORMATS = new Set(["learn_to_play", "one_shot", "short_campaign", "long_campaign", "organized_play"]);
const PLAYER_EXPERIENCE = new Set(["new", "some_experience", "experienced", "any"]);
const VENUE_TYPES = new Set(["public_venue", "restaurant", "cafe", "brewery", "library", "game_store", "community_space", "other"]);
const VENUE_MANAGER_ROLES = new Set(["manager", "owner", "staff"]);

function optionalText(value, name, max = 2000) {
  return asString(value, name, { min: 0, max, nullable: true });
}

function postalCode(value) {
  return asString(value, "postal_code", { min: 5, max: 5, pattern: /^\d{5}$/ });
}

function enumValue(value, name, allowed) {
  const text = asString(value, name, { min: 1, max: 120 });
  if (!allowed.has(text)) throw new SupabaseRestError(`${name} is invalid.`, 422);
  return text;
}

function uniqueStrings(value, name, { maxItems = 30, maxLength = 120 } = {}) {
  const items = asArray(value ?? [], name, { min: 0, max: maxItems }).map((item) => asString(item, name, { min: 1, max: maxLength }));
  const normalized = items.map((item) => item.toLowerCase());
  if (new Set(normalized).size !== normalized.length) throw new SupabaseRestError(`${name} contains duplicate values.`, 422);
  return items;
}

async function prepareDisplayName(user, raw) {
  const display = asString(raw, "display_name", { min: 1, max: 80 });
  const normalized = display.normalize("NFKC").trim().toLowerCase();
  const owner = await selectOne("users", { display_name_normalized: eq(normalized) });
  if (owner && owner.id !== user.id) throw new SupabaseRestError("That display name is already in use.", 409);
  const updated = await updateRows("users", { id: eq(user.id) }, {
    display_name: display,
    display_name_normalized: normalized,
    updated_at: new Date().toISOString()
  });
  return { display, user: Array.isArray(updated) && updated[0] ? updated[0] : { ...user, display_name: display, display_name_normalized: normalized } };
}

async function upsertProfile(table, userId, values) {
  const existing = await selectOne(table, { user_id: eq(userId) });
  if (existing) {
    const rows = await updateRows(table, { id: eq(existing.id) }, values);
    return Array.isArray(rows) && rows[0] ? rows[0] : { ...existing, ...values };
  }
  const rows = await insertRows(table, [{ id: crypto.randomUUID(), user_id: userId, ...values }]);
  return rows[0];
}

async function clearPlayerSystems(profileId) {
  const existing = await selectMany("player_system_experiences", { player_profile_id: eq(profileId) });
  if (existing.length) await deleteRows("player_system_experiences", { id: inList(existing.map((row) => row.id)) });
}

async function clearGMSystems(profileId) {
  const existing = await selectMany("gm_system_experiences", { gm_profile_id: eq(profileId) });
  if (!existing.length) return;
  const ids = existing.map((row) => row.id);
  await deleteRows("gm_system_formats", { gm_system_experience_id: inList(ids) });
  await deleteRows("gm_system_experiences", { id: inList(ids) });
}

export async function savePlayerOnboarding(user, payload) {
  if (!payload || typeof payload !== "object") throw new SupabaseRestError("Player onboarding payload is invalid.", 422);
  const systems = asArray(payload.systems, "systems", { min: 1, max: 20 });
  const slugs = systems.map((item) => asString(item?.system_slug, "system_slug", { min: 1, max: 120, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }));
  if (new Set(slugs).size !== slugs.length) throw new SupabaseRestError("Each game system may appear only once in Player onboarding.", 422);
  const catalog = await activeGameSystems(slugs);
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
    const slug = slugs[index];
    const comfort = enumValue(item.comfort_level, "comfort_level", PLAYER_COMFORT);
    await insertRows("player_system_experiences", [{
      id: crypto.randomUUID(),
      player_profile_id: profile.id,
      game_system_id: catalog.get(slug).id,
      years_playing: asNumber(item.years_playing, "years_playing", { min: 0, max: 80 }),
      comfort_level: comfort,
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
}

export async function saveGMOnboarding(user, payload) {
  if (!payload || typeof payload !== "object") throw new SupabaseRestError("GM onboarding payload is invalid.", 422);
  const systems = asArray(payload.systems, "systems", { min: 1, max: 20 });
  const slugs = systems.map((item) => asString(item?.system_slug, "system_slug", { min: 1, max: 120, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ }));
  if (new Set(slugs).size !== slugs.length) throw new SupabaseRestError("Each game system may appear only once in GM onboarding.", 422);
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
      const formats = asArray(item.formats, "formats", { min: 1, max: 5 }).map((value) => enumValue(value, "format", GM_FORMATS));
      if (new Set(formats).size !== formats.length) throw new SupabaseRestError("Each GM game format may appear only once per system.", 422);
      const experienceId = crypto.randomUUID();
      await insertRows("gm_system_experiences", [{
        id: experienceId,
        gm_profile_id: profile.id,
        game_system_id: catalog.get(slugs[index]).id,
        years_playing: asNumber(item.years_playing, "years_playing", { min: 0, max: 80 }),
        years_gming: asNumber(item.years_gming, "years_gming", { min: 0, max: 80 }),
        comfort_level: enumValue(item.comfort_level, "comfort_level", GM_COMFORT),
        preferred_player_experience: enumValue(item.preferred_player_experience ?? "any", "preferred_player_experience", PLAYER_EXPERIENCE),
        experience_notes: optionalText(item.experience_notes, "experience_notes")
      }], { returning: false });
      await insertRows("gm_system_formats", formats.map((format) => ({ gm_system_experience_id: experienceId, format })), { returning: false });
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

export async function loadPlayerOnboarding(user) {
  const profile = await selectOne("player_profiles", { user_id: eq(user.id) });
  if (!profile) throw new SupabaseRestError("Player onboarding has not been completed.", 404);
  const experiences = await selectMany("player_system_experiences", { player_profile_id: eq(profile.id), order: "id.asc" });
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
    availability: await listAvailability({
      linkTable: "player_availability_windows",
      ownerColumn: "player_profile_id",
      ownerId: profile.id
    })
  };
}

export async function loadGMOnboarding(user) {
  const profile = await selectOne("gm_profiles", { user_id: eq(user.id) });
  if (!profile) throw new SupabaseRestError("GM onboarding has not been completed.", 404);
  const experiences = await selectMany("gm_system_experiences", { gm_profile_id: eq(profile.id), order: "id.asc" });
  if (!experiences.length) throw new SupabaseRestError("GM onboarding has not been completed.", 404);

  const systems = [];
  for (const item of experiences) {
    const system = await gameSystemById(item.game_system_id);
    const formats = await selectMany("gm_system_formats", { gm_system_experience_id: eq(item.id), order: "format.asc" });
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

function slugBase(name, city, state) {
  return `${name}-${city}-${state}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "venue";
}

export async function createVenueOnboarding(user, payload) {
  if (!payload || typeof payload !== "object") throw new SupabaseRestError("Venue onboarding payload is invalid.", 422);
  const name = asString(payload.name, "name", { min: 1, max: 160 });
  const address = asString(payload.address_line1, "address_line1", { min: 1, max: 200 });
  const city = asString(payload.city, "city", { min: 1, max: 100 });
  const state = asString(payload.state_region, "state_region", { min: 2, max: 2, pattern: /^[A-Za-z]{2}$/ }).toUpperCase();
  const zip = postalCode(payload.postal_code);

  const nearby = await selectMany("venues", { postal_code: eq(zip) });
  const duplicate = nearby.find((venue) =>
    String(venue.name || "").toLowerCase() === name.toLowerCase() &&
    String(venue.address_line1 || "").toLowerCase() === address.toLowerCase() &&
    String(venue.city || "").toLowerCase() === city.toLowerCase() &&
    venue.state_region === state
  );
  if (duplicate) throw new SupabaseRestError("That venue already appears to exist. Use the existing-venue claim flow.", 409);

  await ensureRole(user.id, "venue_manager");
  const venueId = crypto.randomUUID();
  const managerId = crypto.randomUUID();
  const managerRole = enumValue(payload.manager_role ?? "manager", "manager_role", VENUE_MANAGER_ROLES);
  const venueType = enumValue(payload.venue_type ?? "public_venue", "venue_type", VENUE_TYPES);
  const venue = {
    id: venueId,
    name,
    slug: `${slugBase(name, city, state)}-${venueId.replaceAll("-", "").slice(0, 8)}`.slice(0, 180),
    venue_type: venueType,
    address_line1: address,
    address_line2: optionalText(payload.address_line2, "address_line2", 200),
    city,
    state_region: state,
    postal_code: zip,
    latitude: null,
    longitude: null,
    website_url: optionalText(payload.website_url, "website_url", 500),
    phone: optionalText(payload.phone, "phone", 40),
    verified: false,
    amenities: uniqueStrings(payload.amenities ?? [], "amenities", { maxItems: 30 }),
    host_support_offerings: uniqueStrings(payload.host_support_offerings ?? [], "host_support_offerings", { maxItems: 30 }),
    host_support_notes: optionalText(payload.host_support_notes, "host_support_notes"),
    accessibility_notes: optionalText(payload.accessibility_notes, "accessibility_notes"),
    parking_notes: optionalText(payload.parking_notes, "parking_notes"),
    noise_notes: optionalText(payload.noise_notes, "noise_notes"),
    lighting_notes: optionalText(payload.lighting_notes, "lighting_notes"),
    active: true
  };
  await insertRows("venues", [venue], { returning: false });
  await insertRows("venue_managers", [{
    id: managerId,
    venue_id: venueId,
    user_id: user.id,
    role: managerRole,
    verified_at: null
  }], { returning: false });

  return {
    venue_id: venueId,
    venue_manager_id: managerId,
    name,
    slug: venue.slug,
    role: managerRole,
    venue_verified: false,
    manager_verified: false
  };
}
