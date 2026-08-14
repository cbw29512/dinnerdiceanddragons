function setupSharedPilot() {
  try {
    const database = setupDatabase();
    const venues = seedPilotVenues();
    const writeGate = disablePilotWrites();
    return { ok:true, database, venues, writes_enabled:writeGate.writes_enabled };
  } catch (error) {
    console.error("[DDD] setupSharedPilot failed", error);
    throw error;
  }
}

function seedPilotVenues() {
  try {
    const now = dddNow_();
    const venues = [
      {
        venue_id:"seminar-brewing",
        name:"Seminar Brewing",
        venue_type:"brewery",
        address:"",
        city:"Florence",
        state:"SC",
        postal_code:"29501",
        verified:false,
        purchase_policy:"Support the venue with food or drink purchases.",
        active:true
      },
      {
        venue_id:"pee-dee-tabletop-cafe",
        name:"Pee Dee Tabletop Café",
        venue_type:"cafe",
        address:"",
        city:"Florence",
        state:"SC",
        postal_code:"29501",
        verified:false,
        purchase_policy:"One purchase per guest requested.",
        active:true
      },
      {
        venue_id:"florence-community-room",
        name:"Florence Community Room",
        venue_type:"community_space",
        address:"",
        city:"Florence",
        state:"SC",
        postal_code:"29501",
        verified:false,
        purchase_policy:"No purchase requirement in prototype data.",
        active:true
      }
    ];

    venues.forEach((venue) => dddUpsert_("Venues", "venue_id", venue.venue_id, { ...venue, created_at:now, updated_at:now }));

    const windows = [
      ["seminar-tue","seminar-brewing","Tuesday","16:00","22:00",2,8,true],
      ["seminar-sat","seminar-brewing","Saturday","12:00","22:00",2,8,true],
      ["pee-dee-thu","pee-dee-tabletop-cafe","Thursday","17:00","23:00",4,6,false],
      ["pee-dee-sat","pee-dee-tabletop-cafe","Saturday","11:00","23:00",4,6,false],
      ["community-wed","florence-community-room","Wednesday","17:00","21:00",3,8,true],
      ["community-sun","florence-community-room","Sunday","13:00","18:00",3,8,true]
    ];

    windows.forEach((windowRow) => {
      const venue = venues.find((item) => item.venue_id === windowRow[1]);
      dddUpsert_("VenueWindows", "venue_window_id", windowRow[0], {
        venue_window_id:windowRow[0],
        venue_id:windowRow[1],
        day_of_week:windowRow[2],
        start_time:windowRow[3],
        end_time:windowRow[4],
        table_count:windowRow[5],
        max_people_per_table:windowRow[6],
        purchase_policy:venue ? venue.purchase_policy : "",
        approval_required:windowRow[7],
        active:true,
        created_at:now,
        updated_at:now
      });
    });

    return { ok:true, venue_count:venues.length, window_count:windows.length, note:"Seeded sample pilot venues are not automatically verified." };
  } catch (error) {
    console.error("[DDD] seedPilotVenues failed", error);
    throw error;
  }
}
