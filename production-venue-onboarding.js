(() => {
  "use strict";

  function log(message, error) {
    console.error(`[DDD Venue Onboarding] ${message}`, error);
  }

  function venueWindowPayload(deferred, timezone) {
    try {
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
        approval_required: false,
        special_support_offerings: [],
        special_support_notes: null,
        environment_notes: environmentNotes || null
      };
    } catch (error) {
      log("Unable to build Venue table window", error);
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
      log("Unable to build Venue table windows", error);
      throw error;
    }
  }

  function calendarPayload(payloads) {
    const items = Array.isArray(payloads) ? payloads : [];
    const first = items[0];
    if (!first) throw new Error("Choose at least one Venue availability time.");
    for (const item of items) {
      if (
        Number(item.table_count) !== Number(first.table_count) ||
        Number(item.max_people_per_table) !== Number(first.max_people_per_table) ||
        String(item.purchase_policy || "") !== String(first.purchase_policy || "") ||
        String(item.environment_notes || "") !== String(first.environment_notes || "")
      ) {
        throw new Error("Venue calendar settings must be consistent across selected times.");
      }
    }
    return {
      availability: items.map((item) => item.availability),
      table_count: Number(first.table_count),
      max_people_per_table: Number(first.max_people_per_table),
      purchase_policy: first.purchase_policy || null,
      environment_notes: first.environment_notes || null
    };
  }

  async function saveVenueWindows(venueId, payloads) {
    try {
      const saved = await window.DDDProductionAPI.putVenueTableWindows(
        venueId,
        calendarPayload(payloads)
      );
      return [saved];
    } catch (error) {
      log("Unable to persist Venue table availability", error);
      throw error;
    }
  }

  window.DDDProductionVenueOnboarding = Object.freeze({
    calendarPayload,
    saveVenueWindows,
    venueWindowPayload,
    venueWindowPayloads
  });
})();
