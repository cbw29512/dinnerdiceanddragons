(() => {
  "use strict";

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function makeDayOptions() {
    return DAYS.map((day) => `<option value="${day}">${day}</option>`).join("");
  }

  function buildEntry(index) {
    try {
      const entry = document.createElement("fieldset");
      entry.className = "availability-entry";
      entry.innerHTML = `
        <legend>Time window ${index + 1}</legend>
        <label>Day
          <select name="availability_day[]" required>${makeDayOptions()}</select>
        </label>
        <label>Start time
          <input name="availability_start[]" type="time" value="18:00" required>
        </label>
        <label>End time
          <input name="availability_end[]" type="time" value="22:00" required>
        </label>
        <label>How often?
          <select name="availability_recurrence[]" required>
            <option selected>Weekly</option>
            <option>Every other week</option>
            <option>Monthly</option>
            <option>Flexible</option>
          </select>
        </label>
        <button class="button secondary remove-availability" type="button">Remove This Window</button>`;
      return entry;
    } catch (error) {
      logError("Unable to build availability window", error);
      return null;
    }
  }

  function renumber(list) {
    try {
      [...list.querySelectorAll(".availability-entry")].forEach((entry, index) => {
        const legend = entry.querySelector("legend");
        if (legend) legend.textContent = `Time window ${index + 1}`;
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
        try {
          const entry = buildEntry(list.children.length);
          if (!entry) return;
          list.appendChild(entry);
          if (list.children.length > 1) entry.querySelector("select")?.focus();
        } catch (error) {
          logError("Unable to add availability window", error);
        }
      };

      addButton.addEventListener("click", addEntry);
      list.addEventListener("click", (event) => {
        try {
          const button = event.target.closest(".remove-availability");
          if (!button) return;
          const entries = list.querySelectorAll(".availability-entry");
          if (entries.length <= 1) return;
          button.closest(".availability-entry")?.remove();
          renumber(list);
        } catch (error) {
          logError("Unable to remove availability window", error);
        }
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
