(() => {
  "use strict";

  const PRESETS = Object.freeze([
    [10080, "1 week"], [4320, "3 days"], [1440, "1 day"],
    [180, "3 hours"], [60, "1 hour"], [30, "30 minutes"]
  ]);

  function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function option(minutes, label, selected) {
    const labelNode = el("label", "reminder-choice");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(minutes);
    input.checked = selected.has(minutes);
    labelNode.append(input, el("span", "", label));
    return labelNode;
  }

  async function render(matchId, root) {
    try {
      const saved = await window.DDDProductionAPI.getGameReminders(matchId);
      const selected = new Set((saved || []).filter((item) => item.enabled).map((item) => Number(item.minutes_before)));
      root.replaceChildren();
      const title = el("strong", "", "Remind me");
      const choices = el("div", "reminder-choices");
      PRESETS.forEach(([minutes, label]) => choices.append(option(minutes, label, selected)));
      const custom = el("label", "reminder-custom");
      custom.append(el("span", "", "Custom minutes before"));
      const customInput = document.createElement("input");
      customInput.type = "number";
      customInput.min = "15";
      customInput.max = "20160";
      customInput.step = "15";
      customInput.placeholder = "e.g. 120";
      const presetValues = new Set(PRESETS.map(([minutes]) => minutes));
      const customValue = [...selected].find((minutes) => !presetValues.has(minutes));
      if (customValue) customInput.value = String(customValue);
      custom.append(customInput);
      const save = el("button", "button secondary", "Save Reminders");
      save.type = "button";
      const status = el("p", "form-status");
      status.setAttribute("role", "status");
      save.addEventListener("click", async () => {
        try {
          save.disabled = true;
          const minutes = [...choices.querySelectorAll('input[type="checkbox"]:checked')].map((input) => Number(input.value));
          if (customInput.value) minutes.push(Number(customInput.value));
          const result = await window.DDDProductionAPI.putGameReminders(matchId, minutes);
          status.textContent = result.length ? "Reminders saved." : "Reminders turned off for this game.";
        } catch (error) {
          console.error("[DDD Reminders] Unable to save card reminders", error);
          status.textContent = error?.message || "Reminders could not be saved.";
        } finally { save.disabled = false; }
      });
      root.append(title, choices, custom, save, status);
    } catch (error) {
      console.error("[DDD Reminders] Unable to load card reminders", error);
      root.replaceChildren(el("p", "microcopy", "Reminder settings are temporarily unavailable."));
    }
  }

  window.DDDGameReminders = Object.freeze({ render });
})();
