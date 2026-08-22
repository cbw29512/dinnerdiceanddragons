const PRESETS = Object.freeze([
  { id: "weeknights", label: "Weeknights 6–10 PM", blocks: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({ day, start: "18:00", end: "22:00" })) },
  { id: "sat-afternoon", label: "Saturday 1–6 PM", blocks: [{ day: "Saturday", start: "13:00", end: "18:00" }] },
  { id: "sat-evening", label: "Saturday 6–10 PM", blocks: [{ day: "Saturday", start: "18:00", end: "22:00" }] },
  { id: "sun-afternoon", label: "Sunday 1–6 PM", blocks: [{ day: "Sunday", start: "13:00", end: "18:00" }] }
]);

function applyPreset(builder, preset) {
  try {
    const calendar = builder.dddCalendar;
    if (!calendar) throw new Error("Availability calendar is not ready.");
    for (const block of preset.blocks) calendar.addBlock(block.day, block.start, block.end);
  } catch (error) {
    console.error("[DDD Calendar] Unable to apply quick availability", error);
  }
}

function enhance(builder) {
  try {
    if (builder.dataset.presetsEnhanced === "true") return;
    const wrap = document.createElement("div");
    wrap.className = "availability-presets";
    const label = document.createElement("p");
    label.className = "microcopy";
    label.textContent = "Quick pick, or choose your own times below:";
    const buttons = document.createElement("div");
    buttons.className = "availability-preset-buttons";
    for (const preset of PRESETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "availability-preset-button";
      button.textContent = preset.label;
      button.addEventListener("click", () => applyPreset(builder, preset));
      buttons.append(button);
    }
    wrap.append(label, buttons);
    builder.prepend(wrap);
    builder.dataset.presetsEnhanced = "true";
  } catch (error) {
    console.error("[DDD Calendar] Unable to add availability quick picks", error);
  }
}

export function enhanceAvailabilityPresets(root = document) {
  try {
    root.querySelectorAll(".availability-builder").forEach(enhance);
  } catch (error) {
    console.error("[DDD Calendar] Unable to initialize availability quick picks", error);
  }
}