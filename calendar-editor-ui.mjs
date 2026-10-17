import { DAYS } from "./calendar-state.mjs";

function el(tag, attrs = {}, text = "") {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}

function labeled(form, text, control) {
  const label = el("label");
  label.append(document.createTextNode(text), control);
  form.append(label);
  return label;
}

export function openAvailabilityEditor(calendar, block) {
  try {
    calendar.editor?.remove();
    const dialog = el("dialog", { class: "availability-editor", "aria-labelledby": "availability-editor-title" });
    const form = el("form", { method: "dialog" });
    form.append(el("h2", { id: "availability-editor-title" }, "Edit availability"));
    const day = el("select", { name: "day" });
    DAYS.forEach((name) => day.append(el("option", { value: name }, name)));
    day.value = block.day;
    const start = el("input", { type: "time", name: "start", step: "1800", required: "", value: block.start });
    const end = el("input", { type: "time", name: "end", step: "1800", required: "", value: block.end });
    const type = el("select", { name: "type" });
    type.append(el("option", { value: "weekly" }, "Weekly pattern"), el("option", { value: "monthly" }, "Monthly weekday pattern"));
    type.value = block.recurrence.type;
    const interval = el("select", { name: "interval" });
    const anchor = el("input", { type: "date", name: "anchor" });
    anchor.value = block.recurrence.anchorDate || "";
    const ordinal = el("select", { name: "ordinal" });
    ["First", "Second", "Third", "Fourth", "Last"].forEach((value) => ordinal.append(el("option", { value }, value)));
    ordinal.value = block.recurrence.ordinal || "Last";
    labeled(form, "Day", day);
    labeled(form, "Start", start);
    labeled(form, "End", end);
    labeled(form, "Repeats", type);
    labeled(form, "Repeat every", interval);
    const anchorLabel = labeled(form, "Anchor date", anchor);
    const ordinalLabel = labeled(form, "Monthly occurrence", ordinal);
    const refresh = () => {
      interval.replaceChildren();
      const max = type.value === "monthly" ? 3 : 4;
      for (let value = 1; value <= max; value += 1) {
        const unit = type.value === "monthly" ? "month" : "week";
        interval.append(el("option", { value: String(value) }, `${value} ${unit}${value === 1 ? "" : "s"}`));
      }
      interval.value = String(Math.min(block.recurrence.interval, max));
      ordinalLabel.hidden = type.value !== "monthly";
      anchorLabel.hidden = Number(interval.value) === 1;
    };
    type.addEventListener("change", refresh);
    interval.addEventListener("change", () => { anchorLabel.hidden = Number(interval.value) === 1; });
    refresh();
    const actions = el("div", { class: "editor-actions" });
    const save = el("button", { type: "submit", class: "button primary" }, "Save");
    const remove = el("button", { type: "button", class: "button secondary" }, "Delete");
    const cancel = el("button", { type: "button", class: "button secondary" }, "Cancel");
    actions.append(save, remove, cancel);
    form.append(actions);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      calendar.updateBlock(block.id, {
        day: day.value, start: start.value, end: end.value,
        recurrence: { type: type.value, interval: Number(interval.value), anchorDate: Number(interval.value) > 1 ? anchor.value || null : null, ordinal: ordinal.value }
      });
      dialog.close();
    });
    remove.addEventListener("click", () => { calendar.removeBlock(block.id); dialog.close(); });
    cancel.addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { dialog.remove(); calendar.editor = null; });
    dialog.append(form);
    document.body.append(dialog);
    calendar.editor = dialog;
    dialog.showModal();
  } catch (error) {
    console.error("[DDD Calendar] Unable to open availability editor", error);
  }
}
