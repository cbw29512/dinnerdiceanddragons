import { legacyFieldsToBlocks, blocksToLegacyFields } from "./availability-adapter.mjs";
import { collectLegacyFields, syncLegacyInputs } from "./availability-form-bridge.mjs";
import { AvailabilityCalendar } from "./calendar-ui.mjs";

function labelFor(builder) {
  const form = builder.closest("form");
  if (form?.id === "gm-form") return "When can you DM?";
  if (form?.id === "venue-form") return "When can your venue host a table?";
  return "When can you play?";
}

function enhance(builder) {
  try {
    if (builder.dataset.calendarEnhanced === "true") return;
    const legacyList = builder.querySelector(".availability-list");
    const addButton = builder.querySelector(".add-availability");
    if (!legacyList) return;
    let blocks = legacyFieldsToBlocks(collectLegacyFields(legacyList));
    if (!blocks.length) {
      blocks = [{ day: "Monday", start: "18:00", end: "22:00", recurrence: { type: "weekly", interval: 1 } }];
    }
    legacyList.querySelectorAll("input, select, button").forEach((node) => { node.disabled = true; });
    legacyList.hidden = true;
    if (addButton) addButton.hidden = true;
    const mount = document.createElement("div");
    mount.className = "availability-calendar-mount";
    const hidden = document.createElement("div");
    hidden.className = "availability-calendar-fields";
    hidden.hidden = true;
    builder.append(mount, hidden);
    const calendar = new AvailabilityCalendar(mount, {
      blocks,
      label: labelFor(builder),
      onChange: (_nextBlocks, fields) => syncLegacyInputs(hidden, fields)
    });
    syncLegacyInputs(hidden, blocksToLegacyFields(blocks));
    calendar.render();
    builder.dataset.calendarEnhanced = "true";
    builder.dddCalendar = calendar;
  } catch (error) {
    console.error("[DDD Calendar] Unable to enhance availability builder", error);
  }
}

function init() {
  try {
    document.querySelectorAll(".availability-builder").forEach(enhance);
  } catch (error) {
    console.error("[DDD Calendar] Unable to initialize availability calendars", error);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
