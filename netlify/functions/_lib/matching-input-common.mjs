import { listAvailability } from "./availability.mjs";
import { SupabaseRestError } from "./supabase-rest.mjs";
import { asArray, asString } from "./http.mjs";

export function enumValue(value, name, allowed) {
  const text = asString(value, name, { min: 1, max: 120 });
  if (!allowed.has(text)) throw new SupabaseRestError(`${name} is invalid.`, 422);
  return text;
}

export function optionalText(value, name, max = 2000) {
  return asString(value, name, { min: 0, max, nullable: true });
}

export function uniqueStrings(value, name, { max = 20, allowed = null } = {}) {
  const items = asArray(value ?? [], name, { min: 0, max })
    .map((item) => asString(item, name, { min: 1, max: 120 }));
  if (new Set(items.map((item) => item.toLowerCase())).size !== items.length) {
    throw new SupabaseRestError(`${name} contains duplicate values.`, 422);
  }
  if (allowed && items.some((item) => !allowed.has(item))) {
    throw new SupabaseRestError(`${name} contains an unsupported value.`, 422);
  }
  return items;
}

export async function signalAvailability(linkTable, ownerColumn, ownerId, fallback = null) {
  const specific = await listAvailability({ linkTable, ownerColumn, ownerId });
  if (specific.length || !fallback) return specific;
  return listAvailability(fallback);
}
