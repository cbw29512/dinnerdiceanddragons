(() => {
  "use strict";

  class ProductionMatchingError extends Error {
    constructor(message) {
      super(message);
      this.name = "ProductionMatchingError";
    }
  }

  function boundedPreference(value, maxLength = 120) {
    const text = String(value || "").trim();
    if (!text) return null;
    return text.slice(0, maxLength);
  }

  function asPositiveInteger(value, fieldName) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      throw new ProductionMatchingError(`${fieldName} must be between 1 and 20.`);
    }
    return parsed;
  }

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, canonical(value[key])])
      );
    }
    return value ?? null;
  }

  function comparablePlayerDemand(value) {
    return canonical({
      system_slug: value.system_slug,
      availability: value.availability || [],
      preferred_format: value.preferred_format || "any",
      preferred_cadence: value.preferred_cadence || null,
      minimum_age_preference: value.minimum_age_preference ?? null,
      table_style_preferences: value.table_style_preferences || [],
      environment_preferences: value.environment_preferences || []
    });
  }

  function comparableGMSupply(value) {
    return canonical({
      system_slug: value.system_slug,
      availability: value.availability || [],
      preferred_format: value.preferred_format,
      preferred_cadence: value.preferred_cadence || null,
      minimum_players: Number(value.minimum_players),
      maximum_players: Number(value.maximum_players),
      table_style: value.table_style || null
    });
  }

  function samePayload(left, right, comparator) {
    return JSON.stringify(comparator(left)) === JSON.stringify(comparator(right));
  }

  function playerPayloads(mapped) {
    const style = boundedPreference(mapped.deferred?.table_style_preference);
    return (mapped.payload.systems || []).map((system) => ({
      system_slug: system.system_slug,
      availability: mapped.payload.availability,
      preferred_format: mapped.payload.preferred_format || "any",
      preferred_cadence: null,
      minimum_age_preference: null,
      table_style_preferences: style ? [style] : [],
      environment_preferences: mapped.payload.environment_preferences || []
    }));
  }

  function gmPayloads(mapped, rawValues) {
    const minimumPlayers = asPositiveInteger(rawValues.minimum_players, "Minimum Players");
    const maximumPlayers = asPositiveInteger(rawValues.maximum_players, "Maximum Players");
    if (maximumPlayers < minimumPlayers) {
      throw new ProductionMatchingError("Maximum Players cannot be below Minimum Players.");
    }

    return (mapped.payload.systems || []).map((system) => {
      if (!Array.isArray(system.formats) || system.formats.length !== 1) {
        throw new ProductionMatchingError(
          "Choose one specific game format for each GM system before entering live matching."
        );
      }
      return {
        system_slug: system.system_slug,
        availability: mapped.payload.availability,
        preferred_format: system.formats[0],
        preferred_cadence: boundedPreference(mapped.deferred?.preferred_cadence, 32),
        minimum_players: minimumPlayers,
        maximum_players: maximumPlayers,
        table_style: boundedPreference(mapped.payload.gm_style, 2000)
      };
    });
  }

  async function ensurePlayerDemands(mapped) {
    const existing = await window.DDDProductionAPI.getPlayerDemands();
    const active = (existing || []).filter((item) => item.status === "active");
    const results = [];
    for (const payload of playerPayloads(mapped)) {
      const match = active.find((item) => samePayload(item, payload, comparablePlayerDemand));
      results.push(match || await window.DDDProductionAPI.postPlayerDemand(payload));
    }
    return results;
  }

  async function ensureGMSupplies(mapped, rawValues) {
    const existing = await window.DDDProductionAPI.getGMSupplies();
    const active = (existing || []).filter((item) => item.status === "active");
    const results = [];
    for (const payload of gmPayloads(mapped, rawValues)) {
      const match = active.find((item) => samePayload(item, payload, comparableGMSupply));
      results.push(match || await window.DDDProductionAPI.postGMSupply(payload));
    }
    return results;
  }

  async function syncAndFind(type, mapped, rawValues) {
    if (!window.DDDProductionAPI?.isConfigured?.()) {
      throw new ProductionMatchingError("Production matching API is not configured.");
    }

    const signals = type === "Player"
      ? await ensurePlayerDemands(mapped)
      : await ensureGMSupplies(mapped, rawValues);
    const match = await window.DDDProductionAPI.findMyTable(60);
    return { signals, match };
  }

  window.DDDProductionMatching = Object.freeze({
    ProductionMatchingError,
    comparableGMSupply,
    comparablePlayerDemand,
    gmPayloads,
    playerPayloads,
    syncAndFind
  });
})();
