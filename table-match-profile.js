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

  function setDemandCopy(mode) {
    try {
      const label = document.querySelector("#demand-mode-label");
      const heading = document.querySelector("#demand-heading");
      const description = document.querySelector("#demand-description");
      if (mode === "shared") {
        if (label) label.textContent = "SHARED PILOT PLAYER DEMAND";
        if (heading) heading.textContent = "What Players are asking for";
        if (description) description.textContent = "Anonymous aggregate from the configured shared pilot. Individual Player identities, ZIP codes, travel radii, and contact details are not exposed here.";
      } else {
        if (label) label.textContent = "PROTOTYPE PLAYER DEMAND";
        if (heading) heading.textContent = "What Players could be asking for";
        if (description) description.textContent = "This validation prototype combines seeded demo Player signals with any Player signal saved in this browser. It is not live community demand. Individual Player names and private contact details are not exposed here.";
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
        empty.textContent = mode === "shared" ? "No active shared Player demand has been recorded yet." : "No prototype Player demand is available yet.";
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
          ? "Anonymous shared-pilot demand"
          : (summary.localCount ? "Includes your saved Player signal" : "Seeded prototype demand");
        item.append(count, label, note);
        container.appendChild(item);
      });
    } catch (error) {
      logError("Unable to render Player demand summaries", error);
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
        logError("Shared demand summary unavailable; using prototype fallback", new Error(result.error || "Unknown pilot API response"));
      }
      setDemandCopy("prototype");
      renderSummaries(container, window.DDDTableMatch.summarizeDemand(), "prototype");
    } catch (error) {
      logError("Unable to load Player demand snapshot", error);
      setDemandCopy("prototype");
      renderSummaries(container, window.DDDTableMatch.summarizeDemand(), "prototype");
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
