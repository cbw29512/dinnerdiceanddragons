(() => {
  "use strict";

  // Data schema: a demand signal is one Player + system + playable time window + travel constraint.
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

  function normalizeSystem(value) {
    try {
      const system = String(value || "").trim();
      if (system.startsWith("D&D 5e")) return "D&D 5e";
      if (system.startsWith("Call of Cthulhu")) return "Call of Cthulhu";
      return system;
    } catch (error) {
      logError("Unable to normalize RPG system", error);
      return "";
    }
  }

  function asArray(value) {
    try {
      if (Array.isArray(value)) return value.filter(Boolean);
      return value ? [value] : [];
    } catch (error) {
      logError("Unable to normalize list value", error);
      return [];
    }
  }

  function localSignals() {
    try {
      const raw = localStorage.getItem("ddd-preview-player");
      if (!raw) return [];
      const profile = JSON.parse(raw);
      const systems = asArray(profile.player_system).map(normalizeSystem).filter(Boolean);
      const days = asArray(profile.availability_day);
      const starts = asArray(profile.availability_start);
      const ends = asArray(profile.availability_end);
      const output = [];

      systems.forEach((system) => {
        days.forEach((day, index) => {
          if (!day || !starts[index] || !ends[index] || !profile.postal_code) return;
          output.push({
            id: `local-${system}-${index}`,
            system,
            day,
            start: starts[index],
            end: ends[index],
            zip: profile.postal_code,
            radius: Number(profile.radius) || 25,
            local: true
          });
        });
      });
      return output;
    } catch (error) {
      logError("Unable to read local demand signals", error);
      return [];
    }
  }

  function allSignals() {
    try {
      const seeded = (window.DDD_PLAYER_DEMAND || []).map((signal) => ({
        ...signal,
        system: normalizeSystem(signal.system)
      }));
      return [...seeded, ...localSignals()];
    } catch (error) {
      logError("Unable to assemble Player demand signals", error);
      return [];
    }
  }

  function summarizeDemand() {
    try {
      const groups = new Map();
      allSignals().forEach((signal) => {
        if (!signal.system || !signal.day) return;
        const key = `${signal.system}::${signal.day}`;
        const current = groups.get(key) || { system: signal.system, day: signal.day, count: 0, localCount: 0 };
        current.count += 1;
        if (signal.local) current.localCount += 1;
        groups.set(key, current);
      });
      return [...groups.values()].sort((a, b) => b.count - a.count || a.system.localeCompare(b.system) || a.day.localeCompare(b.day));
    } catch (error) {
      logError("Unable to summarize Player demand", error);
      return [];
    }
  }

  async function eligiblePlayers(system, day, start, end, venueZip) {
    try {
      const normalizedSystem = normalizeSystem(system);
      const venuePoint = await window.DDDGeo.lookupZip(venueZip);
      const eligible = [];
      for (const signal of allSignals()) {
        try {
          if (signal.system !== normalizedSystem || signal.day !== day) continue;
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

  function hardFit(playerCount, seatsPerTable) {
    try {
      const playerCapacity = Math.max(0, Number(seatsPerTable) - 1);
      const usablePlayers = Math.min(Number(playerCount) || 0, playerCapacity);
      return {
        playerCapacity,
        usablePlayers,
        viable: usablePlayers >= MIN_DEMAND,
        needsPlayers: Math.max(0, MIN_DEMAND - usablePlayers)
      };
    } catch (error) {
      logError("Unable to evaluate hard-fit capacity", error);
      return { playerCapacity: 0, usablePlayers: 0, viable: false, needsPlayers: MIN_DEMAND };
    }
  }

  function scoreMatch(usablePlayers, gmDistance, gmRadius, seatsPerTable) {
    try {
      const demand = Math.min(40, Math.round((usablePlayers / TARGET_PLAYERS) * 40));
      const distance = Math.max(5, Math.round(25 * (1 - (gmDistance / Math.max(gmRadius, 1)))));
      const schedule = 25;
      const capacity = seatsPerTable >= usablePlayers + 1 ? 10 : 0;
      return { total: Math.min(100, demand + distance + schedule + capacity), demand, distance, schedule, capacity };
    } catch (error) {
      logError("Unable to score Table Match", error);
      return { total: 0, demand: 0, distance: 0, schedule: 0, capacity: 0 };
    }
  }

  window.DDDTableMatch = {
    MIN_DEMAND,
    minutes,
    normalizeSystem,
    allSignals,
    summarizeDemand,
    eligiblePlayers,
    hardFit,
    scoreMatch
  };
})();
