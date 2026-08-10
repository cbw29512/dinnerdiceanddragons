(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function normalizeSystem(value) {
    try {
      if (String(value).startsWith("D&D 5e")) return "D&D 5e";
      return value;
    } catch (error) {
      logError("Unable to normalize system", error);
      return value;
    }
  }

  function localPlayerSignals() {
    try {
      const raw = localStorage.getItem("ddd-preview-player");
      if (!raw) return [];
      const profile = JSON.parse(raw);
      const systems = Array.isArray(profile.player_system) ? profile.player_system : [profile.player_system].filter(Boolean);
      const days = Array.isArray(profile.availability_day) ? profile.availability_day : [profile.availability_day].filter(Boolean);
      const starts = Array.isArray(profile.availability_start) ? profile.availability_start : [profile.availability_start].filter(Boolean);
      const ends = Array.isArray(profile.availability_end) ? profile.availability_end : [profile.availability_end].filter(Boolean);
      const signals = [];
      systems.forEach((system) => days.forEach((day, index) => signals.push({
        system: normalizeSystem(system), day, start: starts[index] || "18:00", end: ends[index] || "22:00",
        zip: profile.postal_code || "29501", radius: Number(profile.radius) || 25, local: true
      })));
      return signals;
    } catch (error) {
      logError("Unable to read local Player demand signal", error);
      return [];
    }
  }

  function aggregate(signals) {
    try {
      const groups = new Map();
      signals.forEach((signal) => {
        const key = `${signal.system}|${signal.day}|${signal.start}|${signal.end}`;
        if (!groups.has(key)) groups.set(key, { ...signal, count: 0, localCount: 0 });
        const group = groups.get(key);
        group.count += 1;
        if (signal.local) group.localCount += 1;
      });
      return [...groups.values()].sort((a, b) => b.count - a.count);
    } catch (error) {
      logError("Unable to aggregate Player demand", error);
      return [];
    }
  }

  function render() {
    try {
      const grid = document.querySelector("#demand-grid");
      if (!grid) return;
      const sample = Array.isArray(window.DDD_PLAYER_DEMAND) ? window.DDD_PLAYER_DEMAND : [];
      const groups = aggregate([...sample, ...localPlayerSignals()]);
      grid.replaceChildren();
      groups.forEach((group) => {
        const card = document.createElement("article");
        card.className = "demand-card";
        const opportunity = group.count >= 4 ? "Strong opportunity: enough visible demand to recruit a GM and venue." : "Emerging demand: more compatible Players would strengthen this match.";
        card.innerHTML = `<p class="eyebrow">PLAYER DEMAND</p><div class="demand-count">${group.count}</div><h3>${group.system}</h3><p><strong>${group.day} · ${group.start}–${group.end}</strong></p><div class="demand-meta"><span>Florence-area pilot</span><span>Recurring window</span>${group.localCount ? "<span>Your signal included</span>" : ""}</div><p class="demand-opportunity">${opportunity}</p><a class="button secondary" href="find-venue.html?system=${encodeURIComponent(group.system)}&day=${encodeURIComponent(group.day)}&start=${encodeURIComponent(group.start)}">Try to Form This Table</a>`;
        grid.appendChild(card);
      });
    } catch (error) {
      logError("Unable to render Player demand", error);
      const grid = document.querySelector("#demand-grid");
      if (grid) grid.textContent = "Player demand is temporarily unavailable.";
    }
  }

  render();
})();
