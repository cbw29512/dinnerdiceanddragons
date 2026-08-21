(() => {
  "use strict";

  const SYSTEM_LABELS = Object.freeze({
    "dnd-5e-2024": "D&D 5e (2024)", "dnd-5e-2014": "D&D 5e (2014)",
    "pathfinder-2e": "Pathfinder 2e", "call-of-cthulhu": "Call of Cthulhu",
    "cyberpunk-red": "Cyberpunk RED", shadowrun: "Shadowrun", "other-rpg": "Other"
  });
  const titleCase = (value) => String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());

  function blocks(profile) {
    try {
      return (profile?.availability || []).map((item) => {
        const monthly = item.pattern_type === "monthly_ordinal_weekday";
        return {
          day: titleCase(item.day_of_week), start: item.start_time, end: item.end_time,
          recurrence: {
            type: monthly ? "monthly" : "weekly",
            interval: Number(monthly ? item.month_interval || 1 : item.week_interval || 1),
            anchorDate: item.anchor_date || null,
            ordinal: titleCase(item.monthly_ordinal || "last")
          }
        };
      });
    } catch (error) {
      console.error("[DDD Player Start] Unable to map saved availability", error);
      return [];
    }
  }

  function hydrate(form, profile) {
    try {
      form.elements.display_name.value = profile.display_name || "";
      form.elements.postal_code.value = profile.postal_code || "";
      const radius = form.querySelector(`[name="radius"][value="${profile.travel_radius_miles}"]`);
      if (radius) radius.checked = true;
      const firstSystem = SYSTEM_LABELS[profile.systems?.[0]?.system_slug];
      if (firstSystem) {
        const radio = [...form.querySelectorAll('[name="player_system[]"]')].find((item) => item.value === firstSystem);
        if (radio) radio.checked = true;
      }
      const calendar = form.querySelector(".availability-builder")?.dddCalendar;
      if (!calendar?.loadBlocks) throw new Error("Availability calendar is not ready.");
      calendar.loadBlocks(blocks(profile));
      return true;
    } catch (error) {
      console.error("[DDD Player Start] Unable to hydrate saved Player profile", error);
      return false;
    }
  }

  function updatePayload(profile, raw, timezone) {
    try {
      const availability = window.DDDProductionOnboardingAdapters.availabilityWindows(raw, timezone);
      return {
        display_name: profile.display_name,
        bio: profile.bio || null,
        postal_code: String(raw.postal_code || profile.postal_code || "").trim(),
        travel_radius_miles: Number(raw.radius || profile.travel_radius_miles),
        preferred_format: profile.preferred_format,
        willing_to_learn_new_system: Boolean(profile.willing_to_learn_new_system),
        environment_preferences: profile.environment_preferences || [],
        accessibility_notes_private: profile.accessibility_notes_private || null,
        systems: (profile.systems || []).map((item) => ({
          system_slug: item.system_slug,
          years_playing: Number(item.years_playing || 0),
          comfort_level: item.comfort_level,
          experience_notes: item.experience_notes || null
        })),
        availability
      };
    } catch (error) {
      console.error("[DDD Player Start] Unable to prepare safe availability update", error);
      throw error;
    }
  }

  window.DDDPlayerStartProfile = Object.freeze({ hydrate, updatePayload });
})();