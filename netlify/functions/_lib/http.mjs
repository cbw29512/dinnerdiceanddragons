import { ApiConfigError, SupabaseRestError } from "./supabase-rest.mjs";

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}

export function noContent() {
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function readJson(request, { maxBytes = 64 * 1024 } = {}) {
  const type = String(request.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("application/json")) throw new SupabaseRestError("Request body must be JSON.", 415);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) throw new SupabaseRestError("Request body is too large.", 413);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new SupabaseRestError("Request body contains invalid JSON.", 400);
  }
}

export function pathParts(request) {
  const pathname = new URL(request.url).pathname;
  const path = pathname
    .replace(/^\/auth-api\/v1\/?/, "")
    .replace(/^\/api\/v1\/?/, "");
  return path.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
}

export function methodNotAllowed(allowed) {
  return json({ detail: "Method not allowed." }, 405, { Allow: allowed.join(", ") });
}

export function notFound() {
  return json({ detail: "Not found." }, 404);
}

export function asInteger(value, name, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER, fallback } = {}) {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new SupabaseRestError(`${name} must be an integer between ${min} and ${max}.`, 422);
  return number;
}

export function asNumber(value, name, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new SupabaseRestError(`${name} must be a number between ${min} and ${max}.`, 422);
  return number;
}

export function asString(value, name, { min = 0, max = 10000, nullable = false, pattern = null } = {}) {
  if ((value === undefined || value === null || value === "") && nullable) return null;
  if (typeof value !== "string") throw new SupabaseRestError(`${name} must be text.`, 422);
  const text = value.trim();
  if (text.length < min || text.length > max || (pattern && !pattern.test(text))) throw new SupabaseRestError(`${name} is invalid.`, 422);
  return text;
}

export function asArray(value, name, { min = 0, max = 1000 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new SupabaseRestError(`${name} must contain between ${min} and ${max} items.`, 422);
  return value;
}

export function asBoolean(value, name) {
  if (typeof value !== "boolean") throw new SupabaseRestError(`${name} must be true or false.`, 422);
  return value;
}

export function requireUuid(value, name = "id") {
  const text = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) throw new SupabaseRestError(`${name} must be a valid UUID.`, 422);
  return text;
}

export function errorResponse(error) {
  if (error instanceof SupabaseRestError) {
    const body = { detail: error.message };
    if (process.env.CONTEXT !== "production" && error.detail) body.debug = error.detail;
    return json(body, error.status || 500);
  }
  if (error instanceof ApiConfigError) {
    console.error("[Dinner Dice & Dragons] Native API configuration error", error);
    return json({ detail: "Production API configuration is incomplete." }, 503);
  }
  console.error("[Dinner Dice & Dragons] Native API failure", error);
  return json({ detail: "Production API request failed." }, 500);
}

export async function route(handler) {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}
