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

  function makeOptions(values) {
    return values.map((value) => `<option value="${value}">${value}</option>`).join("");
  }

  function playerEntry(index) {
    const article = document.createElement("fieldset");
    article.className = "experience-entry";
    article.innerHTML = `
      <legend>System ${index + 1}</legend>
      <label>System / edition
        <select name="player_system[]" required>${makeOptions(SYSTEM_OPTIONS)}</select>
      </label>
      <label>Years playing
        <input name="player_years[]" type="number" min="0" max="80" step="0.5" value="0" required>
      </label>
      <label>Your comfort level
        <select name="player_comfort[]" required>
          <option>New</option>
          <option>Learning</option>
          <option selected>Comfortable</option>
          <option>Very Experienced</option>
        </select>
      </label>
      <label>Notes about your experience
        <textarea name="player_system_notes[]" rows="2" placeholder="Optional: classes, editions, organized play, returning after a break..."></textarea>
      </label>
      <button class="button secondary remove-experience" type="button">Remove This System</button>`;
    return article;
  }

  function gmEntry(index) {
    const article = document.createElement("fieldset");
    article.className = "experience-entry";
    article.innerHTML = `
      <legend>System ${index + 1}</legend>
      <label>System / edition
        <select name="gm_system[]" required>${makeOptions(SYSTEM_OPTIONS)}</select>
      </label>
      <label>Years playing
        <input name="gm_play_years[]" type="number" min="0" max="80" step="0.5" value="0" required>
      </label>
      <label>Years GMing
        <input name="gm_run_years[]" type="number" min="0" max="80" step="0.5" value="0" required>
      </label>
      <label>GM comfort level
        <select name="gm_comfort[]" required>
          <option>Learning</option>
          <option selected>Comfortable</option>
          <option>Very Comfortable</option>
          <option>Expert</option>
        </select>
      </label>
      <label>Formats you are comfortable running
        <select name="gm_format[]" required>
          <option>Learn-to-play</option>
          <option selected>One-shot</option>
          <option>Short campaign</option>
          <option>Long campaign</option>
          <option>Organized play</option>
          <option>Any format</option>
        </select>
      </label>
      <label>Notes about your experience
        <textarea name="gm_system_notes[]" rows="2" placeholder="Optional: modules, homebrew, conventions, age groups, special expertise..."></textarea>
      </label>
      <button class="button secondary remove-experience" type="button">Remove This System</button>`;
    return article;
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
          const button = event.target.closest(".remove-experience");
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
