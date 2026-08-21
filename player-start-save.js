(() => {
  "use strict";

  function log(message, error) {
    console.error(`[DDD Player Save] ${message}`, error);
  }

  function renderReview(root, values, editMode) {
    try {
      const windows = (values.availability_day || [])
        .map((day, index) => `${day} ${values.availability_start?.[index] || ""}–${values.availability_end?.[index] || ""}`)
        .join(" · ");
      const game = editMode ? "Game preferences unchanged" : (values.player_system?.[0] || "D&D 5e (2024)");
      const rows = [
        ["Game", game],
        ["Available", windows || "No times selected"],
        ["Travel", `${values.radius || 25} miles from ${values.postal_code || "your ZIP"}`]
      ];
      root.replaceChildren();
      for (const [label, value] of rows) {
        const row = document.createElement("div");
        row.className = "review-row";
        const name = document.createElement("span");
        name.textContent = label;
        const strong = document.createElement("strong");
        strong.textContent = value;
        row.append(name, strong);
        root.append(row);
      }
    } catch (error) {
      log("Unable to render review", error);
      throw error;
    }
  }

  function showReady(form, progress, ready) {
    try {
      form.hidden = true;
      progress.hidden = true;
      ready.hidden = false;
    } catch (error) {
      log("Unable to show ready state", error);
      throw error;
    }
  }

  async function persist({ editMode, existingProfile, values }) {
    try {
      if (editMode && existingProfile) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const payload = window.DDDPlayerStartProfile.updatePayload(existingProfile, values, timezone);
        await window.DDDProductionAPI.putPlayerOnboarding(payload);
        await window.DDDProductionMatching.syncAndFind(
          "Player",
          { payload, deferred: { table_style_preference: null } },
          values
        );
        return { matchingError: null };
      }
      return window.DDDProductionOnboarding.save("Player", values);
    } catch (error) {
      log("Unable to persist Player availability", error);
      throw error;
    }
  }

  window.DDDPlayerStartSave = Object.freeze({ persist, renderReview, showReady });
})();
