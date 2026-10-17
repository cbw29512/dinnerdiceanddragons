import { createAvailabilityState } from "./calendar-state.mjs";

export function blocksToLegacyFields(blocks) {
  try {
    const state = createAvailabilityState(blocks);
    const fields = {
      availability_day: [], availability_start: [], availability_end: [],
      availability_pattern: [], availability_week_interval: [], availability_anchor_date: [],
      availability_monthly_ordinal: [], availability_month_interval: []
    };
    for (const block of state.blocks) {
      const monthly = block.recurrence.type === "monthly";
      fields.availability_day.push(block.day);
      fields.availability_start.push(block.start);
      fields.availability_end.push(block.end);
      fields.availability_pattern.push(monthly ? "monthly" : "weekly");
      fields.availability_week_interval.push(monthly ? "1" : String(block.recurrence.interval));
      fields.availability_anchor_date.push(block.recurrence.anchorDate || "");
      fields.availability_monthly_ordinal.push(block.recurrence.ordinal || "Last");
      fields.availability_month_interval.push(monthly ? String(block.recurrence.interval) : "1");
    }
    return fields;
  } catch (error) {
    console.error("[DDD Calendar] Unable to convert calendar state", error);
    throw error;
  }
}

export function legacyFieldsToBlocks(raw) {
  try {
    const array = (value) => Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
    const days = array(raw?.availability_day);
    const starts = array(raw?.availability_start);
    const ends = array(raw?.availability_end);
    const patterns = array(raw?.availability_pattern);
    const weeks = array(raw?.availability_week_interval);
    const anchors = array(raw?.availability_anchor_date);
    const ordinals = array(raw?.availability_monthly_ordinal);
    const months = array(raw?.availability_month_interval);
    return createAvailabilityState(days.map((day, index) => {
      const monthly = patterns[index] === "monthly";
      return {
        day, start: starts[index], end: ends[index],
        recurrence: {
          type: monthly ? "monthly" : "weekly",
          interval: Number(monthly ? months[index] || 1 : weeks[index] || 1),
          anchorDate: anchors[index] || null,
          ordinal: ordinals[index] || "Last"
        }
      };
    })).blocks;
  } catch (error) {
    console.error("[DDD Calendar] Unable to load legacy availability", error);
    throw error;
  }
}
