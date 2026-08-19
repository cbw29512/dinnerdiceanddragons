import { getDatabase } from "@netlify/database";

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const RESERVED_QUERY_KEYS = new Set(["select", "order", "limit", "offset"]);

export class DataAccessError extends Error {
  constructor(message, status = 500, detail = null) {
    super(message);
    this.name = "DataAccessError";
    this.status = status;
    this.detail = detail;
  }
}

// Temporary compatibility alias while the application modules are moved off the
// old adapter name. This is a local error type; it has no Supabase dependency.
export const SupabaseRestError = DataAccessError;

function database() {
  return getDatabase();
}

function identifier(value) {
  const text = String(value || "");
  if (!IDENTIFIER.test(text)) throw new DataAccessError("Unsafe database identifier.", 500);
  return `"${text}"`;
}

function normalizeParameter(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  return JSON.stringify(value);
}

function parseBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function compileFilter(column, expression, params) {
  const name = identifier(column);
  const raw = String(expression ?? "");

  if (raw === "is.null") return `${name} IS NULL`;
  if (raw === "not.is.null") return `${name} IS NOT NULL`;
  if (raw === "is.true" || raw === "is.false") {
    params.push(parseBoolean(raw.slice(3)));
    return `${name} IS NOT DISTINCT FROM $${params.length}`;
  }

  const operators = [
    ["eq.", "="],
    ["neq.", "<>"],
    ["lt.", "<"],
    ["lte.", "<="],
    ["gt.", ">"],
    ["gte.", ">="],
    ["like.", "LIKE"],
    ["ilike.", "ILIKE"]
  ];
  for (const [prefix, sqlOperator] of operators) {
    if (raw.startsWith(prefix)) {
      params.push(raw.slice(prefix.length));
      return `${name} ${sqlOperator} $${params.length}`;
    }
  }

  if (raw.startsWith("in.(") && raw.endsWith(")")) {
    const values = raw.slice(4, -1).split(",").map((value) => value.trim()).filter(Boolean);
    if (!values.length) return "FALSE";
    const placeholders = values.map((value) => {
      params.push(value);
      return `$${params.length}`;
    });
    return `${name} IN (${placeholders.join(", ")})`;
  }

  throw new DataAccessError(`Unsupported database filter for ${column}.`, 500);
}

function compileWhere(query, params) {
  const clauses = [];
  for (const [key, value] of Object.entries(query || {})) {
    if (RESERVED_QUERY_KEYS.has(key) || value === undefined || value === null || value === "") continue;
    clauses.push(compileFilter(key, value, params));
  }
  return clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
}

function compileOrder(order) {
  if (!order) return "";
  const pieces = String(order).split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!pieces.length) return "";
  const clauses = pieces.map((piece) => {
    const [column, direction = "asc"] = piece.split(".");
    const dir = String(direction).toLowerCase();
    if (!["asc", "desc"].includes(dir)) throw new DataAccessError("Unsafe database sort direction.", 500);
    return `${identifier(column)} ${dir.toUpperCase()}`;
  });
  return ` ORDER BY ${clauses.join(", ")}`;
}

function compileLimit(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback == null ? "" : ` LIMIT ${fallback}`;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10000) throw new DataAccessError("Unsafe database row limit.", 500);
  return ` LIMIT ${parsed}`;
}

function compileOffset(value) {
  if (value === undefined || value === null || value === "") return "";
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1000000) throw new DataAccessError("Unsafe database row offset.", 500);
  return ` OFFSET ${parsed}`;
}

function compileSelect(value) {
  if (!value || value === "*") return "*";
  const columns = String(value).split(",").map((column) => column.trim()).filter(Boolean);
  if (!columns.length) return "*";
  return columns.map(identifier).join(", ");
}

function mapDatabaseError(error) {
  if (error instanceof DataAccessError) return error;
  const code = String(error?.code || "");
  if (code === "23505") return new DataAccessError("A record with those values already exists.", 409, { code });
  if (code === "23503") return new DataAccessError("The requested change conflicts with related records.", 409, { code });
  if (["23502", "23514", "22P02", "22001"].includes(code)) {
    return new DataAccessError("The submitted data could not be stored.", 422, { code });
  }
  console.error("[Dinner Dice & Dragons] Netlify Database operation failed", error);
  return new DataAccessError("The database operation could not be completed.", 500, { code: code || null });
}

async function execute(sql, params = []) {
  try {
    return await database().sql.unsafe(sql, params.map(normalizeParameter));
  } catch (error) {
    throw mapDatabaseError(error);
  }
}

export async function databaseHealth() {
  try {
    const rows = await execute("SELECT 1 AS ok");
    return rows?.[0]?.ok === 1 || rows?.[0]?.ok === "1";
  } catch (error) {
    console.warn("[Dinner Dice & Dragons] Netlify Database health check unavailable", error?.message || error);
    return false;
  }
}

export async function selectOne(table, query = {}, { required = false } = {}) {
  const params = [];
  const sql = `SELECT ${compileSelect(query.select)} FROM ${identifier(table)}${compileWhere(query, params)}${compileOrder(query.order)} LIMIT 1`;
  const rows = await execute(sql, params);
  const row = Array.isArray(rows) ? rows[0] || null : null;
  if (required && !row) throw new DataAccessError(`${table} record was not found.`, 404);
  return row;
}

export async function selectMany(table, query = {}) {
  const params = [];
  const sql = `SELECT ${compileSelect(query.select)} FROM ${identifier(table)}${compileWhere(query, params)}${compileOrder(query.order)}${compileLimit(query.limit)}${compileOffset(query.offset)}`;
  const rows = await execute(sql, params);
  return Array.isArray(rows) ? rows : [];
}

function rowColumns(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new DataAccessError("Insert requires at least one row.", 500);
  const columns = Object.keys(rows[0]);
  if (!columns.length) throw new DataAccessError("Insert row has no columns.", 500);
  const expected = columns.join("\u0000");
  for (const row of rows) {
    if (Object.keys(row).join("\u0000") !== expected) throw new DataAccessError("Bulk insert rows must have identical columns.", 500);
  }
  return columns;
}

export async function insertRows(table, rows, { upsert = false, onConflict = null, returning = true } = {}) {
  const columns = rowColumns(rows);
  const params = [];
  const values = rows.map((row) => `(${columns.map((column) => {
    params.push(row[column]);
    return `$${params.length}`;
  }).join(", ")})`).join(", ");

  let conflict = "";
  if (upsert) {
    const conflictColumns = String(onConflict || "").split(",").map((column) => column.trim()).filter(Boolean);
    if (!conflictColumns.length) {
      conflict = " ON CONFLICT DO NOTHING";
    } else {
      const target = conflictColumns.map(identifier).join(", ");
      const conflictSet = new Set(conflictColumns);
      const mutable = columns.filter((column) => !conflictSet.has(column));
      conflict = mutable.length
        ? ` ON CONFLICT (${target}) DO UPDATE SET ${mutable.map((column) => `${identifier(column)} = EXCLUDED.${identifier(column)}`).join(", ")}`
        : ` ON CONFLICT (${target}) DO NOTHING`;
    }
  }

  const sql = `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(", ")}) VALUES ${values}${conflict}${returning ? " RETURNING *" : ""}`;
  const result = await execute(sql, params);
  return returning && Array.isArray(result) ? result : [];
}

export async function updateRows(table, query, values, { returning = true } = {}) {
  const columns = Object.keys(values || {});
  if (!columns.length) return [];
  const params = [];
  const assignments = columns.map((column) => {
    params.push(values[column]);
    return `${identifier(column)} = $${params.length}`;
  });
  const where = compileWhere(query, params);
  if (!where) throw new DataAccessError("Refusing to update without a filter.", 500);
  const sql = `UPDATE ${identifier(table)} SET ${assignments.join(", ")}${where}${returning ? " RETURNING *" : ""}`;
  const rows = await execute(sql, params);
  return returning && Array.isArray(rows) ? rows : [];
}

export async function deleteRows(table, query, { returning = false } = {}) {
  const params = [];
  const where = compileWhere(query, params);
  if (!where) throw new DataAccessError("Refusing to delete without a filter.", 500);
  const sql = `DELETE FROM ${identifier(table)}${where}${returning ? " RETURNING *" : ""}`;
  const rows = await execute(sql, params);
  return returning && Array.isArray(rows) ? rows : [];
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
