import { SupabaseRestError, eq, insertRows, selectOne, updateRows } from "./supabase-rest.mjs";
import { asArray, asString } from "./http.mjs";

export function optionalText(value, name, max = 2000) {
  return asString(value, name, { min: 0, max, nullable: true });
}

export function postalCode(value) {
  return asString(value, "postal_code", { min: 5, max: 5, pattern: /^\d{5}$/ });
}

export function enumValue(value, name, allowed) {
  const text = asString(value, name, { min: 1, max: 120 });
  if (!allowed.has(text)) throw new SupabaseRestError(`${name} is invalid.`, 422);
  return text;
}

export function uniqueStrings(value, name, { maxItems = 30, maxLength = 120 } = {}) {
  const items = asArray(value ?? [], name, { min: 0, max: maxItems })
    .map((item) => asString(item, name, { min: 1, max: maxLength }));
  const normalized = items.map((item) => item.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    throw new SupabaseRestError(`${name} contains duplicate values.`, 422);
  }
  return items;
}

export function onboardingSystems(payload, kind) {
  if (!payload || typeof payload !== "object") {
    throw new SupabaseRestError(`${kind} onboarding payload is invalid.`, 422);
  }
  const systems = asArray(payload.systems, "systems", { min: 1, max: 20 });
  const slugs = systems.map((item) =>
    asString(item?.system_slug, "system_slug", {
      min: 1,
      max: 120,
      pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    })
  );
  if (new Set(slugs).size !== slugs.length) {
    throw new SupabaseRestError(`Each game system may appear only once in ${kind} onboarding.`, 422);
  }
  return { systems, slugs };
}

export async function prepareDisplayName(user, raw) {
  const display = asString(raw, "display_name", { min: 1, max: 80 });
  const normalized = display.normalize("NFKC").trim().toLowerCase();
  const owner = await selectOne("users", { display_name_normalized: eq(normalized) });
  if (owner && owner.id !== user.id) {
    throw new SupabaseRestError("That display name is already in use.", 409);
  }
  const updated = await updateRows("users", { id: eq(user.id) }, {
    display_name: display,
    display_name_normalized: normalized,
    updated_at: new Date().toISOString()
  });
  return {
    display,
    user: Array.isArray(updated) && updated[0]
      ? updated[0]
      : { ...user, display_name: display, display_name_normalized: normalized }
  };
}

export async function upsertProfile(table, userId, values) {
  const existing = await selectOne(table, { user_id: eq(userId) });
  if (existing) {
    const rows = await updateRows(table, { id: eq(existing.id) }, values);
    return Array.isArray(rows) && rows[0] ? rows[0] : { ...existing, ...values };
  }
  const rows = await insertRows(table, [{ id: crypto.randomUUID(), user_id: userId, ...values }]);
  return rows[0];
}
