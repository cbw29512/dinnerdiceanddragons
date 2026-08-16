(() => {
  "use strict";

  const SYSTEM_SLUGS = Object.freeze({
    "D&D 5e (2014)": "dnd-5e-2014",
    "D&D 5e (2024)": "dnd-5e-2024",
    "Pathfinder 2e": "pathfinder-2e",
    "Call of Cthulhu": "call-of-cthulhu",
    "Cyberpunk RED": "cyberpunk-red",
    Shadowrun: "shadowrun",
    Other: "other-rpg"
  });

  const PLAYER_COMFORT = Object.freeze({
    New: "new",
    Learning: "learning",
    Comfortable: "comfortable",
    "Very Experienced": "very_experienced"
  });

  const GM_COMFORT = Object.freeze({
    Learning: "learning",
    Comfortable: "comfortable",
    "Very Comfortable": "very_comfortable",
    Expert: "expert"
  });

  const FORMAT_VALUES = Object.freeze({
    "Learn-to-play": "learn_to_play",
    "One-shot": "one_shot",
    "Short campaign": "short_campaign",
    "Long campaign": "long_campaign",
    "Organized play": "organized_play"
  });

  const ALL_GM_FORMATS = Object.freeze(Object.values(FORMAT_VALUES));

  const PREFERRED_FORMATS = Object.freeze({
    "Any format": "any",
    ...FORMAT_VALUES
  });

  class ProductionOnboardingMappingError extends Error {
    constructor(message) {
      super(message);
      this.name = "ProductionOnboardingMappingError";
    }
  }

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function asArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === "") return [];
    return [value];
  }

  function optionalText(value) {
    const normalized = String(value || "").trim();
    return normalized || null;
  }

  function requiredMappedValue(map, value, fieldName) {
    const key = String(value || "").trim();
    const mapped = map[key];
    if (!mapped) {
      throw new ProductionOnboardingMappingError(
        `${fieldName} contains an unsupported value: ${key || "(blank)"}.`
      );
    }
    return mapped;
  }

  function numberValue(value, fieldName) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new ProductionOnboardingMappingError(`${fieldName} must be a number.`);
    }
    return parsed;
  }

  function availabilityWindows(raw, timezone) {
    try {
      const zone = String(timezone || "").trim();
      if (!zone) {
        throw new ProductionOnboardingMappingError(
          "A valid browser/user timezone is required for production availability."
        );
      }

      const days = asArray(raw.availability_day);
      const starts = asArray(raw.availability_start);
      const ends = asArray(raw.availability_end);
      const patterns = asArray(raw.availability_pattern);
      const weekIntervals = asArray(raw.availability_week_interval);
      const anchors = asArray(raw.availability_anchor_date);
      const ordinals = asArray(raw.availability_monthly_ordinal);
      const monthIntervals = asArray(raw.availability_month_interval);

      if (!days.length) {
        throw new ProductionOnboardingMappingError(
          "At least one recurring availability window is required."
        );
      }

      return days.map((day, index) => {
        const pattern = String(patterns[index] || "weekly").trim();
        const anchor = optionalText(anchors[index]);
        const base = {
          day_of_week: String(day).trim().toLowerCase(),
          start_time: String(starts[index] || "").trim(),
          end_time: String(ends[index] || "").trim(),
          timezone: zone
        };

        if (!base.start_time || !base.end_time) {
          throw new ProductionOnboardingMappingError(
            `Availability window ${index + 1} requires start and end times.`
          );
        }

        if (pattern === "monthly") {
          const monthInterval = numberValue(
            monthIntervals[index] || 1,
            `Availability window ${index + 1} month interval`
          );
          return {
            ...base,
            pattern_type: "monthly_ordinal_weekday",
            week_interval: null,
            anchor_date: monthInterval > 1 ? anchor : null,
            monthly_ordinal: String(ordinals[index] || "Last").trim().toLowerCase(),
            month_interval: monthInterval,
            starts_on: null,
            ends_on: null
          };
        }

        if (pattern !== "weekly") {
          throw new ProductionOnboardingMappingError(
            `Availability window ${index + 1} has an unsupported recurrence pattern.`
          );
        }

        const weekInterval = numberValue(
          weekIntervals[index] || 1,
          `Availability window ${index + 1} week interval`
        );
        return {
          ...base,
          pattern_type: "weekly_interval",
          week_interval: weekInterval,
          anchor_date: weekInterval > 1 ? anchor : null,
          monthly_ordinal: null,
          month_interval: null,
          starts_on: null,
          ends_on: null
        };
      });
    } catch (error) {
      logError("Unable to map production availability", error);
      throw error;
    }
  }

  function playerSystems(raw) {
    const systems = asArray(raw.player_system);
    const years = asArray(raw.player_years);
    const comfort = asArray(raw.player_comfort);
    const notes = asArray(raw.player_system_notes);

    if (!systems.length) {
      throw new ProductionOnboardingMappingError(
        "At least one Player game system is required."
      );
    }

    return systems.map((system, index) => ({
      system_slug: requiredMappedValue(SYSTEM_SLUGS, system, "Player system"),
      years_playing: numberValue(years[index] || 0, "Player years playing"),
      comfort_level: requiredMappedValue(
        PLAYER_COMFORT,
        comfort[index],
        "Player comfort level"
      ),
      experience_notes: optionalText(notes[index])
    }));
  }

  function gmFormats(value) {
    const label = String(value || "").trim();
    if (label === "Any format") return [...ALL_GM_FORMATS];
    return [requiredMappedValue(FORMAT_VALUES, label, "GM format")];
  }

  function gmSystems(raw) {
    const systems = asArray(raw.gm_system);
    const playYears = asArray(raw.gm_play_years);
    const runYears = asArray(raw.gm_run_years);
    const comfort = asArray(raw.gm_comfort);
    const formats = asArray(raw.gm_format);
    const notes = asArray(raw.gm_system_notes);

    if (!systems.length) {
      throw new ProductionOnboardingMappingError(
        "At least one GM game system is required."
      );
    }

    return systems.map((system, index) => ({
      system_slug: requiredMappedValue(SYSTEM_SLUGS, system, "GM system"),
      years_playing: numberValue(playYears[index] || 0, "GM years playing"),
      years_gming: numberValue(runYears[index] || 0, "GM years GMing"),
      comfort_level: requiredMappedValue(GM_COMFORT, comfort[index], "GM comfort level"),
      preferred_player_experience: "any",
      formats: gmFormats(formats[index]),
      experience_notes: optionalText(notes[index])
    }));
  }

  function willingToLearn(value) {
    const normalized = String(value || "").trim();
    if (normalized === "Yes") return true;
    if (normalized === "No") return false;
    throw new ProductionOnboardingMappingError(
      "Production onboarding requires a clear Yes or No for learning a new system."
    );
  }

  function player(raw, options = {}) {
    try {
      return {
        payload: {
          display_name: String(raw.display_name || "").trim(),
          bio: null,
          postal_code: String(raw.postal_code || "").trim(),
          travel_radius_miles: numberValue(raw.radius, "Player travel radius"),
          preferred_format: requiredMappedValue(
            PREFERRED_FORMATS,
            raw.preferred_format,
            "Player preferred format"
          ),
          willing_to_learn_new_system: willingToLearn(raw.willing_to_learn),
          environment_preferences: [],
          accessibility_notes_private: null,
          systems: playerSystems(raw),
          availability: availabilityWindows(raw, options.timezone)
        },
        deferred: {
          table_style_preference: optionalText(raw.style),
          matching_and_accessibility_notes: optionalText(raw.notes)
        }
      };
    } catch (error) {
      logError("Unable to map Player onboarding", error);
      throw error;
    }
  }

  function gm(raw, options = {}) {
    try {
      return {
        payload: {
          display_name: String(raw.display_name || "").trim(),
          bio: null,
          postal_code: String(raw.postal_code || "").trim(),
          travel_radius_miles: numberValue(raw.radius, "GM travel radius"),
          beginner_friendly: false,
          gm_style: String(raw.style || "").trim(),
          systems: gmSystems(raw),
          availability: availabilityWindows(raw, options.timezone)
        },
        deferred: {
          preferred_cadence: optionalText(raw.cadence),
          welcomed_players: optionalText(raw.welcome),
          table_expectations: optionalText(raw.expectations)
        }
      };
    } catch (error) {
      logError("Unable to map GM onboarding", error);
      throw error;
    }
  }

  function venue(raw) {
    try {
      return {
        payload: {
          name: String(raw.business_name || "").trim(),
          venue_type: "public_venue",
          address_line1: String(raw.address || "").trim(),
          address_line2: null,
          city: String(raw.city || "").trim(),
          state_region: String(raw.state || "").trim().toUpperCase(),
          postal_code: String(raw.postal_code || "").trim(),
          website_url: null,
          phone: null,
          amenities: [],
          accessibility_notes: null,
          parking_notes: null,
          noise_notes: null,
          lighting_notes: null,
          manager_role: "manager"
        },
        deferred: {
          contact_name: optionalText(raw.contact_name),
          window_day: optionalText(raw.window_day),
          window_start: optionalText(raw.window_start),
          window_end: optionalText(raw.window_end),
          table_count: optionalText(raw.table_count),
          seats_per_table: optionalText(raw.seats_per_table),
          recurrence: optionalText(raw.recurrence),
          purchase_policy: optionalText(raw.purchase_policy),
          age_policy: optionalText(raw.age_policy),
          combined_environment_notes: optionalText(raw.accessibility),
          approval_required: Boolean(raw.approval_required)
        }
      };
    } catch (error) {
      logError("Unable to map Venue onboarding", error);
      throw error;
    }
  }

  window.DDDProductionOnboardingAdapters = Object.freeze({
    ProductionOnboardingMappingError,
    availabilityWindows,
    player,
    gm,
    venue
  });
})();
