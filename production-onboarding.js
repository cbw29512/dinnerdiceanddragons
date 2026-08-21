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
      window.DDDProductionAuth &&
      window.DDDProductionAPI &&
      window.DDDProductionOnboardingAdapters
    );
  }

  function venueWindowPayload(deferred, timezone) {
    try {
      const recurrence = String(deferred.recurrence || "Weekly").trim();
      if (recurrence !== "Weekly") throw new Error("Production Venue table windows currently require a weekly opening.");
      const environmentNotes = [deferred.age_policy, deferred.combined_environment_notes].filter(Boolean).join("\n");
      return {
        availability: {
          day_of_week: String(deferred.window_day || "").trim().toLowerCase(),
          start_time: String(deferred.window_start || "").trim(),
          end_time: String(deferred.window_end || "").trim(),
          pattern_type: "weekly_interval",
          week_interval: 1,
          anchor_date: null,
          monthly_ordinal: null,
          month_interval: null,
          timezone,
          starts_on: null,
          ends_on: null
        },
        table_count: Number(deferred.table_count),
        max_people_per_table: Number(deferred.seats_per_table),
        purchase_policy: deferred.purchase_policy || null,
        approval_required: false,
        special_support_offerings: [],
        special_support_notes: null,
        environment_notes: environmentNotes || null
      };
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to build Venue table window", error);
      throw error;
    }
  }

  function venueWindowPayloads(rawValues, deferred, timezone) {
    try {
      if (window.DDDVenueWindowPayloads?.fromRaw && rawValues?.availability_day) {
        return window.DDDVenueWindowPayloads.fromRaw(rawValues, deferred, timezone);
      }
      return [venueWindowPayload(deferred, timezone)];
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to build Venue table windows", error);
      throw error;
    }
  }

  async function saveVenueWindows(venueId, payloads) {
    try {
      const results = [];
      for (const payload of payloads) {
        results.push(await window.DDDProductionAPI.postVenueTableWindow(venueId, payload));
      }
      return results;
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to persist Venue table availability", error);
      throw error;
    }
  }

  function locationKind(rawValues) {
    const value = String(rawValues?.location_kind || "business").trim();
    if (!["business", "private_residence"].includes(value)) {
      throw new Error("Choose whether the game location is a business/public place or a private residence.");
    }
    return value;
  }

  async function activateMatching(type, mapped, rawValues) {
    if (!window.DDDProductionMatching?.syncAndFind) {
      return { matching: null, matchingError: new Error("Production matching bridge is unavailable on this page.") };
    }
    try {
      return { matching: await window.DDDProductionMatching.syncAndFind(type, mapped, rawValues), matchingError: null };
    } catch (error) {
      console.error(`[Dinner Dice & Dragons] Unable to activate ${type} matching`, error);
      return { matching: null, matchingError: error };
    }
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
        await window.DDDProductionAPI.putVenueLocationKind(result.venue_id, locationKind(rawValues));
        pendingVerification = !result.manager_verified || !result.venue_verified;
        venueWindows = await saveVenueWindows(
          result.venue_id,
          venueWindowPayloads(rawValues, mapped.deferred, options.timezone)
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
    save,
    saveVenueWindows,
    venueWindowPayload,
    venueWindowPayloads
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
