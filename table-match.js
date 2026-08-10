(() => {
  "use strict";

  const MIN_DEMAND = 3;
  const TARGET_PLAYERS = 5;

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function minutes(value) {
    try {
      const [h, m] = String(value).split(":").map(Number);
      return Number.isFinite(h) && Number.isFinite(m) ? (h * 60) + m : Number.NaN;
    } catch (error) {
      logError("Unable to parse time", error);
      return Number.NaN;
    }
  }

  function localSignals() {
    try {
      const raw = localStorage.getItem("ddd-preview-player");
      if (!raw) return [];
      const p = JSON.parse(raw);
      const systems = Array.isArray(p.player_system) ? p.player_system : [p.player_system].filter(Boolean);
      const days = Array.isArray(p.availability_day) ? p.availability_day : [p.availability_day].filter(Boolean);
      const starts = Array.isArray(p.availability_start) ? p.availability_start : [p.availability_start].filter(Boolean);
      const ends = Array.isArray(p.availability_end) ? p.availability_end : [p.availability_end].filter(Boolean);
      const out = [];
      systems.forEach((system) => days.forEach((day, i) => out.push({
        id: `local-${system}-${i}`, system: String(system).startsWith("D&D 5e") ? "D&D 5e" : system,
        day, start: starts[i], end: ends[i], zip: p.postal_code, radius: Number(p.radius) || 25, local: true
      })));
      return out;
    } catch (error) {
      logError("Unable to read local demand signals", error);
      return [];
    }
  }

  async function eligiblePlayers(system, day, start, end, venueZip) {
    try {
      const signals = [...(window.DDD_PLAYER_DEMAND || []), ...localSignals()];
      const venuePoint = await window.DDDGeo.lookupZip(venueZip);
      const eligible = [];
      for (const signal of signals) {
        try {
          if (signal.system !== system || signal.day !== day) continue;
          if (minutes(signal.start) > start || minutes(signal.end) < end) continue;
          const playerPoint = await window.DDDGeo.lookupZip(signal.zip);
          const distance = window.DDDGeo.distanceMiles(playerPoint, venuePoint);
          if (Number.isFinite(distance) && distance <= signal.radius) eligible.push({ ...signal, distance });
        } catch (error) {
          logError(`Unable to evaluate Player ${signal.id || "signal"}`, error);
        }
      }
      return eligible;
    } catch (error) {
      logError("Unable to calculate eligible Players", error);
      return [];
    }
  }

  function scoreMatch(playerCount, gmDistance, gmRadius, seats) {
    try {
      const demand = Math.min(40, Math.round((playerCount / TARGET_PLAYERS) * 40));
      const distance = Math.max(5, Math.round(25 * (1 - (gmDistance / Math.max(gmRadius, 1)))));
      const schedule = 25;
      const capacity = seats >= playerCount + 1 ? 10 : Math.max(2, Math.round((seats / (playerCount + 1)) * 10));
      return { total: Math.min(100, demand + distance + schedule + capacity), demand, distance, schedule, capacity };
    } catch (error) {
      logError("Unable to score Table Match", error);
      return { total: 0, demand: 0, distance: 0, schedule: 0, capacity: 0 };
    }
  }

  window.DDDTableMatch = { MIN_DEMAND, minutes, eligiblePlayers, scoreMatch };
})();
