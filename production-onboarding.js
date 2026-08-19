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

  function venueWindowPayload(deferred, timezone) {
    const recurrence = String(deferred.recurrence || "Weekly").trim();
    if (recurrence !== "Weekly") {
      throw new Error("Production Venue table windows currently require a weekly opening.");
    }

    const environmentNotes = [deferred.age_policy, deferred.combined_environment_notes]
      .filter(Boolean)
      .join("\n");

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

  function rememberPendingVenueWindow(venueId, payload) {
    try {
      localStorage.setItem(PENDING_VENUE_WINDOW_KEY, JSON.stringify({ venueId, payload }));
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to remember pending Venue table window", error);
    }
  }

  async function resumePendingVenueWindow() {
    try {
      const session = await window.DDDProductionAuth?.getSession?.();
      if (!session || !window.DDDProductionAPI?.postVenueTableWindow) return null;
      const raw = localStorage.getItem(PENDING_VENUE_WINDOW_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw);
      if (!pending?.venueId || !pending?.payload) return null;
      const result = await window.DDDProductionAPI.postVenueTableWindow(pending.venueId, pending.payload);
      localStorage.removeItem(PENDING_VENUE_WINDOW_KEY);
      window.dispatchEvent(new CustomEvent("ddd:venue-window-activated", { detail: result }));
      return result;
    } catch (error) {
      if (error?.status !== 403) {
        console.error("[Dinner Dice & Dragons] Unable to activate pending Venue table window", error);
      }
      return null;
    }
  }

  async function save(type, rawValues) {
    if (!isEnabled(type)) {
      throw new Error(`Production onboarding is not available for ${type}.`);
    }

    const session = await window.DDDProductionAuth.getSession();
    if (!session) throw new ProductionAuthRequiredError();

    const options = { timezone: browserTimezone() };
    let mapped;
    let result;
    let pendingVerification = false;

    if (type === "Player") {
      mapped = window.DDDProductionOnboardingAdapters.player(rawValues, options);
      result = await window.DDDProductionAPI.putPlayerOnboarding(mapped.payload);
    } else if (type === "Game Master") {
      mapped = window.DDDProductionOnboardingAdapters.gm(rawValues, options);
      result = await window.DDDProductionAPI.putGMOnboarding(mapped.payload);
    } else {
      mapped = window.DDDProductionOnboardingAdapters.venue(rawValues, options);
      result = await window.DDDProductionAPI.postVenueOnboarding(mapped.payload);
      const windowPayload = venueWindowPayload(mapped.deferred, options.timezone);
      rememberPendingVenueWindow(result.venue_id, windowPayload);
      pendingVerification = !result.manager_verified || !result.venue_verified;
      if (!pendingVerification) await resumePendingVenueWindow();
    }

    return {
      shared: true,
      production: true,
      result,
      deferred: mapped.deferred,
      payload: mapped.payload,
      pendingVerification
    };
  }

  function init() {
    // Authentication UI is owned exclusively by global-auth-ui.js.
    // This module adapts and persists authenticated production onboarding forms.
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
    venueWindowPayload
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
