(() => {
  "use strict";

  function log(message, error) { console.error(`[DDD DM Save] ${message}`, error); }

  function configureEditUi(form, conductCheck) {
    try {
      const tableSize = form.elements.player_count?.closest("label");
      if (tableSize) tableSize.hidden = true;
      const conduct = conductCheck?.closest("label");
      if (conduct) conduct.hidden = true;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "Save DM Availability";
    } catch (error) { log("Unable to configure edit UI", error); throw error; }
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
    } catch (error) { log("Unable to render DM review", error); throw error; }
  }

  function showReady(form, progress, ready) {
    try {
      form.hidden = true;
      progress.hidden = true;
      ready.hidden = false;
    } catch (error) { log("Unable to show ready state", error); throw error; }
  }

  function showReadyState(form, progress, ready, signals = []) {
    showReady(form, progress, ready);
    const paused = Boolean(signals.length) && signals.every((item) => item.status === "paused");
    ready.querySelector("h2").textContent = paused
      ? "Your DM availability is saved. Matching is paused."
      : "DDD is looking for a table that fits.";
    ready.querySelector("h2 + p").textContent = paused
      ? "Resume matching from My DDD when you want DDD to look for a table again."
      : "When compatible Players, a public Venue, and your schedule line up, the match will appear in My DDD and My Alerts.";
  }

  function availabilityReady(form, announce) {
    if (form.querySelectorAll('[name="availability_day[]"]').length) return true;
    announce("availability-status", "Choose at least one time when you can DM.");
    return false;
  }

  function tableReady(form, announce, editMode) {
    const zip = form.elements.postal_code;
    if (!/^\d{5}$/.test(zip.value.trim())) {
      zip.setCustomValidity("Enter a five-digit ZIP code.");
      zip.setAttribute("aria-invalid", "true");
      zip.focus();
      announce("table-status", "Enter a five-digit ZIP code.");
      return false;
    }
    zip.setCustomValidity("");
    zip.removeAttribute("aria-invalid");
    if (editMode) { announce("table-status", "Travel area looks good.", true); return true; }

    const playerCount = form.elements.player_count;
    const count = Number(playerCount.value);
    if (!Number.isInteger(count) || count < 1) {
      playerCount.setCustomValidity("Enter at least 1 Player.");
      playerCount.setAttribute("aria-invalid", "true");
      playerCount.focus();
      announce("table-status", "Enter a whole number of Players, starting at 1.");
      return false;
    }
    playerCount.setCustomValidity("");
    playerCount.removeAttribute("aria-invalid");
    announce("table-status", "Player count and travel area look good.", true);
    return true;
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
    } catch (error) { log("Unable to persist DM setup", error); throw error; }
  }

  window.DDDDMStartSave = Object.freeze({
    availabilityReady, configureEditUi, persist, renderReview, showReady, showReadyState, tableReady
  });
})();