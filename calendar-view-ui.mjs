import { DAYS, minutesToTime } from "./calendar-state.mjs";

export const START_MINUTES = 9 * 60;
export const END_MINUTES = 23 * 60 + 30;
export const STEP = 30;

function el(tag, attrs = {}, text = "") {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

function clockLabel(minutes) {
  const hour = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" })
    .format(new Date(2020, 0, 1, hour, minute));
}

function recurrenceText(block) {
  const recurrence = block.recurrence;
  if (recurrence.type === "monthly") {
    return `${recurrence.ordinal} ${block.day}, every ${recurrence.interval} month${recurrence.interval === 1 ? "" : "s"}`;
  }
  if (recurrence.interval === 1) return "Weekly";
  if (recurrence.interval === 2) return "Every other week";
  return `Every ${recurrence.interval} weeks`;
}

export function renderCalendar(calendar) {
  try {
    calendar.root.replaceChildren();
    const heading = el("div", { class: "calendar-heading" });
    heading.append(
      el("div", {}, calendar.label || "When are you available?"),
      el("small", {}, `Drag across time to add availability. Times use ${Intl.DateTimeFormat().resolvedOptions().timeZone || "your local timezone"}.`)
    );
    calendar.root.append(heading);
    const tabs = el("div", { class: "day-tabs", role: "tablist", "aria-label": "Choose day" });
    DAYS.forEach((day) => {
      const button = el("button", { type: "button", role: "tab", "aria-selected": String(day === calendar.mobileDay) }, day.slice(0, 3));
      button.addEventListener("click", () => { calendar.mobileDay = day; calendar.render(); });
      tabs.append(button);
    });
    calendar.root.append(tabs);
    const grid = el("div", { class: "calendar-grid" });
    grid.append(el("div", { class: "corner" }));
    DAYS.forEach((day) => grid.append(el("div", { class: `day-head ${day === calendar.mobileDay ? "mobile-active" : ""}` }, day.slice(0, 3))));
    for (let minutes = START_MINUTES; minutes < END_MINUTES; minutes += STEP) {
      grid.append(el("div", { class: "time-label" }, minutes % 60 === 0 ? clockLabel(minutes) : ""));
      for (const day of DAYS) {
        const existing = calendar.blockAt(day, minutes);
        const slot = el("button", {
          type: "button",
          class: `time-slot ${day === calendar.mobileDay ? "mobile-active" : ""}${existing ? " is-selected" : ""}`,
          "data-day": day,
          "data-minutes": String(minutes),
          "aria-label": existing ? `${day} ${clockLabel(minutes)} is available. Edit the saved block below.` : `Add ${day} ${clockLabel(minutes)} to ${clockLabel(minutes + STEP)}`
        });
        slot.addEventListener("pointerdown", (event) => { event.preventDefault(); calendar.beginDrag(day, minutes); });
        slot.addEventListener("pointerenter", () => calendar.extendDrag(day, minutes));
        slot.addEventListener("pointerup", () => calendar.finishDrag());
        slot.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            calendar.addBlock(day, minutesToTime(minutes), minutesToTime(minutes + STEP));
          }
        });
        grid.append(slot);
      }
    }
    calendar.root.append(grid);
    const list = el("div", { class: "selected-list", "aria-live": "polite" });
    calendar.state.blocks.forEach((block) => {
      const button = el("button", { type: "button", class: "availability-chip" }, `${block.day} · ${block.start}–${block.end} · ${recurrenceText(block)}`);
      button.addEventListener("click", () => calendar.openEditor(block));
      list.append(button);
    });
    calendar.root.append(list);
  } catch (error) {
    console.error("[DDD Calendar] Unable to render availability calendar", error);
  }
}
