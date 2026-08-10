(() => {
  "use strict";

  const DAY_INDEX = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  const ORDINAL_INDEX = { First: 1, Second: 2, Third: 3, Fourth: 4, Last: -1 };

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function atNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  }

  function addDays(date, days) {
    const next = atNoon(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function parseLocalDate(value) {
    try {
      const [year, month, day] = String(value || "").split("-").map(Number);
      if (!year || !month || !day) return null;
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    } catch (error) {
      logError("Unable to parse local date", error);
      return null;
    }
  }

  function weeklyDates(rule, fromDate, count) {
    const dayIndex = DAY_INDEX[rule.day];
    if (dayIndex === undefined) return [];
    const intervalWeeks = Math.max(1, Number(rule.weekInterval) || 1);
    const from = atNoon(fromDate);
    let cursor = from;
    const delta = (dayIndex - cursor.getDay() + 7) % 7;
    cursor = addDays(cursor, delta);

    if (intervalWeeks > 1) {
      const anchor = parseLocalDate(rule.anchorDate);
      if (!anchor) return [];
      const anchorDelta = (dayIndex - anchor.getDay() + 7) % 7;
      const alignedAnchor = addDays(anchor, anchorDelta);
      while (cursor < alignedAnchor) cursor = addDays(cursor, 7);
      while (Math.round((cursor - alignedAnchor) / 86400000 / 7) % intervalWeeks !== 0) cursor = addDays(cursor, 7);
    }

    const results = [];
    while (results.length < count) {
      results.push(new Date(cursor));
      cursor = addDays(cursor, intervalWeeks * 7);
    }
    return results;
  }

  function nthWeekday(year, month, dayIndex, ordinal) {
    if (ordinal === -1) {
      const last = new Date(year, month + 1, 0, 12, 0, 0, 0);
      const delta = (last.getDay() - dayIndex + 7) % 7;
      return addDays(last, -delta);
    }
    const first = new Date(year, month, 1, 12, 0, 0, 0);
    const delta = (dayIndex - first.getDay() + 7) % 7;
    return addDays(first, delta + (ordinal - 1) * 7);
  }

  function monthlyDates(rule, fromDate, count) {
    const dayIndex = DAY_INDEX[rule.day];
    const ordinal = ORDINAL_INDEX[rule.monthlyOrdinal] || 1;
    const intervalMonths = Math.max(1, Number(rule.monthInterval) || 1);
    if (dayIndex === undefined) return [];
    const from = atNoon(fromDate);
    const results = [];
    let offset = 0;
    while (results.length < count && offset < 60) {
      const probe = new Date(from.getFullYear(), from.getMonth() + offset, 1, 12, 0, 0, 0);
      const candidate = nthWeekday(probe.getFullYear(), probe.getMonth(), dayIndex, ordinal);
      if (candidate >= from) results.push(candidate);
      offset += intervalMonths;
    }
    return results;
  }

  function nextDates(rule, count = 6, fromDate = new Date()) {
    try {
      return rule.pattern === "monthly"
        ? monthlyDates(rule, fromDate, count)
        : weeklyDates(rule, fromDate, count);
    } catch (error) {
      logError("Unable to generate recurrence dates", error);
      return [];
    }
  }

  window.DDDRecurrence = { nextDates, parseLocalDate };
})();
