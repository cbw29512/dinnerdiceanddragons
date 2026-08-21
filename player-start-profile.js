(() => {
  "use strict";

  const SYSTEM_LABELS = Object.freeze({
    "dnd-5e-2024": "D&D 5e (2024)",
    "dnd-5e-2014": "D&D 5e (2014)",
    "pathfinder-2e": "Pathfinder 2e",
    "call-of-cthulhu": "Call of Cthulhu",
    "cyberpunk-red": "Cyberpunk RED",
    shadowrun: "Shadowrun",
    "other-rpg": "Other"
  });
  const COMFORT_LABELS = Object.freeze({
    new: "New", learning: "Learning", comfortable: "Comfortable", very_experienced: "Very Experienced"
  });
  const FORMAT_LABELS = Object.freeze({
    any: "Any format", learn_to_play: "Learn-to-play", one_shot: "One-shot",
    short_campaign: "Short campaign", long_campaign: "Long campaign", organized_play: "Organized play"
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

  function preserve(profile, raw) {
    try {
      const systems = profile?.systems || [];
      return {
        ...raw,
        player_system: systems.map((item) => SYSTEM_LABELS[item.system_slug] || "Other"),
        player_years: systems.map((item) => String(item.years_playing ?? 0)),
        player_comfort: systems.map((item) => COMFORT_LABELS[item.comfort_level] || "New"),
        player_system_notes: systems.map((item) => item.experience_notes || ""),
        preferred_format: FORMAT_LABELS[profile.preferred_format] || "Any format",
        willing_to_learn: profile.willing_to_learn_new_system === false ? "No" : "Yes"
      };
    } catch (error) {
      console.error("[DDD Player Start] Unable to preserve saved Player systems", error);
      throw error;
    }
  }

  window.DDDPlayerStartProfile = Object.freeze({ hydrate, preserve });
})();