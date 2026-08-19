const DEFAULT_SUPABASE_URL = "https://acpjfycmwbnxzlkvoouv.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "sb_publishable_9V6jr7CdScW56IygolKgJQ_ul5v3pBb";

export class ApiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ApiConfigError";
  }
}

export class SupabaseRestError extends Error {
  constructor(message, status = 500, detail = null) {
    super(message);
    this.name = "SupabaseRestError";
    this.status = status;
    this.detail = detail;
  }
}

export function supabaseUrl() {
  const value = String(process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(value)) throw new ApiConfigError("SUPABASE_URL must be an HTTPS origin.");
  return value;
}

export function publishableKey() {
  return String(process.env.SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY).trim();
}

export function secretKey() {
  const value = String(process.env.SUPABASE_SECRET_KEY || "").trim();
  if (!value) throw new ApiConfigError("SUPABASE_SECRET_KEY is not configured.");
  return value;
}

function encodeQuery(query = {}) {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(query)) {
    if (raw === undefined || raw === null || raw === "") continue;
    if (Array.isArray(raw)) {
      for (const item of raw) params.append(key, String(item));
    } else {
      params.set(key, String(raw));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function adminRest(table, {
  method = "GET",
  query = {},
  body,
  prefer,
  headers: extraHeaders = {}
} = {}) {
  const url = `${supabaseUrl()}/rest/v1/${encodeURIComponent(table)}${encodeQuery(query)}`;
  const headers = new Headers({
    apikey: secretKey(),
    Accept: "application/json",
    ...extraHeaders
  });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (prefer) headers.set("Prefer", prefer);

  const response = await fetch(url, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const payload = await parseBody(response);
  if (!response.ok) {
    const message = payload?.message || payload?.msg || payload?.error_description || payload?.error || `Supabase request failed (${response.status}).`;
    throw new SupabaseRestError(message, response.status, payload);
  }
  return payload;
}

export async function rpc(name, body = {}) {
  const url = `${supabaseUrl()}/rest/v1/rpc/${encodeURIComponent(name)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: secretKey(),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await parseBody(response);
  if (!response.ok) {
    const message = payload?.message || payload?.error || `Supabase RPC failed (${response.status}).`;
    throw new SupabaseRestError(message, response.status, payload);
  }
  return payload;
}

export async function authenticateAccessToken(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) throw new SupabaseRestError("An authenticated session is required.", 401);
  const response = await fetch(`${supabaseUrl()}/auth/v1/user`, {
    headers: {
      apikey: publishableKey(),
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  const payload = await parseBody(response);
  if (!response.ok || !payload?.id || !payload?.email) {
    throw new SupabaseRestError("Authenticated session is invalid or expired.", 401, payload);
  }
  if (payload.is_anonymous === true) {
    throw new SupabaseRestError("Anonymous identities cannot use Dinner, Dice & Dragons.", 401);
  }
  return payload;
}

export async function selectOne(table, query, { required = false } = {}) {
  const rows = await adminRest(table, {
    query: { select: "*", ...query, limit: 1 }
  });
  const row = Array.isArray(rows) ? rows[0] || null : null;
  if (required && !row) throw new SupabaseRestError(`${table} record was not found.`, 404);
  return row;
}

export async function selectMany(table, query = {}) {
  const rows = await adminRest(table, { query: { select: "*", ...query } });
  return Array.isArray(rows) ? rows : [];
}

export async function insertRows(table, rows, { upsert = false, onConflict = null, returning = true } = {}) {
  const query = onConflict ? { on_conflict: onConflict } : {};
  const prefer = [
    upsert ? "resolution=merge-duplicates" : null,
    returning ? "return=representation" : "return=minimal"
  ].filter(Boolean).join(",");
  return adminRest(table, {
    method: "POST",
    query,
    body: rows,
    prefer
  });
}

export async function updateRows(table, query, values, { returning = true } = {}) {
  return adminRest(table, {
    method: "PATCH",
    query,
    body: values,
    prefer: returning ? "return=representation" : "return=minimal"
  });
}

export async function deleteRows(table, query, { returning = false } = {}) {
  return adminRest(table, {
    method: "DELETE",
    query,
    prefer: returning ? "return=representation" : "return=minimal"
  });
}

export function eq(value) {
  return `eq.${value}`;
}

export function neq(value) {
  return `neq.${value}`;
}

export function inList(values) {
  return `in.(${values.map((value) => String(value).replace(/[(),]/g, "")).join(",")})`;
}

export function isNull() {
  return "is.null";
}
