(() => {
  "use strict";

  const SYSTEM_OPTIONS = [
    "D&D 5e (2014)",
    "D&D 5e (2024)",
    "Pathfinder 2e",
    "Call of Cthulhu",
    "Cyberpunk RED",
    "Shadowrun",
    "Other"
  ];

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

  function selectControl(name, values, selected = "") {
    const select = element("select", { name, required: true });
    for (const value of values) {
      const option = element("option", { value }, value);
      if (value === selected) option.selected = true;
      select.append(option);
    }
    return select;
  }

  function labeledControl(labelText, control) {
    const label = element("label");
    label.append(document.createTextNode(labelText), control);
    return label;
  }

  function removeButton() {
    return element(
      "button",
      { class: "button secondary remove-experience", type: "button" },
      "Remove This System"
    );
  }

  function playerEntry(index) {
    const fieldset = element("fieldset", { class: "experience-entry" });
    fieldset.append(
      element("legend", {}, `System ${index + 1}`),
      labeledControl("System / edition", selectControl("player_system[]", SYSTEM_OPTIONS)),
      labeledControl(
        "Years playing",
        element("input", {
          name: "player_years[]",
          type: "number",
          min: "0",
          max: "80",
          step: "0.5",
          value: "0",
          required: true
        })
      ),
      labeledControl(
        "Your comfort level",
        selectControl(
          "player_comfort[]",
          ["New", "Learning", "Comfortable", "Very Experienced"],
          "Comfortable"
        )
      ),
      labeledControl(
        "Notes about your experience",
        element("textarea", {
          name: "player_system_notes[]",
          rows: "2",
          placeholder: "Optional: classes, editions, organized play, returning after a break..."
        })
      ),
      removeButton()
    );
    return fieldset;
  }

  function gmEntry(index) {
    const fieldset = element("fieldset", { class: "experience-entry" });
    fieldset.append(
      element("legend", {}, `System ${index + 1}`),
      labeledControl("System / edition", selectControl("gm_system[]", SYSTEM_OPTIONS)),
      labeledControl(
        "Years playing",
        element("input", {
          name: "gm_play_years[]",
          type: "number",
          min: "0",
          max: "80",
          step: "0.5",
          value: "0",
          required: true
        })
      ),
      labeledControl(
        "Years GMing",
        element("input", {
          name: "gm_run_years[]",
          type: "number",
          min: "0",
          max: "80",
          step: "0.5",
          value: "0",
          required: true
        })
      ),
      labeledControl(
        "GM comfort level",
        selectControl(
          "gm_comfort[]",
          ["Learning", "Comfortable", "Very Comfortable", "Expert"],
          "Comfortable"
        )
      ),
      labeledControl(
        "Formats you are comfortable running",
        selectControl(
          "gm_format[]",
          ["Learn-to-play", "One-shot", "Short campaign", "Long campaign", "Organized play", "Any format"],
          "One-shot"
        )
      ),
      labeledControl(
        "Notes about your experience",
        element("textarea", {
          name: "gm_system_notes[]",
          rows: "2",
          placeholder: "Optional: modules, homebrew, conventions, age groups, special expertise..."
        })
      ),
      removeButton()
    );
    return fieldset;
  }

  function renumber(list) {
    try {
      [...list.querySelectorAll(".experience-entry")].forEach((entry, index) => {
        const legend = entry.querySelector("legend");
        if (legend) legend.textContent = `System ${index + 1}`;
      });
    } catch (error) {
      logError("Unable to renumber experience entries", error);
    }
  }

  function bindBuilder(builder) {
    try {
      const role = builder.dataset.role;
      const list = builder.querySelector(".experience-list");
      const addButton = builder.querySelector(".add-experience");
      if (!list || !addButton || !role) return;

      const addEntry = () => {
        try {
          const entry = role === "gm" ? gmEntry(list.children.length) : playerEntry(list.children.length);
          list.appendChild(entry);
          const firstField = entry.querySelector("select, input, textarea");
          if (list.children.length > 1 && firstField) firstField.focus();
        } catch (error) {
          logError("Unable to add system experience entry", error);
        }
      };

      addButton.addEventListener("click", addEntry);
      list.addEventListener("click", (event) => {
        try {
          const target = event.target;
          if (!(target instanceof Element)) return;
          const button = target.closest(".remove-experience");
          if (!button) return;
          const entries = list.querySelectorAll(".experience-entry");
          if (entries.length <= 1) return;
          button.closest(".experience-entry")?.remove();
          renumber(list);
        } catch (error) {
          logError("Unable to remove system experience entry", error);
        }
      });

      addEntry();
    } catch (error) {
      logError("Unable to initialize experience builder", error);
    }
  }

  try {
    document.querySelectorAll(".experience-builder").forEach(bindBuilder);
  } catch (error) {
    logError("Unable to initialize system experience profiles", error);
  }
})();
