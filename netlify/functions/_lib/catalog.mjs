import { SupabaseRestError, eq, selectMany, selectOne } from "./supabase-rest.mjs";

export async function activeGameSystem(slug) {
  const system = await selectOne("game_systems", {
    slug: eq(String(slug || "").trim()),
    active: "is.true"
  });
  if (!system) throw new SupabaseRestError(`Unsupported or inactive game system: ${slug || "(blank)"}.`, 422);
  return system;
}

export async function activeGameSystems(slugs) {
  const unique = [...new Set((slugs || []).map((slug) => String(slug || "").trim()).filter(Boolean))];
  const systems = [];
  for (const slug of unique) systems.push(await activeGameSystem(slug));
  return new Map(systems.map((system) => [system.slug, system]));
}

export async function gameSystemById(id) {
  return selectOne("game_systems", { id: eq(id) });
}

export async function gameSystemsByIds(ids) {
  const map = new Map();
  for (const id of [...new Set(ids.filter(Boolean))]) {
    const system = await gameSystemById(id);
    if (system) map.set(id, system);
  }
  return map;
}

export async function listActiveGameSystems() {
  return selectMany("game_systems", { active: "is.true", order: "name.asc,edition.asc" });
}
