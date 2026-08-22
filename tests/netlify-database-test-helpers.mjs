export function weeklyAvailability(day, start = "18:00", end = "22:00") {
  return {
    day_of_week: day,
    start_time: start,
    end_time: end,
    pattern_type: "weekly_interval",
    week_interval: 1,
    anchor_date: null,
    monthly_ordinal: null,
    month_interval: null,
    timezone: "America/New_York",
    starts_on: null,
    ends_on: null
  };
}

export async function withUuidSequence(values, callback) {
  const original = globalThis.crypto.randomUUID;
  let index = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => values[index++] || original.call(globalThis.crypto)
  });
  try {
    return await callback();
  } finally {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: original
    });
  }
}
