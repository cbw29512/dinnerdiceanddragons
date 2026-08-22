(() => {
  "use strict";

  const SUPPORTED_TYPES = new Set(["Player", "Game Master", "Venue"]);

  class ProductionAuthRequiredError extends Error {
    constructor(message = "Sign in to save this profile to your DDD account.") {
      super(message);
      this.name = "ProductionAuthRequiredError";
      this.status = 401;
    }
  }

  function alignProductionControls() {
    try {
      const learning = document.querySelector('#player-form [name="willing_to_learn"]');
      if (!learning) return;
      Array.from(learning.options).forEach((option) => {
        if (option.textContent.trim() === "Maybe") option.remove();
      });
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to align production controls", error);
    }
  }

  function browserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to resolve browser timezone", error);
      return "America/New_York";
    }
  }

  function isEnabled(type) {
    return SUPPORTED_TYPES.has(type) && Boolean(
      window.DDDProductionAuth && window.DDDProductionAPI && window.DDDProductionOnboardingAdapters
    );
  }

  async function activateMatching(type, mapped, rawValues) {
    if (!window.DDDProductionMatching?.syncAndFind) {
      return {
        matching: null,
        matchingError: new Error("Production matching bridge is unavailable on this page.")
      };
    }
    try {
      return {
        matching: await window.DDDProductionMatching.syncAndFind(type, mapped, rawValues),
        matchingError: null
      };
    } catch (error) {
      console.error(`[Dinner Dice & Dragons] Unable to activate ${type} matching`, error);
      return { matching: null, matchingError: error };
    }
  }

  function venueTools() {
    const tools = window.DDDProductionVenueOnboarding;
    if (!tools) throw new Error("Production Venue onboarding bridge is unavailable on this page.");
    return tools;
  }

  async function save(type, rawValues) {
    try {
      if (!isEnabled(type)) throw new Error(`Production onboarding is not available for ${type}.`);
      const session = await window.DDDProductionAuth.getSession();
      if (!session) throw new ProductionAuthRequiredError();
      const options = { timezone: browserTimezone() };
      let mapped;
      let result;
      let pendingVerification = false;
      let matching = null;
      let matchingError = null;
      let venueWindows = [];

      if (type === "Player") {
        mapped = window.DDDProductionOnboardingAdapters.player(rawValues, options);
        result = await window.DDDProductionAPI.putPlayerOnboarding(mapped.payload);
        ({ matching, matchingError } = await activateMatching(type, mapped, rawValues));
      } else if (type === "Game Master") {
        mapped = window.DDDProductionOnboardingAdapters.gm(rawValues, options);
        result = await window.DDDProductionAPI.putGMOnboarding(mapped.payload);
        ({ matching, matchingError } = await activateMatching(type, mapped, rawValues));
      } else {
        mapped = window.DDDProductionOnboardingAdapters.venue(rawValues, options);
        result = await window.DDDProductionAPI.postVenueOnboarding(mapped.payload);
        pendingVerification = !result.manager_verified || !result.venue_verified;
        const tools = venueTools();
        venueWindows = await tools.saveVenueWindows(
          result.venue_id,
          tools.venueWindowPayloads(rawValues, mapped.deferred, options.timezone)
        );
      }

      return {
        shared: true,
        production: true,
        result,
        deferred: mapped.deferred,
        payload: mapped.payload,
        pendingVerification,
        venueWindows,
        matching,
        matchingError
      };
    } catch (error) {
      console.error(`[Dinner Dice & Dragons] Unable to save ${type} onboarding`, error);
      throw error;
    }
  }

  function init() {
    try {
      alignProductionControls();
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to initialize production onboarding", error);
    }
  }

  window.DDDProductionOnboarding = Object.freeze({
    ProductionAuthRequiredError,
    browserTimezone,
    init,
    isEnabled,
    save
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
