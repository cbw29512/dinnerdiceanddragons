import { requireRole } from "./auth.mjs";
import { confirmAcceptedPlayers } from "./accepted-player-commitments.mjs";
import { formationProgress } from "./opportunity-response-state.mjs";
import { SupabaseRestError, eq, insertRows, selectMany, selectOne, updateRows, withTransaction } from "./supabase-rest.mjs";
import { asBoolean, asInteger, asString, requireUuid } from "./http.mjs";

const EVENT_TYPES = new Set(["one_shot", "campaign_session", "new_campaign", "learn_to_play", "organized_play"]);
const JOIN_MODES = new Set(["request_to_join", "instant_join"]);
const optional = (value, max = 4000) => value == null || value === "" ? null : asString(value, "optional_text", { min: 0, max, nullable: true });
const enumValue = (value, name, allowed) => { const text = asString(value, name, { min: 1, max: 80 }); if (!allowed.has(text)) throw new SupabaseRestError(`${name} is invalid.`, 422); return text; };
const slug = (title, matchId) => `${String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 150) || "table"}-${String(matchId).slice(0, 8)}`;

function expectations(raw = {}) {
  return {
    tone: optional(raw.tone, 200), age_environment: optional(raw.age_environment, 120),
    play_style: asString(raw.play_style, "play_style", { min: 1, max: 2000 }),
    boundaries: asString(raw.boundaries, "boundaries", { min: 1, max: 4000 }),
    pvp_policy: optional(raw.pvp_policy, 300), homebrew_policy: optional(raw.homebrew_policy),
    character_death_policy: optional(raw.character_death_policy, 500), mature_content_notes: optional(raw.mature_content_notes),
    alcohol_policy: optional(raw.alcohol_policy, 500), new_players_welcome: raw.new_players_welcome === undefined ? true : asBoolean(raw.new_players_welcome, "new_players_welcome"),
    break_policy: optional(raw.break_policy, 500), safety_framework: optional(raw.safety_framework, 1000),
    environment_notes: optional(raw.environment_notes), accessibility_notes: optional(raw.accessibility_notes), other_notes: optional(raw.other_notes)
  };
}

async function capacityAvailable(window, start, end) {
  const approved = await selectMany("venue_booking_requests", { venue_table_window_id: eq(window.id), status: eq("approved"), limit: 200 });
  const overlaps = approved.filter((item) => new Date(item.requested_start) < new Date(end) && new Date(item.requested_end) > new Date(start));
  return overlaps.reduce((sum, item) => sum + Number(item.tables_requested || 1), 0) + 1 <= Number(window.table_count);
}

async function parents(match) {
  const supply = await selectOne("gm_supply_signals", { id: eq(match.gm_supply_signal_id) });
  const gm = supply ? await selectOne("gm_profiles", { id: eq(supply.gm_profile_id) }) : null;
  const window = await selectOne("venue_table_windows", { id: eq(match.venue_table_window_id), active: "is.true" });
  if (!gm || !window) throw new SupabaseRestError("Matched table state is no longer available.", 409);
  return { gm, window };
}

export async function formAcceptedTableMatch(user, matchId, payload) {
  try {
    return await withTransaction(async () => {
      await requireRole(user.id, "gm");
      const id = requireUuid(matchId, "table_match_id");
      const match = await selectOne("table_matches", { id: eq(id) });
      if (!match) throw new SupabaseRestError("Opportunity not found.", 404);
      const parent = await parents(match);
      if (parent.gm.user_id !== user.id) throw new SupabaseRestError("Not permitted for this opportunity.", 403);
      const existing = await selectOne("events", { table_match_id: eq(id) });
      if (existing) {
        const booking = await selectOne("venue_booking_requests", { event_id: eq(existing.id) });
        return { table_match_id: id, game_table_id: existing.game_table_id || null, event_id: existing.id, game_series_id: existing.game_series_id || null, venue_booking_request_id: booking?.id || null, event_status: existing.status, booking_status: booking?.status || null, created: false };
      }
      if (match.status !== "forming") throw new SupabaseRestError("The DM and minimum Players must accept before Event setup.", 409);
      const responses = await selectMany("opportunity_responses", { table_match_id: eq(id), limit: 100 });
      if (!formationProgress(responses, Number(match.minimum_players)).formed) throw new SupabaseRestError("This table no longer has all required acceptances.", 409);

      const title = asString(payload?.title, "title", { min: 1, max: 200 });
      const description = asString(payload?.description, "description", { min: 1, max: 8000 });
      const eventType = enumValue(payload?.event_type ?? "one_shot", "event_type", EVENT_TYPES);
      const joinMode = enumValue(payload?.join_mode ?? "request_to_join", "join_mode", JOIN_MODES);
      const minimumAge = payload?.minimum_age == null ? null : asInteger(payload.minimum_age, "minimum_age", { min: 0, max: 125 });
      const beginner = payload?.beginner_friendly === undefined ? true : asBoolean(payload.beginner_friendly, "beginner_friendly");
      const expectedSessions = asInteger(payload?.expected_sessions ?? 1, "expected_sessions", { min: 1, max: 52 });
      const table = await selectOne("game_tables", { source_table_match_id: eq(id) });
      if (!table) throw new SupabaseRestError("Matched table is not materialized yet.", 409);
      if (Number(match.maximum_players) + 1 > Number(parent.window.max_people_per_table)) throw new SupabaseRestError("Venue capacity no longer supports this table.", 409);
      if (!(await capacityAvailable(parent.window, match.proposed_start, match.proposed_end))) throw new SupabaseRestError("Venue table capacity is no longer available for that time.", 409);

      const now = new Date().toISOString();
      await updateRows("game_tables", { id: eq(table.id) }, { title, join_policy: joinMode === "instant_join" ? "open" : "request", minimum_age: minimumAge, updated_at: now }, { returning: false });
      let seriesId = null;
      if (expectedSessions > 1) {
        seriesId = crypto.randomUUID();
        await insertRows("game_series", [{ id: seriesId, table_match_id: id, title, gm_profile_id: parent.gm.id, game_system_id: match.game_system_id, venue_id: parent.window.venue_id, recurring_rule_id: null, expected_sessions: expectedSessions, starts_on: String(match.proposed_start).slice(0, 10), ends_on: null, active: true }], { returning: false });
      }
      const eventId = crypto.randomUUID();
      const event = { id: eventId, game_series_id: seriesId, game_table_id: table.id, table_match_id: id, slug: slug(title, id), title, description, gm_profile_id: parent.gm.id, game_system_id: match.game_system_id, venue_id: parent.window.venue_id, event_type: eventType, join_mode: joinMode, status: "forming", starts_at: match.proposed_start, ends_at: match.proposed_end, min_players: Number(match.minimum_players), max_players: Number(match.maximum_players), minimum_age: minimumAge, beginner_friendly: beginner, updated_at: now };
      await insertRows("events", [event], { returning: false });
      await insertRows("table_expectations", [{ id: crypto.randomUUID(), event_id: eventId, ...expectations(payload?.expectations) }], { returning: false });
      const bookingId = crypto.randomUUID();
      await insertRows("venue_booking_requests", [{ id: bookingId, venue_table_window_id: parent.window.id, gm_profile_id: parent.gm.id, table_match_id: id, game_series_id: seriesId, event_id: eventId, requested_start: match.proposed_start, requested_end: match.proposed_end, tables_requested: 1, expected_guests: 1, status: "approved", venue_message: null, gm_message: optional(payload?.gm_message), updated_at: now }], { returning: false });
      const confirmed = await confirmAcceptedPlayers({ matchId: id, eventId, gameTableId: table.id });
      if (confirmed < Number(match.minimum_players)) throw new SupabaseRestError("Accepted Player commitments changed before Event creation completed.", 409);
      const status = confirmed >= Number(match.maximum_players) ? "full" : "confirmed";
      await updateRows("events", { id: eq(eventId) }, { status, updated_at: now }, { returning: false });
      await updateRows("venue_booking_requests", { id: eq(bookingId) }, { expected_guests: 1 + confirmed, updated_at: now }, { returning: false });
      await updateRows("game_tables", { id: eq(table.id) }, { lifecycle_status: "confirmed", updated_at: now }, { returning: false });
      await updateRows("table_matches", { id: eq(id) }, { status: "converted", updated_at: now }, { returning: false });
      return { table_match_id: id, game_table_id: table.id, event_id: eventId, game_series_id: seriesId, venue_booking_request_id: bookingId, event_status: status, booking_status: "approved", created: true };
    });
  } catch (error) {
    console.error("[DDD Formation] Unable to create accepted Event", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
