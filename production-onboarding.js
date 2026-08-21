(() => {
  "use strict";

  const SUPPORTED_TYPES = new Set(["Player", "Game Master", "Venue"]);
  const PENDING_VENUE_WINDOW_KEY = "ddd-pending-production-venue-window";

  class ProductionAuthRequiredError extends Error {
    constructor(message = "Sign in to save this profile to your DDD account.") {
      super(message);
      this.name = "ProductionAuthRequiredError";
      this.status = 401;
    }
  }

  function alignProductionControls() {
    const learning = document.querySelector('#player-form [name="willing_to_learn"]');
    if (learning) {
      Array.from(learning.options).forEach((option) => {
        if (option.textContent.trim() === "Maybe") option.remove();
      });
    }
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

  function venueWindowPayload(deferred, timezone) {
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
      approval_required: Boolean(deferred.approval_required),
      special_support_offerings: [],
      special_support_notes: null,
      environment_notes: environmentNotes || null
    };
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

  function rememberPendingVenueWindows(venueId, payloads) {
    try {
      localStorage.setItem(PENDING_VENUE_WINDOW_KEY, JSON.stringify({ venueId, payloads }));
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to remember pending Venue table windows", error);
    }
  }

  async function resumePendingVenueWindow() {
    try {
      const session = await window.DDDProductionAuth?.getSession?.();
      if (!session || !window.DDDProductionAPI?.postVenueTableWindow) return null;
      const raw = localStorage.getItem(PENDING_VENUE_WINDOW_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw);
      const payloads = Array.isArray(pending?.payloads) ? pending.payloads : pending?.payload ? [pending.payload] : [];
      if (!pending?.venueId || !payloads.length) return null;
      const results = [];
      for (const payload of payloads) {
        results.push(await window.DDDProductionAPI.postVenueTableWindow(pending.venueId, payload));
      }
      localStorage.removeItem(PENDING_VENUE_WINDOW_KEY);
      window.dispatchEvent(new CustomEvent("ddd:venue-window-activated", { detail: results }));
      return results;
    } catch (error) {
      if (error?.status !== 403) console.error("[Dinner Dice & Dragons] Unable to activate pending Venue table windows", error);
      return null;
    }
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
        rememberPendingVenueWindows(result.venue_id, venueWindowPayloads(rawValues, mapped.deferred, options.timezone));
        pendingVerification = !result.manager_verified || !result.venue_verified;
        if (!pendingVerification) await resumePendingVenueWindow();
      }

      return {
        shared: true,
        production: true,
        result,
        deferred: mapped.deferred,
        payload: mapped.payload,
        pendingVerification,
        matching,
        matchingError
      };
    } catch (error) {
      console.error(`[Dinner Dice & Dragons] Unable to save ${type} onboarding`, error);
      throw error;
    }
  }

  function init() {
    alignProductionControls();
    window.setTimeout(() => { void resumePendingVenueWindow(); }, 0);
  }

  window.DDDProductionOnboarding = Object.freeze({
    ProductionAuthRequiredError,
    browserTimezone,
    init,
    isEnabled,
    resumePendingVenueWindow,
    save,
    venueWindowPayload,
    venueWindowPayloads
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
