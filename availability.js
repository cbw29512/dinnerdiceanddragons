(() => {
  "use strict";

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const ORDINALS = ["First", "Second", "Third", "Fourth", "Last"];

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function options(values) {
    return values.map((value) => `<option value="${value}">${value}</option>`).join("");
  }

  function updateRuleFields(entry) {
    try {
      const pattern = entry.querySelector('[name="availability_pattern[]"]')?.value;
      const interval = entry.querySelector('[name="availability_week_interval[]"]')?.value || "1";
      const weekly = entry.querySelector(".weekly-rule");
      const monthly = entry.querySelectorAll(".monthly-rule");
      const anchor = entry.querySelector(".anchor-rule");
      const anchorInput = entry.querySelector('[name="availability_anchor_date[]"]');
      if (weekly) weekly.hidden = pattern !== "weekly";
      monthly.forEach((field) => { field.hidden = pattern !== "monthly"; });
      const needsAnchor = pattern === "weekly" && interval !== "1";
      if (anchor) anchor.hidden = !needsAnchor;
      if (anchorInput) anchorInput.required = needsAnchor;
      updateSummary(entry);
    } catch (error) {
      logError("Unable to update recurrence fields", error);
    }
  }

  function updateSummary(entry) {
    try {
      const day = entry.querySelector('[name="availability_day[]"]')?.value || "day";
      const start = entry.querySelector('[name="availability_start[]"]')?.value || "";
      const end = entry.querySelector('[name="availability_end[]"]')?.value || "";
      const pattern = entry.querySelector('[name="availability_pattern[]"]')?.value;
      let rule = "";
      if (pattern === "monthly") {
        const ordinal = entry.querySelector('[name="availability_monthly_ordinal[]"]')?.value || "Last";
        const months = entry.querySelector('[name="availability_month_interval[]"]')?.value || "1";
        rule = `${ordinal} ${day}${months === "1" ? " of every month" : ` every ${months} months`}`;
      } else {
        const weeks = entry.querySelector('[name="availability_week_interval[]"]')?.value || "1";
        rule = weeks === "1" ? `Every ${day}` : weeks === "2" ? `Every other ${day}` : `Every ${weeks} weeks on ${day}`;
      }
      const summary = entry.querySelector(".recurrence-summary");
      if (summary) summary.textContent = `${rule} · ${start}–${end}`;
    } catch (error) {
      logError("Unable to summarize recurrence", error);
    }
  }

  function buildEntry(index) {
    try {
      const entry = document.createElement("fieldset");
      entry.className = "availability-entry";
      entry.innerHTML = `
        <legend>Recurring window ${index + 1}</legend>
        <label>Day<select name="availability_day[]" required>${options(DAYS)}</select></label>
        <label>Start time<input name="availability_start[]" type="time" value="18:00" required></label>
        <label>End time<input name="availability_end[]" type="time" value="22:00" required></label>
        <label>Pattern<select name="availability_pattern[]" required><option value="weekly">Weekly / every N weeks</option><option value="monthly">Monthly weekday pattern</option></select></label>
        <label class="weekly-rule">Repeat every<select name="availability_week_interval[]"><option value="1">1 week</option><option value="2">2 weeks</option><option value="3">3 weeks</option><option value="4">4 weeks</option></select></label>
        <label class="anchor-rule" hidden>Anchor date<input name="availability_anchor_date[]" type="date"><span class="microcopy">Choose one real occurrence so alternating/multi-week schedules stay aligned.</span></label>
        <label class="monthly-rule" hidden>Which occurrence?<select name="availability_monthly_ordinal[]">${options(ORDINALS)}</select></label>
        <label class="monthly-rule" hidden>Repeat every<select name="availability_month_interval[]"><option value="1">1 month</option><option value="2">2 months</option><option value="3">3 months</option></select></label>
        <p class="recurrence-summary microcopy" aria-live="polite"></p>
        <button class="button secondary remove-availability" type="button">Remove This Window</button>`;
      return entry;
    } catch (error) {
      logError("Unable to build availability window", error);
      return null;
    }
  }

  function bindEntry(entry) {
    try {
      entry.addEventListener("change", () => updateRuleFields(entry));
      updateRuleFields(entry);
    } catch (error) {
      logError("Unable to bind recurrence entry", error);
    }
  }

  function renumber(list) {
    try {
      [...list.querySelectorAll(".availability-entry")].forEach((entry, index) => {
        const legend = entry.querySelector("legend");
        if (legend) legend.textContent = `Recurring window ${index + 1}`;
      });
    } catch (error) {
      logError("Unable to renumber availability windows", error);
    }
  }

  function bindBuilder(builder) {
    try {
      const list = builder.querySelector(".availability-list");
      const addButton = builder.querySelector(".add-availability");
      if (!list || !addButton) return;
      const addEntry = () => {
        const entry = buildEntry(list.children.length);
        if (!entry) return;
        list.appendChild(entry);
        bindEntry(entry);
      };
      addButton.addEventListener("click", addEntry);
      list.addEventListener("click", (event) => {
        const button = event.target.closest(".remove-availability");
        if (!button) return;
        if (list.querySelectorAll(".availability-entry").length <= 1) return;
        button.closest(".availability-entry")?.remove();
        renumber(list);
      });
      addEntry();
    } catch (error) {
      logError("Unable to initialize availability builder", error);
    }
  }

  try {
    document.querySelectorAll(".availability-builder").forEach(bindBuilder);
  } catch (error) {
    logError("Unable to initialize structured availability", error);
  }
})();
