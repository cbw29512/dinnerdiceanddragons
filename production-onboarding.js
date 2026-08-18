(() => {
  "use strict";

  const SUPPORTED_TYPES = new Set(["Player", "Game Master"]);

  class ProductionAuthRequiredError extends Error {
    constructor(message = "Sign in to save this profile to your DDD account.") {
      super(message);
      this.name = "ProductionAuthRequiredError";
      this.status = 401;
    }
  }

  function alignProductionControls() {
    const learning = document.querySelector('#player-form [name="willing_to_learn"]');
    if (!learning) return;
    Array.from(learning.options).forEach((option) => {
      if (option.textContent.trim() === "Maybe") option.remove();
    });
  }

  function browserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch {
      return "America/New_York";
    }
  }

  function isEnabled(type) {
    return SUPPORTED_TYPES.has(type) && Boolean(
      window.DDDProductionAuth &&
      window.DDDProductionAPI &&
      window.DDDProductionOnboardingAdapters
    );
  }

  async function save(type, rawValues) {
    if (!isEnabled(type)) {
      throw new Error(`Production onboarding is not available for ${type}.`);
    }

    const session = await window.DDDProductionAuth.getSession();
    if (!session) throw new ProductionAuthRequiredError();

    const options = { timezone: browserTimezone() };
    const mapped = type === "Player"
      ? window.DDDProductionOnboardingAdapters.player(rawValues, options)
      : window.DDDProductionOnboardingAdapters.gm(rawValues, options);

    const result = type === "Player"
      ? await window.DDDProductionAPI.putPlayerOnboarding(mapped.payload)
      : await window.DDDProductionAPI.putGMOnboarding(mapped.payload);

    return {
      shared: true,
      production: true,
      result,
      deferred: mapped.deferred,
      payload: mapped.payload
    };
  }

  function init() {
    // Authentication UI is owned exclusively by global-auth-ui.js.
    // This module only adapts and persists Player/GM onboarding forms.
    alignProductionControls();
  }

  window.DDDProductionOnboarding = Object.freeze({
    ProductionAuthRequiredError,
    browserTimezone,
    init,
    isEnabled,
    save
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
