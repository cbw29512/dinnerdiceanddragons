(() => {
  "use strict";

  const titleCase = (value) => String(value || "").replace(/\b\w/g, (letter) => letter.toUpperCase());

  function blocks(windows) {
    try {
      return (windows || []).filter((item) => item.active !== false).map((item) => {
        const rule = item.availability || {};
        const monthly = rule.pattern_type === "monthly_ordinal_weekday";
        return {
          day: titleCase(rule.day_of_week),
          start: rule.start_time,
          end: rule.end_time,
          recurrence: {
            type: monthly ? "monthly" : "weekly",
            interval: Number(monthly ? rule.month_interval || 1 : rule.week_interval || 1),
            anchorDate: rule.anchor_date || null,
            ordinal: titleCase(rule.monthly_ordinal || "last")
          }
        };
      });
    } catch (error) {
      console.error("[DDD Venue Edit] Unable to map Venue windows", error);
      return [];
    }
  }

  function hydrate(form, venue, windows) {
    try {
      form.elements.business_name.value = venue.name || "";
      form.elements.address.value = venue.address_line1 || "";
      form.elements.city.value = venue.city || "";
      form.elements.state.value = venue.state_region || "";
      form.elements.postal_code.value = venue.postal_code || "";
      for (const name of ["business_name", "address", "city", "state", "postal_code"]) {
        const field = form.elements[name];
        if (field) field.readOnly = true;
      }
      const active = (windows || []).filter((item) => item.active !== false);
      const first = active[0];
      if (first) {
        form.elements.table_count.value = String(first.table_count || 1);
        form.elements.seats_per_table.value = String(first.max_people_per_table || 6);
        if (first.purchase_policy) form.elements.purchase_policy.value = first.purchase_policy;
        form.elements.accessibility.value = first.environment_notes || "";
      }
      const calendar = form.querySelector(".availability-builder")?.dddCalendar;
      if (!calendar?.loadBlocks) throw new Error("Venue availability calendar is not ready.");
      calendar.loadBlocks(blocks(active));
      return true;
    } catch (error) {
      console.error("[DDD Venue Edit] Unable to load Venue calendar", error);
      return false;
    }
  }

  function replacementPayload(raw, timezone) {
    try {
      const mapped = window.DDDVenueWindowPayloads.fromRaw(raw, {
        table_count: raw.table_count,
        seats_per_table: raw.seats_per_table,
        purchase_policy: raw.purchase_policy,
        age_policy: raw.age_policy,
        combined_environment_notes: raw.accessibility
      }, timezone);
      const first = mapped[0];
      if (!first) throw new Error("Choose at least one Venue availability time.");
      return {
        availability: mapped.map((item) => item.availability),
        table_count: first.table_count,
        max_people_per_table: first.max_people_per_table,
        purchase_policy: first.purchase_policy,
        environment_notes: first.environment_notes
      };
    } catch (error) {
      console.error("[DDD Venue Edit] Unable to prepare Venue calendar update", error);
      throw error;
    }
  }

  function renderManagedList(root, venues) {
    try {
      root.replaceChildren();
      for (const venue of venues || []) {
        const card = document.createElement("div");
        card.className = "review-row managed-venue-row";
        const copy = document.createElement("span");
        copy.textContent = `${venue.name} · ${venue.city}, ${venue.state_region} · ${venue.verified ? "Verified" : "Verification pending"}`;
        const link = document.createElement("a");
        link.className = "button secondary";
        link.href = `host.html?edit=${encodeURIComponent(venue.id)}`;
        link.textContent = "Change Calendar";
        card.append(copy, link);
        root.append(card);
      }
    } catch (error) {
      console.error("[DDD Venue Edit] Unable to render managed Venues", error);
      throw error;
    }
  }

  window.DDDHostManagedVenues = Object.freeze({ blocks, hydrate, replacementPayload, renderManagedList });
})();