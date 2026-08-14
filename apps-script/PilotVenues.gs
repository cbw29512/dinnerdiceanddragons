function saveVenueWindowRule_(venueWindowId, payload, now) {
  try {
    dddDeactivateBy_("AvailabilityRules", { owner_type:"venue_window", owner_id:venueWindowId }, now);
    const recurrence = String(payload.recurrence || "Weekly");
    let patternType = "weekly_interval";
    let weekInterval = "1";
    let monthInterval = "";
    if (recurrence.toLowerCase().includes("every other")) weekInterval = "2";
    if (recurrence.toLowerCase().includes("month")) {
      patternType = "monthly";
      weekInterval = "";
      monthInterval = "1";
    }
    if (recurrence.toLowerCase().includes("one-time") || recurrence.toLowerCase().includes("one time")) {
      patternType = "one_time";
      weekInterval = "";
    }
    dddAppend_("AvailabilityRules", {
      availability_id:dddId_("avl"),
      owner_type:"venue_window",
      owner_id:venueWindowId,
      day_of_week:payload.window_day || "",
      start_time:payload.window_start || "",
      end_time:payload.window_end || "",
      pattern_type:patternType,
      week_interval:weekInterval,
      anchor_date:"",
      monthly_ordinal:"",
      month_interval:monthInterval,
      active:true,
      created_at:now,
      updated_at:now
    });
  } catch (error) {
    console.error("[DDD] saveVenueWindowRule_ failed", error);
    throw error;
  }
}

function saveVenueProfile_(payload) {
  try {
    const now = dddNow_();
    const userId = payload.user_id || dddId_("usr");
    const venueId = payload.venue_id || dddId_("venue");
    const managerId = payload.venue_manager_id || dddId_("vmgr");
    const windowId = payload.venue_window_id || dddId_("vwin");

    dddUpsert_("Users", "user_id", userId, {
      user_id:userId,
      email:payload.email || "",
      display_name:payload.contact_name || payload.business_name || "Venue Manager",
      status:"active",
      created_at:now,
      updated_at:now
    });

    dddUpsert_("Venues", "venue_id", venueId, {
      venue_id:venueId,
      name:payload.business_name || "",
      venue_type:payload.venue_type || "public_venue",
      address:payload.address || "",
      city:payload.city || "",
      state:payload.state || "",
      postal_code:payload.postal_code || "",
      purchase_policy:payload.purchase_policy || "",
      active:true,
      created_at:now,
      updated_at:now
    });

    dddUpsert_("VenueManagers", "venue_manager_id", managerId, {
      venue_manager_id:managerId,
      user_id:userId,
      venue_id:venueId,
      role:"manager",
      active:true,
      created_at:now,
      updated_at:now
    });

    dddUpsert_("VenueWindows", "venue_window_id", windowId, {
      venue_window_id:windowId,
      venue_id:venueId,
      day_of_week:payload.window_day || "",
      start_time:payload.window_start || "",
      end_time:payload.window_end || "",
      table_count:payload.table_count || "1",
      max_people_per_table:payload.seats_per_table || "6",
      purchase_policy:payload.purchase_policy || "",
      approval_required:payload.approval_required ? true : false,
      active:true,
      created_at:now,
      updated_at:now
    });
    saveVenueWindowRule_(windowId, payload, now);

    return { ok:true, user_id:userId, venue_id:venueId, venue_manager_id:managerId, venue_window_id:windowId };
  } catch (error) {
    console.error("[DDD] saveVenueProfile_ failed", error);
    throw error;
  }
}

function venueManagerOwns_(venueManagerId, venueId) {
  try {
    if (!venueManagerId || !venueId) return false;
    return dddRows_("VenueManagers").some((manager) => String(manager.venue_manager_id) === String(venueManagerId) && String(manager.venue_id) === String(venueId) && pilotActive_(manager.active));
  } catch (error) {
    console.error("[DDD] venueManagerOwns_ failed", error);
    return false;
  }
}
