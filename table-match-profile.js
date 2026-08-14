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
      logError("Unable to normalize saved DM field", error);
      return [];
    }
  }

  function setDemandCopy(mode) {
    try {
      const label = document.querySelector("#demand-mode-label");
      const heading = document.querySelector("#demand-heading");
      const description = document.querySelector("#demand-description");
      if (mode === "shared") {
        if (label) label.textContent = "LOCAL PLAYER INTEREST";
        if (heading) heading.textContent = "What Players are looking for";
        if (description) description.textContent = "Player interest is shown as anonymous totals. Names, contact details, ZIP codes, and individual travel ranges are not exposed here.";
      } else {
        if (label) label.textContent = "SAMPLE PLAYER INTEREST";
        if (heading) heading.textContent = "See what local demand could look like";
        if (description) description.textContent = "This preview uses sample Player interest plus any Player preferences saved on this device. Sample counts are not live community demand.";
      }
    } catch (error) {
      logError("Unable to update demand-mode copy", error);
    }
  }

  function renderSummaries(container, summaries, mode) {
    try {
      if (!container) return;
      container.replaceChildren();
      if (!summaries.length) {
        const empty = document.createElement("p");
        empty.className = "microcopy";
        empty.textContent = mode === "shared" ? "No active Player interest has been recorded yet." : "No sample Player interest is available yet.";
        container.appendChild(empty);
        return;
      }
      summaries.slice(0, 6).forEach((summary) => {
        const item = document.createElement("article");
        item.className = "demand-snapshot-card";
        const count = document.createElement("strong");
        count.textContent = String(summary.count);
        const label = document.createElement("span");
        label.textContent = `${summary.system} · ${summary.day}`;
        const note = document.createElement("small");
        note.textContent = mode === "shared"
          ? "Anonymous Player interest"
          : (summary.localCount ? "Includes your saved Player preferences" : "Sample demand");
        item.append(count, label, note);
        container.appendChild(item);
      });
    } catch (error) {
      logError("Unable to render Player interest summaries", error);
    }
  }

  async function renderDemandSnapshot(container) {
    try {
      if (!container) return;
      if (window.DDD_API?.isConfigured()) {
        const result = await window.DDD_API.get("demand.summary");
        if (result.ok && Array.isArray(result.demand)) {
          setDemandCopy("shared");
          renderSummaries(container, result.demand, "shared");
          return;
        }
        logError("Online demand summary unavailable; using sample fallback", new Error(result.error || "Unknown API response"));
      }
      setDemandCopy("sample");
      renderSummaries(container, window.DDDTableMatch.summarizeDemand(), "sample");
    } catch (error) {
      logError("Unable to load Player interest snapshot", error);
      setDemandCopy("sample");
      renderSummaries(container, window.DDDTableMatch.summarizeDemand(), "sample");
    }
  }

  function readSavedDm() {
    try {
      const raw = localStorage.getItem("ddd-preview-game-master");
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      logError("Unable to read saved DM preferences", error);
      return null;
    }
  }

  function applySavedDm(form, statusNode, profile) {
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
      if (statusNode) statusNode.textContent = "Loaded your saved DM game, availability, ZIP code, and travel range. Change anything you want below.";
      return Boolean(normalizedSystem && days[0] && starts[0] && profile.postal_code);
    } catch (error) {
      logError("Unable to apply saved DM preferences", error);
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

      let loadedSavedDm = false;
      if (!hasQuery) loadedSavedDm = applySavedDm(form, statusNode, readSavedDm());
      if (!form.elements.gm_zip.value) form.elements.gm_zip.value = localStorage.getItem("ddd-home-zip") || "29501";
      if (!form.elements.gm_radius.value) form.elements.gm_radius.value = localStorage.getItem("ddd-travel-radius") || "25";
      return loadedSavedDm;
    } catch (error) {
      logError("Unable to prefill Table Match", error);
      return false;
    }
  }

  window.DDDTableMatchProfile = { renderDemandSnapshot, prefill };
})();