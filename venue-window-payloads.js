(() => {
  "use strict";

  function fromRaw(rawValues, deferred, timezone) {
    try {
      const adapter = window.DDDProductionOnboardingAdapters;
      if (!adapter?.availabilityWindows) throw new Error("Availability adapter is unavailable.");
      const availability = adapter.availabilityWindows(rawValues, timezone);
      const environmentNotes = [deferred?.age_policy, deferred?.combined_environment_notes]
        .filter(Boolean)
        .join("\n");
      const tableCount = Number(deferred?.table_count);
      const seats = Number(deferred?.seats_per_table);
      if (!Number.isInteger(tableCount) || tableCount < 1) throw new Error("Venue table count is invalid.");
      if (!Number.isInteger(seats) || seats < 1) throw new Error("Venue seat capacity is invalid.");
      return availability.map((rule) => ({
        availability: rule,
        table_count: tableCount,
        max_people_per_table: seats,
        purchase_policy: deferred?.purchase_policy || null,
        approval_required: false,
        special_support_offerings: [],
        special_support_notes: null,
        environment_notes: environmentNotes || null
      }));
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to map Venue calendar windows", error);
      throw error;
    }
  }

  window.DDDVenueWindowPayloads = Object.freeze({ fromRaw });
})();