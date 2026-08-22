(() => {
  "use strict";

  const SYSTEM_LABELS = Object.freeze({
    "dnd-5e-2024": "D&D 5e (2024)",
    "dnd-5e-2014": "D&D 5e (2014)",
    "pathfinder-2e": "Pathfinder 2e"
  });
  const FORMAT_LABELS = Object.freeze({
    learn_to_play: "Learn-to-play",
    one_shot: "One-shot",
    short_campaign: "Short campaign",
    long_campaign: "Long campaign",
    organized_play: "Organized play"
  });
  const currentSignals = (items) => (items || []).filter((item) => ["active", "paused"].includes(item.status));

  function blocks(profile) {
    try {
      return (profile?.availability || []).map((item) => ({
        day: String(item.day_of_week || "").replace(/^./, (c) => c.toUpperCase()),
        start: item.start_time,
        end: item.end_time,
        recurrence: item.pattern_type === "monthly_ordinal_weekday"
          ? { type: "monthly", interval: Number(item.month_interval || 1), anchorDate: item.anchor_date || null, ordinal: String(item.monthly_ordinal || "last").replace(/^./, (c) => c.toUpperCase()) }
          : { type: "weekly", interval: Number(item.week_interval || 1), anchorDate: item.anchor_date || null }
      }));
    } catch (error) {
      console.error("[DDD DM Start] Unable to map saved availability", error);
      return [];
    }
  }

  function selectValue(control, value) {
    if (!control || value == null) return;
    const option = [...control.options].find((item) => item.value === value);
    if (option) control.value = value;
  }

  function hydrate(form, profile) {
    try {
      form.elements.display_name.value = profile.display_name || "";
      form.elements.postal_code.value = profile.postal_code || "";
      const radius = form.querySelector(`[name="radius"][value="${profile.travel_radius_miles}"]`);
      if (radius) radius.checked = true;

      const firstSystem = profile.systems?.[0];
      const systemLabel = SYSTEM_LABELS[firstSystem?.system_slug];
      if (systemLabel) {
        const radio = [...form.querySelectorAll('[name="gm_system[]"]')].find((item) => item.value === systemLabel);
        if (radio) radio.checked = true;
      }
      selectValue(form.elements["gm_format[]"], FORMAT_LABELS[firstSystem?.formats?.[0]]);
      selectValue(form.elements.style, profile.gm_style);

      const calendar = form.querySelector(".availability-builder")?.dddCalendar;
      if (!calendar?.loadBlocks) throw new Error("Availability calendar is not ready.");
      calendar.loadBlocks(blocks(profile));
      return true;
    } catch (error) {
      console.error("[DDD DM Start] Unable to hydrate saved DM profile", error);
      return false;
    }
  }

  function updatePayload(profile, raw, timezone) {
    try {
      return {
        display_name: profile.display_name,
        bio: profile.bio || null,
        postal_code: String(raw.postal_code || profile.postal_code || "").trim(),
        travel_radius_miles: Number(raw.radius || profile.travel_radius_miles),
        beginner_friendly: Boolean(profile.beginner_friendly),
        gm_style: profile.gm_style,
        systems: (profile.systems || []).map((item) => ({
          system_slug: item.system_slug,
          years_playing: Number(item.years_playing || 0),
          years_gming: Number(item.years_gming || 0),
          comfort_level: item.comfort_level,
          preferred_player_experience: item.preferred_player_experience || "any",
          formats: item.formats || [],
          experience_notes: item.experience_notes || null
        })),
        availability: window.DDDProductionOnboardingAdapters.availabilityWindows(raw, timezone)
      };
    } catch (error) {
      console.error("[DDD DM Start] Unable to prepare safe DM availability update", error);
      throw error;
    }
  }

  async function refreshAfterSignal(signals) {
    const refresh = window.DDDProductionMatching?.refreshMatches;
    if (typeof refresh !== "function") {
      return {
        signals,
        match: null,
        opportunities: [],
        refreshError: new Error("Immediate match refresh is unavailable."),
        refreshStage: "bridge"
      };
    }
    return { signals, ...(await refresh()) };
  }

  async function activateMatching(profile, raw) {
    try {
      const existing = currentSignals(await window.DDDProductionAPI.getGMSupplies());
      if (existing.length) return refreshAfterSignal(existing);

      const count = Number(raw.player_count);
      if (!Number.isSafeInteger(count) || count < 1) throw new Error("Player count must be a whole number of 1 or more.");
      const system = profile?.systems?.[0];
      const format = system?.formats?.[0];
      if (!system?.system_slug || !format) throw new Error("Saved DM game settings are incomplete.");

      const signal = await window.DDDProductionAPI.postGMSupply({
        system_slug: system.system_slug,
        availability: profile.availability || [],
        preferred_format: format,
        preferred_cadence: null,
        minimum_players: count,
        maximum_players: count,
        table_style: profile.gm_style || null
      });
      return refreshAfterSignal([signal]);
    } catch (error) {
      console.error("[DDD DM Start] Unable to reactivate DM matching", error);
      throw error;
    }
  }

  async function refreshSupplies(supplies, availability) {
    try {
      const current = currentSignals(supplies);
      const results = [];
      for (const supply of current) {
        results.push(await window.DDDProductionAPI.postGMSupply({
          system_slug: supply.system_slug,
          availability,
          preferred_format: supply.preferred_format,
          preferred_cadence: supply.preferred_cadence || null,
          minimum_players: Number(supply.minimum_players),
          maximum_players: Number(supply.maximum_players),
          table_style: supply.table_style || null
        }));
      }
      return { ...(await refreshAfterSignal(results)), supplies: results };
    } catch (error) {
      console.error("[DDD DM Start] Unable to refresh DM matching supplies", error);
      throw error;
    }
  }

  window.DDDDMStartProfile = Object.freeze({
    activateMatching,
    currentSupplies: currentSignals,
    hydrate,
    refreshSupplies,
    updatePayload
  });
})();
