(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function venueWindows(venue, day, start, end) {
    try {
      return (venue.windows || []).filter((slot) => slot.day === day && window.DDDTableMatch.minutes(slot.start) <= start && window.DDDTableMatch.minutes(slot.end) >= end);
    } catch (error) {
      logError(`Unable to inspect ${venue.name} windows`, error);
      return [];
    }
  }

  async function calculateLocal(values) {
    try {
      const gmPoint = await window.DDDGeo.lookupZip(values.gmZip);
      const end = values.start + values.duration;
      const matches = [];
      for (const venue of window.DDD_VENUES || []) {
        try {
          const windows = venueWindows(venue, values.day, values.start, end);
          if (!windows.length) continue;
          const venuePoint = await window.DDDGeo.lookupZip(venue.postalCode);
          const distance = window.DDDGeo.distanceMiles(gmPoint, venuePoint);
          if (!Number.isFinite(distance) || distance > values.gmRadius) continue;
          const players = await window.DDDTableMatch.eligiblePlayers(values.system, values.day, values.start, end, venue.postalCode);
          if (!players.length) continue;
          const seatsPerTable = Math.max(...windows.map((slot) => slot.seatsPerTable || 0));
          const hardFit = window.DDDTableMatch.hardFit(players.length, seatsPerTable);
          const score = window.DDDTableMatch.scoreMatch(hardFit.usablePlayers, distance, values.gmRadius, seatsPerTable);
          matches.push({ ...values, mode:"prototype", venue, eligiblePlayerCount:players.length, distance, seatsPerTable, hardFit, score });
        } catch (error) {
          logError(`Unable to evaluate local venue ${venue.name || venue.id || "venue"}`, error);
        }
      }
      return matches.sort((a, b) => Number(b.hardFit.viable) - Number(a.hardFit.viable) || b.score.total - a.score.total);
    } catch (error) {
      logError("Unable to calculate local Table Matches", error);
      return [];
    }
  }

  async function calculateShared(values) {
    try {
      const result = await window.DDD_API.post("match.query", {
        system:values.system,
        day:values.day,
        start:values.startText,
        duration:values.duration,
        gm_zip:values.gmZip,
        gm_radius:values.gmRadius,
        min_players:3,
        max_players:5
      });
      if (!result.ok || !Array.isArray(result.matches)) throw new Error(result.error || "Invalid shared matcher response");
      return result.matches.map((match) => ({ ...match, gmZip:values.gmZip, gmRadius:values.gmRadius, mode:"shared" }));
    } catch (error) {
      logError("Unable to calculate shared Table Matches", error);
      throw error;
    }
  }

  async function calculate(values) {
    try {
      if (window.DDD_API?.isConfigured()) {
        try {
          return { matches:await calculateShared(values), mode:"shared" };
        } catch (error) {
          logError("Shared matcher unavailable; falling back to prototype calculation", error);
          return { matches:await calculateLocal(values), mode:"prototype-fallback" };
        }
      }
      return { matches:await calculateLocal(values), mode:"prototype" };
    } catch (error) {
      logError("Unable to calculate Table Match", error);
      return { matches:[], mode:"error" };
    }
  }

  window.DDDTableMatchCalculator = { calculate };
})();
