(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function asArray(value) {
    try {
      if (Array.isArray(value)) return value.filter(Boolean);
      return value ? [value] : [];
    } catch (error) {
      logError("Unable to normalize saved GM field", error);
      return [];
    }
  }

  function renderDemandSnapshot(container) {
    try {
      if (!container) return;
      const summaries = window.DDDTableMatch.summarizeDemand();
      container.replaceChildren();
      summaries.slice(0, 6).forEach((summary) => {
        const item = document.createElement("article");
        item.className = "demand-snapshot-card";
        const count = document.createElement("strong");
        count.textContent = String(summary.count);
        const label = document.createElement("span");
        label.textContent = `${summary.system} · ${summary.day}`;
        const note = document.createElement("small");
        note.textContent = summary.localCount ? "Includes your saved Player signal" : "Aggregated Player demand";
        item.append(count, label, note);
        container.appendChild(item);
      });
    } catch (error) {
      logError("Unable to render Player demand snapshot", error);
    }
  }

  function readSavedGm() {
    try {
      const raw = localStorage.getItem("ddd-preview-game-master");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      logError("Unable to read saved GM signal", error);
      return null;
    }
  }

  function applySavedGm(form, statusNode, profile) {
    try {
      if (!form || !profile) return false;
      const systems = asArray(profile.gm_system);
      const days = asArray(profile.availability_day);
      const starts = asArray(profile.availability_start);
      const normalizedSystem = window.DDDTableMatch.normalizeSystem(systems[0]);
      if (normalizedSystem && [...form.elements.system.options].some((option) => option.value === normalizedSystem)) form.elements.system.value = normalizedSystem;
      if (days[0]) form.elements.day.value = days[0];
      if (starts[0]) form.elements.start.value = starts[0];
      if (profile.postal_code) form.elements.gm_zip.value = profile.postal_code;
      if (profile.radius) form.elements.gm_radius.value = String(profile.radius);
      if (statusNode) statusNode.textContent = "Loaded your saved GM system, availability, ZIP code, and travel range. You can change anything below.";
      return Boolean(normalizedSystem && days[0] && starts[0] && profile.postal_code);
    } catch (error) {
      logError("Unable to apply saved GM signal", error);
      return false;
    }
  }

  function prefill(form, statusNode) {
    try {
      if (!form) return false;
      const query = new URLSearchParams(location.search);
      const hasQuery = Boolean(query.get("system") || query.get("day") || query.get("start"));
      if (query.get("system")) form.elements.system.value = window.DDDTableMatch.normalizeSystem(query.get("system"));
      if (query.get("day")) form.elements.day.value = query.get("day");
      if (query.get("start")) form.elements.start.value = query.get("start");

      let loadedSavedGm = false;
      if (!hasQuery) loadedSavedGm = applySavedGm(form, statusNode, readSavedGm());
      if (!form.elements.gm_zip.value) form.elements.gm_zip.value = localStorage.getItem("ddd-home-zip") || "29501";
      if (!form.elements.gm_radius.value) form.elements.gm_radius.value = localStorage.getItem("ddd-travel-radius") || "25";
      return loadedSavedGm;
    } catch (error) {
      logError("Unable to prefill Table Match", error);
      return false;
    }
  }

  window.DDDTableMatchProfile = { renderDemandSnapshot, prefill };
})();
