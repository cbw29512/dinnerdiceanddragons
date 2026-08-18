(() => {
  "use strict";

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const ORDINALS = ["First", "Second", "Third", "Fourth", "Last"];

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function element(tag, attributes = {}, text = "") {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (value === true) node.setAttribute(name, "");
      else if (value !== false && value !== null && value !== undefined) node.setAttribute(name, String(value));
    }
    if (text) node.textContent = text;
    return node;
  }

  function option(value, label = value, selected = false) {
    const node = element("option", { value }, label);
    node.selected = selected;
    return node;
  }

  function selectControl(name, values) {
    const select = element("select", { name });
    for (const value of values) select.append(option(value));
    return select;
  }

  function labeledControl(labelText, control, className = "") {
    const label = element("label", className ? { class: className } : {});
    label.append(document.createTextNode(labelText), control);
    return label;
  }

  function updateRuleFields(entry) {
    try {
      const pattern = entry.querySelector('[name="availability_pattern[]"]')?.value;
      const weekInterval = entry.querySelector('[name="availability_week_interval[]"]')?.value || "1";
      const monthInterval = entry.querySelector('[name="availability_month_interval[]"]')?.value || "1";
      const weekly = entry.querySelector(".weekly-rule");
      const monthly = entry.querySelectorAll(".monthly-rule");
      const anchor = entry.querySelector(".anchor-rule");
      const anchorInput = entry.querySelector('[name="availability_anchor_date[]"]');
      if (weekly) weekly.hidden = pattern !== "weekly";
      monthly.forEach((field) => { field.hidden = pattern !== "monthly"; });
      const needsAnchor = (pattern === "weekly" && weekInterval !== "1") || (pattern === "monthly" && monthInterval !== "1");
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
      const entry = element("fieldset", { class: "availability-entry" });

      const day = selectControl("availability_day[]", DAYS);
      day.required = true;

      const start = element("input", {
        name: "availability_start[]",
        type: "time",
        value: "18:00",
        required: true
      });
      const end = element("input", {
        name: "availability_end[]",
        type: "time",
        value: "22:00",
        required: true
      });

      const pattern = element("select", { name: "availability_pattern[]", required: true });
      pattern.append(
        option("weekly", "Weekly / every N weeks", true),
        option("monthly", "Monthly weekday pattern")
      );

      const weekInterval = element("select", { name: "availability_week_interval[]" });
      weekInterval.append(
        option("1", "1 week", true),
        option("2", "2 weeks"),
        option("3", "3 weeks"),
        option("4", "4 weeks")
      );

      const anchor = labeledControl(
        "Anchor occurrence",
        element("input", { name: "availability_anchor_date[]", type: "date" }),
        "anchor-rule"
      );
      anchor.hidden = true;
      anchor.append(
        element(
          "span",
          { class: "microcopy" },
          "Choose one date in the intended cycle so every-other-week or multi-month patterns stay aligned."
        )
      );

      const ordinal = selectControl("availability_monthly_ordinal[]", ORDINALS);
      const ordinalLabel = labeledControl("Which occurrence?", ordinal, "monthly-rule");
      ordinalLabel.hidden = true;

      const monthInterval = element("select", { name: "availability_month_interval[]" });
      monthInterval.append(
        option("1", "1 month", true),
        option("2", "2 months"),
        option("3", "3 months")
      );
      const monthLabel = labeledControl("Repeat every", monthInterval, "monthly-rule");
      monthLabel.hidden = true;

      const summary = element("p", {
        class: "recurrence-summary microcopy",
        "aria-live": "polite"
      });
      const remove = element(
        "button",
        { class: "button secondary remove-availability", type: "button" },
        "Remove This Window"
      );

      entry.append(
        element("legend", {}, `Recurring window ${index + 1}`),
        labeledControl("Day", day),
        labeledControl("Start time", start),
        labeledControl("End time", end),
        labeledControl("Pattern", pattern),
        labeledControl("Repeat every", weekInterval, "weekly-rule"),
        anchor,
        ordinalLabel,
        monthLabel,
        summary,
        remove
      );
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
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest(".remove-availability");
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

  function loadPreviewAssets() {
    try {
      if (!document.querySelector('link[href="recurrence-preview.css"]')) {
        const style = element("link", { rel: "stylesheet", href: "recurrence-preview.css" });
        document.head.appendChild(style);
      }
      if (document.querySelector('script[src="recurrence-engine.js"]')) return;
      const engine = element("script", { src: "recurrence-engine.js" });
      engine.addEventListener("load", () => {
        if (document.querySelector('script[src="recurrence-preview.js"]')) return;
        document.body.appendChild(element("script", { src: "recurrence-preview.js" }));
      });
      document.body.appendChild(engine);
    } catch (error) {
      logError("Unable to load recurrence preview assets", error);
    }
  }

  try {
    document.querySelectorAll(".availability-builder").forEach(bindBuilder);
    loadPreviewAssets();
  } catch (error) {
    logError("Unable to initialize structured availability", error);
  }
})();
