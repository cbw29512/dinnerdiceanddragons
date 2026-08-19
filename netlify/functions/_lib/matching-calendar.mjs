import { SupabaseRestError } from "./supabase-rest.mjs";

const WEEKDAY = new Map([
  ["sunday", 0], ["monday", 1], ["tuesday", 2], ["wednesday", 3],
  ["thursday", 4], ["friday", 5], ["saturday", 6]
]);
const ORDINAL = new Map([["first", 1], ["second", 2], ["third", 3], ["fourth", 4]]);

function parseDate(value) {
  const text = String(value || "");
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new SupabaseRestError("Persisted recurrence date is invalid.", 500);
  }
  return date;
}

function dateText(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(year, month) {
  return month === 12 ? [year + 1, 1] : [year, month + 1];
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function ordinalWeekday(year, month, weekday, ordinal) {
  if (ordinal === "last") {
    const last = new Date(Date.UTC(year, month - 1, daysInMonth(year, month)));
    const delta = (last.getUTCDay() - weekday + 7) % 7;
    return addDays(last, -delta);
  }
  const nth = ORDINAL.get(ordinal);
  if (!nth) throw new SupabaseRestError("Persisted monthly ordinal is invalid.", 500);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  return addDays(first, delta + 7 * (nth - 1));
}

function monthsBetween(year, month, anchor) {
  return (year - anchor.getUTCFullYear()) * 12 + month - (anchor.getUTCMonth() + 1);
}

export function occurrenceDates(rule, windowStart, windowEnd) {
  if (!rule?.active) return [];
  const start = typeof windowStart === "string" ? parseDate(windowStart) : new Date(windowStart);
  const end = typeof windowEnd === "string" ? parseDate(windowEnd) : new Date(windowEnd);
  if (start > end) throw new SupabaseRestError("Match horizon start cannot be after its end.", 422);
  const ruleStart = rule.starts_on ? parseDate(rule.starts_on) : start;
  const ruleEnd = rule.ends_on ? parseDate(rule.ends_on) : end;
  const lower = ruleStart > start ? ruleStart : start;
  const upper = ruleEnd < end ? ruleEnd : end;
  if (lower > upper) return [];
  const weekday = WEEKDAY.get(rule.day_of_week);
  if (weekday == null) throw new SupabaseRestError("Persisted recurrence weekday is invalid.", 500);

  if (rule.pattern_type === "weekly_interval") {
    const interval = Number(rule.week_interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 4) throw new SupabaseRestError("Persisted weekly interval is invalid.", 500);
    const delta = (weekday - lower.getUTCDay() + 7) % 7;
    let candidate = addDays(lower, delta);
    const anchor = rule.anchor_date ? parseDate(rule.anchor_date) : null;
    if (interval > 1 && (!anchor || anchor.getUTCDay() !== weekday)) throw new SupabaseRestError("Persisted weekly recurrence anchor is invalid.", 500);
    const result = [];
    while (candidate <= upper) {
      const weeks = anchor ? Math.floor((candidate - anchor) / 604800000) : 0;
      if (interval === 1 || ((weeks % interval) + interval) % interval === 0) result.push(dateText(candidate));
      candidate = addDays(candidate, 7);
    }
    return result;
  }

  if (rule.pattern_type === "monthly_ordinal_weekday") {
    const interval = Number(rule.month_interval);
    if (!Number.isInteger(interval) || interval < 1 || interval > 3) throw new SupabaseRestError("Persisted monthly interval is invalid.", 500);
    if (![...ORDINAL.keys(), "last"].includes(rule.monthly_ordinal)) throw new SupabaseRestError("Persisted monthly ordinal is invalid.", 500);
    const anchor = rule.anchor_date ? parseDate(rule.anchor_date) : null;
    if (interval > 1 && !anchor) throw new SupabaseRestError("Persisted monthly recurrence anchor is missing.", 500);
    let year = lower.getUTCFullYear();
    let month = lower.getUTCMonth() + 1;
    const result = [];
    while (year < upper.getUTCFullYear() || (year === upper.getUTCFullYear() && month <= upper.getUTCMonth() + 1)) {
      const monthOk = interval === 1 || ((monthsBetween(year, month, anchor) % interval) + interval) % interval === 0;
      if (monthOk) {
        const candidate = ordinalWeekday(year, month, weekday, rule.monthly_ordinal);
        if (candidate >= lower && candidate <= upper) result.push(dateText(candidate));
      }
      [year, month] = addMonths(year, month);
    }
    return result;
  }

  throw new SupabaseRestError("Persisted recurrence pattern is unsupported.", 500);
}

function zoneParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second)
  };
}

function localDateTimeToUtc(dateTextValue, timeText, timeZone) {
  const [year, month, day] = dateTextValue.split("-").map(Number);
  const [hour, minute, second = 0] = String(timeText).split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = desired;
  for (let index = 0; index < 3; index += 1) {
    const parts = zoneParts(new Date(guess), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const delta = represented - desired;
    if (delta === 0) break;
    guess -= delta;
  }
  const finalParts = zoneParts(new Date(guess), timeZone);
  if (
    finalParts.year !== year || finalParts.month !== month || finalParts.day !== day ||
    finalParts.hour !== hour || finalParts.minute !== minute
  ) {
    throw new SupabaseRestError("Recurring availability falls in an invalid local clock time.", 422);
  }
  return new Date(guess);
}

export function occurrences(rule, windowStart, windowEnd) {
  return occurrenceDates(rule, windowStart, windowEnd).map((date) => ({
    startAt: localDateTimeToUtc(date, rule.start_time, rule.timezone),
    endAt: localDateTimeToUtc(date, rule.end_time, rule.timezone),
    timezone: rule.timezone
  }));
}

export function intersect(left, right) {
  const startAt = left.startAt > right.startAt ? left.startAt : right.startAt;
  const endAt = left.endAt < right.endAt ? left.endAt : right.endAt;
  if (startAt >= endAt) return null;
  return { startAt, endAt, timezone: right.timezone || left.timezone };
}

export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(dateTextValue, days) {
  return dateText(addDays(parseDate(dateTextValue), days));
}
