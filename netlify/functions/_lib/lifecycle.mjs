import { gameSystemById } from "./catalog.mjs";
import { managedVenue, requireRole, userRoles } from "./auth.mjs";
import {
  SupabaseRestError,
  eq,
  insertRows,
  selectMany,
  selectOne,
  updateRows
} from "./supabase-rest.mjs";
import { asArray, asBoolean, asInteger, asString, requireUuid } from "./http.mjs";

const EVENT_TYPES = new Set(["one_shot", "campaign_session", "new_campaign", "learn_to_play", "organized_play"]);
const JOIN_MODES = new Set(["request_to_join", "instant_join"]);
const REG_ACTIVE = new Set(["requested", "confirmed", "waitlisted"]);
const REG_CLOSED = new Set(["declined", "removed"]);
const TERMINAL_TABLE = new Set(["in_progress", "completed", "cancelled", "archived"]);
const MESSAGE_CHANNELS = new Set(["table_announcement", "table_discussion", "gm_venue", "player_gm", "player_venue_question"]);
const VENUE_CATEGORIES = new Set(["accessibility", "food_allergies", "parking", "seating", "venue_policy", "other"]);

function optionalText(value, name, max = 4000) {
  if (value === undefined || value === null || value === "") return null;
  return asString(value, name, { min: 0, max, nullable: true });
}

function enumValue(value, name, allowed) {
  const text = asString(value, name, { min: 1, max: 80 });
  if (!allowed.has(text)) throw new SupabaseRestError(`${name} is invalid.`, 422);
  return text;
}

function eventSlug(title, matchId) {
  const base = String(title || "")
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150) || "table";
  return `${base}-${String(matchId).slice(0, 8)}`;
}

function localDate(iso, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(iso));
  const map = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function eventParents(match) {
  const supply = await selectOne("gm_supply_signals", { id: eq(match.gm_supply_signal_id) });
  const gm = supply ? await selectOne("gm_profiles", { id: eq(supply.gm_profile_id) }) : null;
  const window = await selectOne("venue_table_windows", { id: eq(match.venue_table_window_id) });
  if (!supply || !gm || !window) throw new SupabaseRestError("Table Match parent state is no longer available.", 409);
  return { supply, gm, window };
}

async function bookingCapacityAvailable(booking, window) {
  const approved = await selectMany("venue_booking_requests", {
    venue_table_window_id: eq(window.id),
    status: eq("approved"),
    limit: 200
  });
  const start = new Date(booking.requested_start);
  const end = new Date(booking.requested_end);
  const simultaneous = approved.filter((item) => item.id !== booking.id && new Date(item.requested_start) < end && new Date(item.requested_end) > start);
  const used = simultaneous.reduce((sum, item) => sum + Number(item.tables_requested || 1), 0);
  return used + Number(booking.tables_requested || 1) <= Number(window.table_count);
}

function validateExpectations(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  return {
    tone: optionalText(value.tone, "tone", 200),
    age_environment: optionalText(value.age_environment, "age_environment", 120),
    play_style: asString(value.play_style, "play_style", { min: 1, max: 2000 }),
    boundaries: asString(value.boundaries, "boundaries", { min: 1, max: 4000 }),
    pvp_policy: optionalText(value.pvp_policy, "pvp_policy", 300),
    homebrew_policy: optionalText(value.homebrew_policy, "homebrew_policy", 4000),
    character_death_policy: optionalText(value.character_death_policy, "character_death_policy", 500),
    mature_content_notes: optionalText(value.mature_content_notes, "mature_content_notes", 4000),
    alcohol_policy: optionalText(value.alcohol_policy, "alcohol_policy", 500),
    new_players_welcome: value.new_players_welcome === undefined ? true : asBoolean(value.new_players_welcome, "new_players_welcome"),
    break_policy: optionalText(value.break_policy, "break_policy", 500),
    safety_framework: optionalText(value.safety_framework, "safety_framework", 1000),
    environment_notes: optionalText(value.environment_notes, "environment_notes", 4000),
    accessibility_notes: optionalText(value.accessibility_notes, "accessibility_notes", 4000),
    other_notes: optionalText(value.other_notes, "other_notes", 4000)
  };
}

export async function formTableMatch(user, matchId, payload) {
  await requireRole(user.id, "gm");
  const safeMatchId = requireUuid(matchId, "table_match_id");
  const match = await selectOne("table_matches", { id: eq(safeMatchId) });
  if (!match) throw new SupabaseRestError("Opportunity not found.", 404);
  const parents = await eventParents(match);
  if (parents.gm.user_id !== user.id) throw new SupabaseRestError("Not permitted for this opportunity.", 403);

  const existingEvent = await selectOne("events", { table_match_id: eq(match.id) });
  if (existingEvent) {
    const booking = await selectOne("venue_booking_requests", { event_id: eq(existingEvent.id) });
    return {
      table_match_id: match.id,
      game_table_id: existingEvent.game_table_id || null,
      event_id: existingEvent.id,
      game_series_id: existingEvent.game_series_id || null,
      venue_booking_request_id: booking?.id,
      event_status: existingEvent.status,
      booking_status: booking?.status,
      created: false
    };
  }
  if (match.status !== "potential") throw new SupabaseRestError("Table Match is no longer available for formation.", 409);

  const title = asString(payload?.title, "title", { min: 1, max: 200 });
  const description = asString(payload?.description, "description", { min: 1, max: 8000 });
  const eventType = enumValue(payload?.event_type ?? "one_shot", "event_type", EVENT_TYPES);
  const joinMode = enumValue(payload?.join_mode ?? "request_to_join", "join_mode", JOIN_MODES);
  const minimumAge = payload?.minimum_age == null ? null : asInteger(payload.minimum_age, "minimum_age", { min: 0, max: 125 });
  const beginnerFriendly = payload?.beginner_friendly === undefined ? true : asBoolean(payload.beginner_friendly, "beginner_friendly");
  const expectedSessions = asInteger(payload?.expected_sessions ?? 1, "expected_sessions", { min: 1, max: 52 });
  const expectations = validateExpectations(payload?.expectations);

  let gameTable = await selectOne("game_tables", { source_table_match_id: eq(match.id) });
  if (!gameTable) throw new SupabaseRestError("Viable Table has not been materialized yet. Run Find My Table again.", 409);
  const tableRows = await updateRows("game_tables", { id: eq(gameTable.id) }, {
    title,
    join_policy: joinMode === "instant_join" ? "open" : "request",
    minimum_age: minimumAge,
    updated_at: new Date().toISOString()
  });
  gameTable = tableRows[0] || gameTable;

  let seriesId = null;
  if (expectedSessions > 1) {
    seriesId = crypto.randomUUID();
    await insertRows("game_series", [{
      id: seriesId,
      table_match_id: match.id,
      title,
      gm_profile_id: parents.gm.id,
      game_system_id: match.game_system_id,
      venue_id: parents.window.venue_id,
      recurring_rule_id: null,
      expected_sessions: expectedSessions,
      starts_on: localDate(match.proposed_start, match.timezone),
      ends_on: null,
      active: true
    }], { returning: false });
  }

  const eventId = crypto.randomUUID();
  const eventStatus = parents.window.approval_required ? "venue_requested" : "forming";
  await insertRows("events", [{
    id: eventId,
    game_series_id: seriesId,
    game_table_id: gameTable.id,
    table_match_id: match.id,
    slug: eventSlug(title, match.id),
    title,
    description,
    gm_profile_id: parents.gm.id,
    game_system_id: match.game_system_id,
    venue_id: parents.window.venue_id,
    event_type: eventType,
    join_mode: joinMode,
    status: eventStatus,
    starts_at: match.proposed_start,
    ends_at: match.proposed_end,
    min_players: Number(match.minimum_players),
    max_players: Number(match.maximum_players),
    minimum_age: minimumAge,
    beginner_friendly: beginnerFriendly,
    updated_at: new Date().toISOString()
  }], { returning: false });
  await insertRows("table_expectations", [{ id: crypto.randomUUID(), event_id: eventId, ...expectations }], { returning: false });

  const bookingId = crypto.randomUUID();
  const booking = {
    id: bookingId,
    venue_table_window_id: parents.window.id,
    gm_profile_id: parents.gm.id,
    table_match_id: match.id,
    game_series_id: seriesId,
    event_id: eventId,
    requested_start: match.proposed_start,
    requested_end: match.proposed_end,
    tables_requested: 1,
    expected_guests: 1,
    status: parents.window.approval_required ? "requested" : "approved",
    venue_message: null,
    gm_message: optionalText(payload?.gm_message, "gm_message"),
    updated_at: new Date().toISOString()
  };
  if (booking.status === "approved" && !(await bookingCapacityAvailable(booking, parents.window))) {
    throw new SupabaseRestError("Venue no longer has table capacity for that occurrence.", 409);
  }
  await insertRows("venue_booking_requests", [booking], { returning: false });
  await updateRows("table_matches", { id: eq(match.id) }, { status: "converted", updated_at: new Date().toISOString() }, { returning: false });

  return {
    table_match_id: match.id,
    game_table_id: gameTable.id,
    event_id: eventId,
    game_series_id: seriesId,
    venue_booking_request_id: bookingId,
    event_status: eventStatus,
    booking_status: booking.status,
    created: true
  };
}

async function confirmedCount(eventId) {
  const rows = await selectMany("registrations", { event_id: eq(eventId), status: eq("confirmed"), limit: 100 });
  return rows.length;
}

async function registrationResponse(registration) {
  return {
    id: registration.id,
    event_id: registration.event_id,
    status: registration.status,
    expectations_acknowledged_at: registration.expectations_acknowledged_at || null,
    requested_at: registration.requested_at,
    responded_at: registration.responded_at || null,
    cancelled_at: registration.cancelled_at || null
  };
}

async function eventViewerRoles(user, event, { hub = false } = {}) {
  const durable = await userRoles(user.id);
  const roles = [];
  const gm = await selectOne("gm_profiles", { id: eq(event.gm_profile_id) });
  if (durable.includes("gm") && gm?.user_id === user.id) roles.push("gm");

  if (durable.includes("venue_manager")) {
    const manager = await selectOne("venue_managers", {
      venue_id: eq(event.venue_id),
      user_id: eq(user.id),
      verified_at: "not.is.null"
    });
    if (manager) roles.push("venue_manager");
  }

  if (durable.includes("player")) {
    const profile = await selectOne("player_profiles", { user_id: eq(user.id) });
    if (profile) {
      const registration = await selectOne("registrations", { event_id: eq(event.id), player_profile_id: eq(profile.id) });
      if (hub ? registration?.status === "confirmed" : (registration || await playerIsMatched(event, profile.id))) roles.push("player");
    }
  }
  return [...new Set(roles)];
}

async function playerIsMatched(event, profileId) {
  if (event.game_table_id) {
    const membership = await selectOne("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) });
    if (membership && !["declined", "removed", "left"].includes(membership.status)) return true;
  }
  if (!event.table_match_id) return false;
  const demands = await selectMany("player_demand_signals", { player_profile_id: eq(profileId), limit: 100 });
  if (!demands.length) return false;
  const eligible = await selectMany("table_match_players", { table_match_id: eq(event.table_match_id), limit: 100 });
  const ids = new Set(demands.map((item) => item.id));
  return eligible.some((item) => ids.has(item.player_demand_signal_id) && ["eligible", "notified", "interested", "committed"].includes(item.status));
}

async function syncMembership(event, profileId, confirmed) {
  if (!event.game_table_id) return;
  const membership = await selectOne("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) });
  if (confirmed) {
    if (membership) {
      if (!["left", "declined"].includes(membership.status)) {
        await updateRows("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) }, {
          status: "confirmed", responded_at: new Date().toISOString(), ended_at: null
        }, { returning: false });
      }
    } else {
      await insertRows("game_table_players", [{
        game_table_id: event.game_table_id,
        player_profile_id: profileId,
        source_player_demand_signal_id: null,
        status: "confirmed",
        requested_at: new Date().toISOString(),
        responded_at: new Date().toISOString()
      }], { returning: false });
    }
  } else if (membership && ["requested", "invited", "confirmed"].includes(membership.status)) {
    await updateRows("game_table_players", { game_table_id: eq(event.game_table_id), player_profile_id: eq(profileId) }, {
      status: "removed", ended_at: new Date().toISOString()
    }, { returning: false });
  }
}

async function synchronizeEvent(event) {
  const booking = await selectOne("venue_booking_requests", { event_id: eq(event.id) });
  if (!booking) throw new SupabaseRestError("Event is missing Venue booking state.", 409);
  const confirmed = await confirmedCount(event.id);
  await updateRows("venue_booking_requests", { id: eq(booking.id) }, { expected_guests: 1 + confirmed, updated_at: new Date().toISOString() }, { returning: false });
  let status = event.status;
  if (status !== "completed") {
    if (["declined", "cancelled"].includes(booking.status)) status = "cancelled";
    else if (booking.status !== "approved") status = "venue_requested";
    else if (confirmed >= Number(event.max_players)) status = "full";
    else if (confirmed >= Number(event.min_players)) status = "confirmed";
    else status = "forming";
  }
  if (status !== event.status) await updateRows("events", { id: eq(event.id) }, { status, updated_at: new Date().toISOString() }, { returning: false });
  if (event.game_table_id) {
    const table = await selectOne("game_tables", { id: eq(event.game_table_id) });
    if (table && !TERMINAL_TABLE.has(table.lifecycle_status)) {
      const tableStatus = ["confirmed", "full"].includes(status) ? "confirmed" : "forming";
      if (tableStatus !== table.lifecycle_status) await updateRows("game_tables", { id: eq(table.id) }, { lifecycle_status: tableStatus, updated_at: new Date().toISOString() }, { returning: false });
    }
  }
  return { confirmed, status, booking: { ...booking, expected_guests: 1 + confirmed } };
}

export async function getEvent(user, eventId, { hub = false } = {}) {
  const event = await selectOne("events", { id: eq(requireUuid(eventId, "event_id")) });
  if (!event) throw new SupabaseRestError(hub ? "Game Hub was not found." : "Event not found.", 404);
  const roles = await eventViewerRoles(user, event, { hub });
  if (!roles.length) throw new SupabaseRestError(hub ? "Game Hub was not found." : "Event not found.", 404);
  const state = await synchronizeEvent(event);
  event.status = state.status;
  const [system, venue, expectations] = await Promise.all([
    gameSystemById(event.game_system_id),
    selectOne("venues", { id: eq(event.venue_id) }),
    selectOne("table_expectations", { event_id: eq(event.id) })
  ]);
  const profile = roles.includes("player") ? await selectOne("player_profiles", { user_id: eq(user.id) }) : null;
  const registration = profile ? await selectOne("registrations", { event_id: eq(event.id), player_profile_id: eq(profile.id) }) : null;
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description,
    status: event.status,
    event_type: event.event_type,
    join_mode: event.join_mode,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
    min_players: Number(event.min_players),
    max_players: Number(event.max_players),
    confirmed_players: state.confirmed,
    minimum_age: event.minimum_age == null ? null : Number(event.minimum_age),
    beginner_friendly: Boolean(event.beginner_friendly),
    system_name: system?.name || "Tabletop RPG",
    system_edition: system?.edition || null,
    venue_name: venue?.name || "Venue",
    venue_city: venue?.city || "",
    venue_state_region: venue?.state_region || "",
    viewer_roles: roles,
    booking: {
      id: state.booking.id,
      status: state.booking.status,
      expected_guests: Number(state.booking.expected_guests),
      requested_start: state.booking.requested_start,
      requested_end: state.booking.requested_end
    },
    expectations: expectations ? Object.fromEntries(Object.entries(expectations).filter(([key]) => !["id", "event_id"].includes(key))) : null,
    your_registration: registration ? await registrationResponse(registration) : null
  };
}

export async function requestRegistration(user, eventId, acknowledged) {
  await requireRole(user.id, "player");
  if (acknowledged !== true) throw new SupabaseRestError("Table expectations must be acknowledged.", 422);
  const event = await selectOne("events", { id: eq(requireUuid(eventId, "event_id")) });
  if (!event) throw new SupabaseRestError("Event not found.", 404);
  if (["cancelled", "completed"].includes(event.status)) throw new SupabaseRestError("Event is not accepting registrations.", 409);
  const profile = await selectOne("player_profiles", { user_id: eq(user.id) });
  if (!profile || !(await playerIsMatched(event, profile.id))) throw new SupabaseRestError("This Player is not eligible for the matched table.", 403);
  let registration = await selectOne("registrations", { event_id: eq(event.id), player_profile_id: eq(profile.id) });
  if (registration && REG_ACTIVE.has(registration.status)) return registrationResponse(registration);
  if (registration && REG_CLOSED.has(registration.status)) throw new SupabaseRestError("Registration cannot be reopened after a GM decision.", 409);
  const confirmed = await confirmedCount(event.id);
  const status = confirmed >= Number(event.max_players) ? "waitlisted" : event.join_mode === "instant_join" ? "confirmed" : "requested";
  const now = new Date().toISOString();
  if (!registration) {
    const rows = await insertRows("registrations", [{
      id: crypto.randomUUID(), event_id: event.id, player_profile_id: profile.id,
      status, expectations_acknowledged_at: now, requested_at: now,
      responded_at: status === "confirmed" ? now : null, cancelled_at: null
    }]);
    registration = rows[0];
  } else {
    const rows = await updateRows("registrations", { id: eq(registration.id) }, {
      status, expectations_acknowledged_at: now, requested_at: now,
      responded_at: status === "confirmed" ? now : null, cancelled_at: null
    });
    registration = rows[0] || registration;
  }
  if (status === "confirmed") await syncMembership(event, profile.id, true);
  await synchronizeEvent(event);
  return registrationResponse(registration);
}

async function promoteWaitlist(event) {
  const confirmed = await confirmedCount(event.id);
  if (confirmed >= Number(event.max_players)) return;
  const waiting = await selectMany("registrations", { event_id: eq(event.id), status: eq("waitlisted"), order: "requested_at.asc,id.asc", limit: 1 });
  const next = waiting[0];
  if (!next || !(await playerIsMatched(event, next.player_profile_id))) return;
  await updateRows("registrations", { id: eq(next.id) }, { status: "confirmed", responded_at: new Date().toISOString() }, { returning: false });
  await syncMembership(event, next.player_profile_id, true);
}

export async function cancelMyRegistration(user, eventId) {
  await requireRole(user.id, "player");
  const event = await selectOne("events", { id: eq(requireUuid(eventId, "event_id")) });
  const profile = event ? await selectOne("player_profiles", { user_id: eq(user.id) }) : null;
  const registration = profile ? await selectOne("registrations", { event_id: eq(event.id), player_profile_id: eq(profile.id) }) : null;
  if (!event || !registration) throw new SupabaseRestError("Registration was not found.", 404);
  if (registration.status === "cancelled") return registrationResponse(registration);
  if (REG_CLOSED.has(registration.status)) throw new SupabaseRestError("Registration is already closed.", 409);
  const released = registration.status === "confirmed";
  const rows = await updateRows("registrations", { id: eq(registration.id) }, { status: "cancelled", cancelled_at: new Date().toISOString() });
  if (released) {
    await syncMembership(event, profile.id, false);
    await promoteWaitlist(event);
  }
  await synchronizeEvent(event);
  return registrationResponse(rows[0] || registration);
}

export async function decideRegistration(user, eventId, registrationId, action) {
  await requireRole(user.id, "gm");
  const event = await selectOne("events", { id: eq(requireUuid(eventId, "event_id")) });
  const gm = event ? await selectOne("gm_profiles", { id: eq(event.gm_profile_id), user_id: eq(user.id) }) : null;
  if (!event || !gm) throw new SupabaseRestError("Event not found.", 404);
  let registration = await selectOne("registrations", { id: eq(requireUuid(registrationId, "registration_id")), event_id: eq(event.id) });
  if (!registration) throw new SupabaseRestError("Registration was not found.", 404);
  const prior = registration.status;
  const now = new Date().toISOString();
  if (action === "confirm") {
    if (registration.status === "confirmed") return registrationResponse(registration);
    if (["cancelled", "declined", "removed"].includes(registration.status)) throw new SupabaseRestError("Closed registration cannot be confirmed.", 409);
    if (!(await playerIsMatched(event, registration.player_profile_id))) throw new SupabaseRestError("Player is no longer eligible for this matched table.", 409);
    if (await confirmedCount(event.id) >= Number(event.max_players)) throw new SupabaseRestError("No confirmed Player seat remains.", 409);
    const rows = await updateRows("registrations", { id: eq(registration.id) }, { status: "confirmed", responded_at: now });
    registration = rows[0] || registration;
    await syncMembership(event, registration.player_profile_id, true);
  } else if (action === "decline" || action === "remove") {
    const target = action === "decline" ? "declined" : "removed";
    if (registration.status === target) return registrationResponse(registration);
    if (registration.status === "cancelled") throw new SupabaseRestError("Cancelled registration is already closed.", 409);
    const rows = await updateRows("registrations", { id: eq(registration.id) }, { status: target, responded_at: now });
    registration = rows[0] || registration;
    if (prior === "confirmed") {
      await syncMembership(event, registration.player_profile_id, false);
      await promoteWaitlist(event);
    }
  } else {
    throw new SupabaseRestError("Unsupported GM registration action.", 409);
  }
  await synchronizeEvent(event);
  return registrationResponse(registration);
}

export async function decideVenueBooking(user, bookingId, action, message = null) {
  await requireRole(user.id, "venue_manager");
  let booking = await selectOne("venue_booking_requests", { id: eq(requireUuid(bookingId, "booking_id")) });
  const event = booking?.event_id ? await selectOne("events", { id: eq(booking.event_id) }) : null;
  if (!booking || !event) throw new SupabaseRestError("Venue booking was not found.", 404);
  await managedVenue(user.id, event.venue_id, { verified: true });
  const window = await selectOne("venue_table_windows", { id: eq(booking.venue_table_window_id), active: "is.true" });
  if (!window) throw new SupabaseRestError("Venue table window is no longer available.", 409);
  const current = booking.status;
  let status;
  if (action === "approve") {
    if (current === "approved") return venueBookingResponse(booking);
    if (!["requested", "question"].includes(current)) throw new SupabaseRestError("Venue booking cannot be approved from its current state.", 409);
    if (Number(event.max_players) + 1 > Number(window.max_people_per_table)) throw new SupabaseRestError("Venue table capacity no longer supports the Event headcount.", 409);
    if (!(await bookingCapacityAvailable(booking, window))) throw new SupabaseRestError("Venue table capacity is already committed for that time.", 409);
    status = "approved";
  } else if (action === "question") {
    if (!["requested", "question"].includes(current)) throw new SupabaseRestError("Venue booking cannot be questioned from its current state.", 409);
    status = "question";
  } else if (action === "decline") {
    if (current === "declined") return venueBookingResponse(booking);
    if (!["requested", "question"].includes(current)) throw new SupabaseRestError("Venue booking cannot be declined from its current state.", 409);
    status = "declined";
  } else if (action === "cancel") {
    if (current === "cancelled") return venueBookingResponse(booking);
    if (!["requested", "question", "approved"].includes(current)) throw new SupabaseRestError("Venue booking cannot be cancelled from its current state.", 409);
    status = "cancelled";
  } else throw new SupabaseRestError("Unsupported Venue booking action.", 409);
  const rows = await updateRows("venue_booking_requests", { id: eq(booking.id) }, {
    status,
    ...(message !== undefined ? { venue_message: optionalText(message, "message") } : {}),
    updated_at: new Date().toISOString()
  });
  booking = rows[0] || { ...booking, status };
  await synchronizeEvent(event);
  return venueBookingResponse(booking);
}

function venueBookingResponse(booking) {
  return {
    id: booking.id, event_id: booking.event_id || null, status: booking.status,
    expected_guests: Number(booking.expected_guests), requested_start: booking.requested_start,
    requested_end: booking.requested_end, venue_message: booking.venue_message || null
  };
}

async function hubAccess(user, eventId) {
  const event = await selectOne("events", { id: eq(requireUuid(eventId, "event_id")) });
  if (!event) throw new SupabaseRestError("Game Hub was not found.", 404);
  const roles = await eventViewerRoles(user, event, { hub: true });
  if (!roles.length) throw new SupabaseRestError("Game Hub was not found.", 404);
  const gm = await selectOne("gm_profiles", { id: eq(event.gm_profile_id) });
  const managers = await selectMany("venue_managers", { venue_id: eq(event.venue_id), verified_at: "not.is.null", limit: 100 });
  const registrations = await selectMany("registrations", { event_id: eq(event.id), status: eq("confirmed"), limit: 100 });
  const players = new Map();
  for (const registration of registrations) {
    const profile = await selectOne("player_profiles", { id: eq(registration.player_profile_id) });
    if (profile) players.set(profile.user_id, registration.id);
  }
  return { event, roles, gmUserId: gm?.user_id, managerUserIds: new Set(managers.map((item) => item.user_id)), playerRegistrations: players };
}

function capabilities(roles) {
  const channels = new Set();
  if (roles.includes("gm")) ["table_announcement", "table_discussion", "gm_venue", "player_gm"].forEach((item) => channels.add(item));
  if (roles.includes("player")) ["table_discussion", "player_gm", "player_venue_question"].forEach((item) => channels.add(item));
  if (roles.includes("venue_manager")) ["gm_venue", "player_venue_question"].forEach((item) => channels.add(item));
  return {
    viewer_roles: roles,
    post_channels: [...channels],
    can_manage_registrations: roles.includes("gm"),
    can_manage_booking: roles.includes("venue_manager")
  };
}

export async function getGameHub(user, eventId) {
  const access = await hubAccess(user, eventId);
  const event = await getEvent(user, eventId, { hub: true });
  const queue = [];
  if (access.roles.includes("gm")) {
    const registrations = await selectMany("registrations", { event_id: eq(access.event.id), order: "requested_at.asc,id.asc", limit: 100 });
    for (const registration of registrations) {
      const profile = await selectOne("player_profiles", { id: eq(registration.player_profile_id) });
      const account = profile ? await selectOne("users", { id: eq(profile.user_id) }) : null;
      queue.push({
        registration_id: registration.id,
        display_name: account?.display_name || "Player",
        status: registration.status,
        requested_at: registration.requested_at,
        expectations_acknowledged: Boolean(registration.expectations_acknowledged_at)
      });
    }
  }
  return { event, capabilities: capabilities(access.roles), registration_queue: queue };
}

export async function listGameHubs(user) {
  const events = await selectMany("events", { order: "starts_at.asc,id.asc", limit: 100 });
  const results = [];
  for (const event of events) {
    const roles = await eventViewerRoles(user, event, { hub: true });
    if (!roles.length) continue;
    const system = await gameSystemById(event.game_system_id);
    const venue = await selectOne("venues", { id: eq(event.venue_id) });
    results.push({
      event_id: event.id, title: event.title, status: event.status,
      starts_at: event.starts_at, ends_at: event.ends_at,
      venue_name: venue?.name || "Venue", venue_city: venue?.city || "", venue_state_region: venue?.state_region || "",
      system_name: system?.name || "Tabletop RPG", system_edition: system?.edition || null
    });
  }
  return results;
}

function cursorEncode(message) {
  return Buffer.from(`${message.created_at}|${message.id}`, "utf8").toString("base64url");
}

function cursorTime(cursor) {
  if (!cursor) return null;
  try {
    const text = Buffer.from(cursor, "base64url").toString("utf8");
    const [created] = text.split("|");
    if (!created || Number.isNaN(new Date(created).getTime())) throw new Error();
    return created;
  } catch {
    throw new SupabaseRestError("Message cursor is invalid.", 422);
  }
}

async function visibleMessages(access, user, limit, cursor) {
  const rows = await selectMany("messages", {
    event_id: eq(access.event.id),
    moderation_status: eq("visible"),
    ...(cursor ? { created_at: `lt.${cursorTime(cursor)}` } : {}),
    order: "created_at.desc,id.desc",
    limit: Math.min(limit * 4, 200)
  });
  const visible = [];
  for (const message of rows) {
    let allowed = false;
    if (["table_announcement", "table_discussion", "system_notification"].includes(message.channel_type)) allowed = true;
    else if (message.channel_type === "gm_venue") allowed = access.roles.includes("gm") || access.roles.includes("venue_manager");
    else if (["player_gm", "player_venue_question"].includes(message.channel_type)) {
      allowed = message.sender_user_id === user.id || message.recipient_user_id === user.id ||
        (message.channel_type === "player_gm" && access.roles.includes("gm")) ||
        (message.channel_type === "player_venue_question" && access.roles.includes("venue_manager"));
    }
    if (allowed) visible.push(message);
    if (visible.length >= limit) break;
  }
  return { visible, hasMore: rows.length > visible.length || rows.length >= limit };
}

async function messageView(access, user, message) {
  const sender = await selectOne("users", { id: eq(message.sender_user_id) });
  let senderRole = "player";
  if (message.sender_user_id === access.gmUserId) senderRole = "gm";
  else if (access.managerUserIds.has(message.sender_user_id)) senderRole = "venue_manager";
  const replyRegistrationId = access.playerRegistrations.get(message.sender_user_id) || null;
  return {
    id: message.id,
    channel_type: message.channel_type,
    category: message.category || null,
    body: message.body,
    created_at: message.created_at,
    sender_display_name: sender?.display_name || (senderRole === "gm" ? "Game Master" : "Player"),
    sender_role: senderRole,
    mine: message.sender_user_id === user.id,
    reply_registration_id: replyRegistrationId
  };
}

export async function getHubMessages(user, eventId, { limit = 50, cursor = "" } = {}) {
  const access = await hubAccess(user, eventId);
  const bounded = asInteger(limit, "limit", { min: 1, max: 100, fallback: 50 });
  const page = await visibleMessages(access, user, bounded, cursor);
  const items = [];
  for (const message of page.visible) items.push(await messageView(access, user, message));
  const last = page.visible[page.visible.length - 1];
  return { items, next_cursor: page.hasMore && last ? cursorEncode(last) : null };
}

export async function postHubMessage(user, eventId, payload) {
  const access = await hubAccess(user, eventId);
  const channel = enumValue(payload?.channel_type, "channel_type", MESSAGE_CHANNELS);
  if (!capabilities(access.roles).post_channels.includes(channel)) throw new SupabaseRestError("You cannot post to that Game Hub channel.", 403);
  const body = asString(payload?.body, "body", { min: 1, max: 4000 });
  let recipientUserId = null;
  let venueId = null;
  let category = null;

  if (channel === "table_announcement" && !access.roles.includes("gm")) throw new SupabaseRestError("Only the GM may post announcements.", 403);
  if (channel === "table_discussion" && !access.roles.some((role) => ["gm", "player"].includes(role))) throw new SupabaseRestError("This channel is unavailable.", 403);
  if (channel === "gm_venue") {
    if (!access.roles.some((role) => ["gm", "venue_manager"].includes(role))) throw new SupabaseRestError("This channel is unavailable.", 403);
    venueId = access.event.venue_id;
  }
  if (channel === "player_gm") {
    if (access.roles.includes("player")) recipientUserId = access.gmUserId;
    else if (access.roles.includes("gm")) {
      const registrationId = requireUuid(payload?.registration_id, "registration_id");
      const registration = await selectOne("registrations", { id: eq(registrationId), event_id: eq(access.event.id), status: eq("confirmed") });
      const profile = registration ? await selectOne("player_profiles", { id: eq(registration.player_profile_id) }) : null;
      if (!profile) throw new SupabaseRestError("Registration was not found.", 404);
      recipientUserId = profile.user_id;
    }
  }
  if (channel === "player_venue_question") {
    venueId = access.event.venue_id;
    category = enumValue(payload?.category, "category", VENUE_CATEGORIES);
    if (access.roles.includes("venue_manager") && !access.roles.includes("player")) {
      const registrationId = requireUuid(payload?.registration_id, "registration_id");
      const registration = await selectOne("registrations", { id: eq(registrationId), event_id: eq(access.event.id), status: eq("confirmed") });
      const profile = registration ? await selectOne("player_profiles", { id: eq(registration.player_profile_id) }) : null;
      if (!profile) throw new SupabaseRestError("Registration was not found.", 404);
      recipientUserId = profile.user_id;
    }
  }

  const rows = await insertRows("messages", [{
    id: crypto.randomUUID(), event_id: access.event.id, sender_user_id: user.id,
    channel_type: channel, recipient_user_id: recipientUserId, venue_id: venueId,
    category, body, moderation_status: "visible"
  }]);
  return messageView(access, user, rows[0]);
}
