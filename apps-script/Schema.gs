const DDD_SCHEMA = {
  Users: ["user_id","email","display_name","status","created_at","updated_at"],
  Players: ["player_id","user_id","postal_code","travel_radius_miles","availability_summary","preferred_format","willing_to_learn_new_system","created_at","updated_at"],
  PlayerSystems: ["player_system_id","player_id","system","edition","years_playing","comfort_level","experience_notes","created_at","updated_at"],
  GMs: ["gm_id","user_id","postal_code","travel_radius_miles","beginner_friendly","created_at","updated_at"],
  GMSystems: ["gm_system_id","gm_id","system","edition","years_playing","years_gming","comfort_level","experience_notes","created_at","updated_at"],
  GMAvailability: ["availability_id","gm_id","day_of_week","start_time","end_time","recurrence","active","created_at","updated_at"],
  AvailabilityRules: ["availability_id","owner_type","owner_id","day_of_week","start_time","end_time","pattern_type","week_interval","anchor_date","monthly_ordinal","month_interval","active","created_at","updated_at"],
  PlayerDemandSignals: ["demand_id","signal_key","player_id","system","preferred_format","preferred_cadence","status","created_at","updated_at"],
  GMSupplySignals: ["supply_id","signal_key","gm_id","system","preferred_format","preferred_cadence","minimum_players","maximum_players","table_style","status","created_at","updated_at"],
  Venues: ["venue_id","name","venue_type","address","city","state","postal_code","verified","purchase_policy","active","created_at","updated_at"],
  VenueManagers: ["venue_manager_id","user_id","venue_id","role","active","created_at","updated_at"],
  VenueWindows: ["venue_window_id","venue_id","day_of_week","start_time","end_time","table_count","max_people_per_table","purchase_policy","approval_required","active","created_at","updated_at"],
  TableMatches: ["table_match_id","gm_id","venue_window_id","system","proposed_start","proposed_end","minimum_players","maximum_players","compatible_player_count","usable_player_count","fit_score","status","created_at","updated_at"],
  MatchExplanations: ["explanation_id","table_match_id","criterion","result","summary","weight","created_at"],
  VenueBookingRequests: ["booking_id","venue_window_id","gm_id","game_series_id","event_id","requested_start","requested_end","tables_requested","expected_guests","status","venue_message","gm_message","created_at","updated_at"],
  GameSeries: ["series_id","title","gm_id","system","venue_id","cadence","expected_sessions","starts_on","ends_on","active","created_at","updated_at"],
  Games: ["game_id","series_id","title","description","gm_id","system","venue_id","status","starts_at","ends_at","min_players","max_players","minimum_age","beginner_friendly","join_mode","created_at","updated_at"],
  Registrations: ["registration_id","game_id","player_id","status","requested_at","responded_at","cancelled_at"],
  Messages: ["message_id","game_id","sender_user_id","channel_type","recipient_user_id","venue_id","category","body","created_at","read_at","moderation_status"],
  CalendarEvents: ["calendar_sync_id","game_id","provider","external_event_id","status","last_synced_at","sync_error"],
  Attendance: ["attendance_id","game_id","player_id","registration_id","status","recorded_by_user_id","recorded_at","notes"],
  Feedback: ["feedback_id","game_id","author_user_id","subject_type","subject_id","signal_name","signal_value","private_comment","created_at"],
  VenueMetrics: ["metric_id","game_id","venue_id","expected_guests","actual_guests","reserved_minutes","tables_used","venue_reported_sales","created_at"],
  Reports: ["report_id","reporter_user_id","game_id","subject_user_id","venue_id","category","description","severity","status","created_at","updated_at"]
};

function setupDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    Object.entries(DDD_SCHEMA).forEach(([name, headers]) => {
      let sheet = spreadsheet.getSheetByName(name);
      if (!sheet) sheet = spreadsheet.insertSheet(name);
      if (sheet.getLastRow() === 0) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
      }
    });
    return { ok:true, sheets:Object.keys(DDD_SCHEMA).length };
  } catch (error) {
    console.error("[DDD] setupDatabase failed", error);
    throw error;
  }
}
