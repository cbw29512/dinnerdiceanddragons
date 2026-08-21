(() => {
  "use strict";

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

  function hydrate(form, profile) {
    try {
      form.elements.display_name.value = profile.display_name || "";
      form.elements.postal_code.value = profile.postal_code || "";
      const radius = form.querySelector(`[name="radius"][value="${profile.travel_radius_miles}"]`);
      if (radius) radius.checked = true;
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

  async function refreshSupplies(supplies, availability) {
    try {
      const current = (supplies || []).filter((item) => ["active", "paused"].includes(item.status));
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
      const match = await window.DDDProductionAPI.findMyTable(60);
      const opportunities = await window.DDDProductionAPI.getMatchingOpportunities();
      return { supplies: results, match, opportunities };
    } catch (error) {
      console.error("[DDD DM Start] Unable to refresh DM matching supplies", error);
      throw error;
    }
  }

  window.DDDDMStartProfile = Object.freeze({ hydrate, refreshSupplies, updatePayload });
})();