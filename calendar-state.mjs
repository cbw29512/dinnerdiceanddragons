export const DAYS = Object.freeze([
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
]);

export class AvailabilityStateError extends Error {
  constructor(message) {
    super(message);
    this.name = "AvailabilityStateError";
  }
}

export function timeToMinutes(value) {
  try {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
    if (!match) throw new AvailabilityStateError(`Invalid time: ${value}`);
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) throw new AvailabilityStateError(`Invalid time: ${value}`);
    return hour * 60 + minute;
  } catch (error) {
    if (error instanceof AvailabilityStateError) throw error;
    throw new AvailabilityStateError("Unable to parse availability time.");
  }
}

export function minutesToTime(value) {
  try {
    const minutes = Number(value);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) {
      throw new AvailabilityStateError(`Invalid minute value: ${value}`);
    }
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  } catch (error) {
    if (error instanceof AvailabilityStateError) throw error;
    throw new AvailabilityStateError("Unable to format availability time.");
  }
}

function normalizeRecurrence(raw = {}) {
  const type = raw.type === "monthly" ? "monthly" : "weekly";
  const max = type === "monthly" ? 3 : 4;
  const interval = Math.max(1, Math.min(max, Number(raw.interval || 1)));
  return Object.freeze({
    type,
    interval,
    anchorDate: interval > 1 ? raw.anchorDate || null : null,
    ordinal: raw.ordinal || "Last"
  });
}

export function normalizeBlock(raw) {
  try {
    const day = String(raw?.day || "");
    if (!DAYS.includes(day)) throw new AvailabilityStateError(`Invalid day: ${day}`);
    const start = String(raw?.start || "");
    const end = String(raw?.end || "");
    if (timeToMinutes(start) >= timeToMinutes(end)) {
      throw new AvailabilityStateError("Availability start must be before end.");
    }
    return Object.freeze({
      id: String(raw?.id || crypto.randomUUID()),
      day,
      start,
      end,
      recurrence: normalizeRecurrence(raw?.recurrence)
    });
  } catch (error) {
    if (error instanceof AvailabilityStateError) throw error;
    throw new AvailabilityStateError("Unable to normalize availability block.");
  }
}

function recurrenceKey(block) {
  return JSON.stringify(block.recurrence);
}

export function mergeCompatibleBlocks(rawBlocks) {
  try {
    const groups = new Map();
    for (const raw of rawBlocks || []) {
      const block = normalizeBlock(raw);
      const key = JSON.stringify([block.day, block.recurrence]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(block);
    }
    const merged = [];
    for (const blocks of groups.values()) {
      blocks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
      for (const block of blocks) {
        const previous = merged.at(-1);
        if (
          previous && previous.day === block.day &&
          recurrenceKey(previous) === recurrenceKey(block) &&
          timeToMinutes(block.start) <= timeToMinutes(previous.end)
        ) {
          merged[merged.length - 1] = normalizeBlock({
            ...previous,
            end: timeToMinutes(block.end) > timeToMinutes(previous.end) ? block.end : previous.end
          });
        } else merged.push(block);
      }
    }
    return merged;
  } catch (error) {
    if (error instanceof AvailabilityStateError) throw error;
    throw new AvailabilityStateError("Unable to merge availability blocks.");
  }
}

export function createAvailabilityState(blocks = []) {
  try {
    return Object.freeze({ blocks: Object.freeze(mergeCompatibleBlocks(blocks)) });
  } catch (error) {
    if (error instanceof AvailabilityStateError) throw error;
    throw new AvailabilityStateError("Unable to create availability state.");
  }
}

export function replaceAvailabilityBlock(blocks, id, replacement) {
  try {
    const current = (blocks || []).find((block) => block.id === id);
    if (!current) throw new AvailabilityStateError("Availability block was not found.");
    return createAvailabilityState((blocks || []).map((block) => (
      block.id === id ? { ...current, ...replacement, id } : block
    ))).blocks;
  } catch (error) {
    if (error instanceof AvailabilityStateError) throw error;
    throw new AvailabilityStateError("Unable to update availability block.");
  }
}
