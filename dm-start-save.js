(() => {
  "use strict";

  function log(message, error) {
    console.error(`[DDD DM Save] ${message}`, error);
  }

  function configureEditUi(form, conductCheck) {
    try {
      const tableSize = form.elements.player_count?.closest("label");
      if (tableSize) tableSize.hidden = true;
      const conduct = conductCheck?.closest("label");
      if (conduct) conduct.hidden = true;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "Save DM Availability";
    } catch (error) {
      log("Unable to configure edit UI", error);
      throw error;
    }
  }

  function renderReview(root, raw, editMode) {
    try {
      const rows = editMode
        ? [["DM settings", "Game, format, style, and Player count unchanged"], ["Available", (raw.availability_day || []).join(", ")], ["Travel", `${raw.radius} miles from ${raw.postal_code}`]]
        : [["Game", `${raw.gm_system?.[0]} · ${raw.gm_format?.[0]}`], ["Available", (raw.availability_day || []).join(", ")], ["Travel", `${raw.radius} miles from ${raw.postal_code}`], ["Player seats", `${raw.player_count} Players`]];
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
      log("Unable to render DM review", error);
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

  async function persist({ editMode, existingProfile, existingSupplies, values }) {
    try {
      if (editMode && existingProfile) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const payload = window.DDDDMStartProfile.updatePayload(existingProfile, values, timezone);
        await window.DDDProductionAPI.putGMOnboarding(payload);
        await window.DDDDMStartProfile.refreshSupplies(existingSupplies, payload.availability);
        return { matchingError: null };
      }
      return window.DDDProductionOnboarding.save("Game Master", values);
    } catch (error) {
      log("Unable to persist DM setup", error);
      throw error;
    }
  }

  window.DDDDMStartSave = Object.freeze({ configureEditUi, persist, renderReview, showReady });
})();
