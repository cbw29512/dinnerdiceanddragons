import { SupabaseRestError, eq, insertRows, selectMany, selectOne, updateRows } from "./supabase-rest.mjs";
import { asArray, asInteger, asString } from "./http.mjs";

const DAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const ORDINALS = new Set(["first", "second", "third", "fourth", "last"]);
const PATTERNS = new Set(["weekly_interval", "monthly_ordinal_weekday"]);

function localTime(value, name) {
  const text = asString(String(value || ""), name, { min: 5, max: 8 });
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (!match) throw new SupabaseRestError(`${name} must be a local HH:MM time.`, 422);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) throw new SupabaseRestError(`${name} is invalid.`, 422);
  return `${match[1]}:${match[2]}:${String(second).padStart(2, "0")}`;
}

function dateOrNull(value, name) {
  if (value === undefined || value === null || value === "") return null;
  const text = asString(String(value), name, { min: 10, max: 10, pattern: /^\d{4}-\d{2}-\d{2}$/ });
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new SupabaseRestError(`${name} must be a valid date.`, 422);
  }
  return text;
}

function timezone(value) {
  const zone = asString(value, "timezone", { min: 1, max: 64 });
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
  } catch {
    throw new SupabaseRestError("timezone must be a valid IANA timezone.", 422);
  }
  return zone;
}

export function normalizeAvailability(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SupabaseRestError("Availability window is invalid.", 422);
  }
  const day = asString(input.day_of_week, "day_of_week", { min: 1, max: 16 }).toLowerCase();
  if (!DAYS.has(day)) throw new SupabaseRestError("day_of_week is invalid.", 422);
  const start = localTime(input.start_time, "start_time");
  const end = localTime(input.end_time, "end_time");
  if (start >= end) throw new SupabaseRestError("Availability start time must be before end time.", 422);
  const pattern = asString(input.pattern_type, "pattern_type", { min: 1, max: 40 });
  if (!PATTERNS.has(pattern)) throw new SupabaseRestError("pattern_type is invalid.", 422);
  const startsOn = dateOrNull(input.starts_on, "starts_on");
  const endsOn = dateOrNull(input.ends_on, "ends_on");
  if (startsOn && endsOn && startsOn > endsOn) throw new SupabaseRestError("starts_on cannot be after ends_on.", 422);

  let weekInterval = null;
  let anchorDate = dateOrNull(input.anchor_date, "anchor_date");
  let monthlyOrdinal = input.monthly_ordinal == null ? null : String(input.monthly_ordinal).trim().toLowerCase();
  let monthInterval = null;

  if (pattern === "weekly_interval") {
    weekInterval = asInteger(input.week_interval, "week_interval", { min: 1, max: 4 });
    if (input.monthly_ordinal != null || input.month_interval != null) {
      throw new SupabaseRestError("Weekly availability cannot include monthly recurrence fields.", 422);
    }
    if (weekInterval === 1) anchorDate = null;
    if (weekInterval > 1 && !anchorDate) throw new SupabaseRestError("Alternating weekly availability requires anchor_date.", 422);
    monthlyOrdinal = null;
  } else {
    if (input.week_interval != null) throw new SupabaseRestError("Monthly availability cannot include week_interval.", 422);
    monthInterval = asInteger(input.month_interval, "month_interval", { min: 1, max: 3 });
    if (!ORDINALS.has(monthlyOrdinal)) throw new SupabaseRestError("monthly_ordinal is invalid.", 422);
    if (monthInterval === 1) anchorDate = null;
    if (monthInterval > 1 && !anchorDate) throw new SupabaseRestError("Alternating monthly availability requires anchor_date.", 422);
  }

  return {
    id: crypto.randomUUID(),
    day_of_week: day,
    start_time: start,
    end_time: end,
    pattern_type: pattern,
    week_interval: weekInterval,
    anchor_date: anchorDate,
    monthly_ordinal: monthlyOrdinal,
    month_interval: monthInterval,
    timezone: timezone(input.timezone),
    starts_on: startsOn,
    ends_on: endsOn,
    active: true,
    updated_at: new Date().toISOString()
  };
}

export function normalizeAvailabilityList(value, { min = 1, max = 14 } = {}) {
  return asArray(value, "availability", { min, max }).map(normalizeAvailability);
}

export function publicAvailability(rule) {
  const shortTime = (value) => String(value || "").slice(0, 5);
  return {
    day_of_week: rule.day_of_week,
    start_time: shortTime(rule.start_time),
    end_time: shortTime(rule.end_time),
    pattern_type: rule.pattern_type,
    week_interval: rule.week_interval == null ? null : Number(rule.week_interval),
    anchor_date: rule.anchor_date || null,
    monthly_ordinal: rule.monthly_ordinal || null,
    month_interval: rule.month_interval == null ? null : Number(rule.month_interval),
    timezone: rule.timezone,
    starts_on: rule.starts_on || null,
    ends_on: rule.ends_on || null
  };
}

export async function replaceAvailability({ linkTable, ownerColumn, ownerId, inputs, max = 14 }) {
  const rules = normalizeAvailabilityList(inputs, { min: 1, max });
  const existing = await selectMany(linkTable, { [ownerColumn]: eq(ownerId), active: "is.true" });
  for (const link of existing) {
    await updateRows(linkTable, { id: eq(link.id) }, { active: false }, { returning: false });
  }
  for (const rule of rules) {
    await insertRows("recurring_availability_rules", [rule], { returning: false });
    await insertRows(linkTable, [{
      id: crypto.randomUUID(),
      [ownerColumn]: ownerId,
      recurring_rule_id: rule.id,
      active: true
    }], { returning: false });
  }
  return rules.map(publicAvailability);
}

export async function listAvailability({ linkTable, ownerColumn, ownerId, activeOnly = true }) {
  const links = await selectMany(linkTable, {
    [ownerColumn]: eq(ownerId),
    ...(activeOnly ? { active: "is.true" } : {}),
    order: "id.asc"
  });
  const values = [];
  for (const link of links) {
    const rule = await selectOne("recurring_availability_rules", {
      id: eq(link.recurring_rule_id),
      ...(activeOnly ? { active: "is.true" } : {})
    });
    if (rule) values.push(publicAvailability(rule));
  }
  return values;
}

export async function createSignalAvailability({ linkTable, ownerColumn, ownerId, inputs }) {
  const rules = normalizeAvailabilityList(inputs, { min: 1, max: 12 });
  for (const rule of rules) {
    await insertRows("recurring_availability_rules", [rule], { returning: false });
    await insertRows(linkTable, [{
      id: crypto.randomUUID(),
      [ownerColumn]: ownerId,
      recurring_rule_id: rule.id,
      active: true
    }], { returning: false });
  }
  return rules.map(publicAvailability);
}
