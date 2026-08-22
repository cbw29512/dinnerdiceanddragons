import assert from "node:assert/strict";
import { getDatabase } from "@netlify/database";

import { eq, insertRows, selectMany, selectOne } from "../netlify/functions/_lib/database.mjs";
import { createFormationRaceGm } from "./netlify-database-game-on-race-gm-fixture.mjs";

export const BASE_MATCH_ID = "a2000000-0000-4000-8000-000000000001";
export const GM_USER_ID = "a1000000-0000-4000-8000-000000000001";
export const PLAYER_ONE_USER_ID = "a1000000-0000-4000-8000-000000000003";
export const PLAYER_TWO_USER_ID = "a1000000-0000-4000-8000-000000000004";

export async function loadGameOnFixture() {
  const baseMatch = await selectOne("table_matches", { id: eq(BASE_MATCH_ID) }, { required: true });
  const baseTable = await selectOne("game_tables", { source_table_match_id: eq(BASE_MATCH_ID) }, { required: true });
  const baseMatchPlayers = await selectMany("table_match_players", { table_match_id: eq(BASE_MATCH_ID), order: "player_demand_signal_id.asc" });
  const baseMemberships = await selectMany("game_table_players", { game_table_id: eq(baseTable.id), order: "player_profile_id.asc" });
  const baseResponses = await selectMany("opportunity_responses", { table_match_id: eq(BASE_MATCH_ID), order: "role.asc,user_id.asc" });
  assert.equal(baseMatchPlayers.length, 2);
  assert.equal(baseMemberships.length, 2);
  assert.equal(baseResponses.length, 4);
  return { baseMatch, baseTable, baseMatchPlayers, baseMemberships, baseResponses };
}

export function cloneMatch(baseMatch, id, status, start, end) {
  return {
    ...baseMatch, id, proposed_start: start, proposed_end: end, status,
    compatible_player_count: 2, minimum_players: 2, maximum_players: 2, fit_score: 100
  };
}

export function responseCopies(baseResponses, matchId, ids, playerDecision = "accepted", gmUserId = GM_USER_ID) {
  return baseResponses.map((row, index) => ({
    ...row,
    id: ids[index],
    table_match_id: matchId,
    user_id: row.role === "gm" ? gmUserId : row.user_id,
    decision: row.role === "player" ? playerDecision : "accepted",
    responded_at: row.role === "player" && playerDecision === "pending" ? null : row.responded_at
  }));
}

export async function seedFormationRace(fixture, matchIds, tableIds, responseIds, start, end) {
  const { baseMatch, baseTable, baseMatchPlayers, baseMemberships, baseResponses } = fixture;
  const secondGm = await createFormationRaceGm();
  const matches = matchIds.map((id) => cloneMatch(baseMatch, id, "forming", start, end));
  matches[1] = { ...matches[1], gm_supply_signal_id: secondGm.supply.id };
  await insertRows("table_matches", matches, { returning: false });
  await insertRows("table_match_players", matchIds.flatMap((matchId) => baseMatchPlayers.map((row) => ({
    ...row, table_match_id: matchId, status: "notified"
  }))), { returning: false });

  const tables = matchIds.map((matchId, index) => ({
    ...baseTable,
    id: tableIds[index],
    source_table_match_id: matchId,
    title: `Formation Race ${index + 1}`,
    lifecycle_status: "forming",
    proposed_start: start,
    proposed_end: end
  }));
  tables[1] = { ...tables[1], created_by_user_id: secondGm.userId, gm_profile_id: secondGm.profile.id };
  await insertRows("game_tables", tables, { returning: false });
  await insertRows("game_table_players", tableIds.flatMap((tableId) => baseMemberships.map((row) => ({
    ...row, game_table_id: tableId, status: "invited", responded_at: null, ended_at: null
  }))), { returning: false });
  await insertRows("opportunity_responses", [
    ...responseCopies(baseResponses, matchIds[0], responseIds[0]),
    ...responseCopies(baseResponses, matchIds[1], responseIds[1], "accepted", secondGm.userId)
  ], { returning: false });
  return { gmUserIds: [GM_USER_ID, secondGm.userId] };
}

export async function withBookingInsertDelay(windowId, callback) {
  const database = getDatabase();
  const installClient = await database.pool.connect();
  try {
    await installClient.query(`
      CREATE OR REPLACE FUNCTION ddd_test_delay_formation_booking() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.venue_table_window_id = '${windowId}'::uuid THEN PERFORM pg_sleep(0.25); END IF;
        RETURN NEW;
      END;
      $$
    `);
    await installClient.query("DROP TRIGGER IF EXISTS ddd_test_delay_formation_booking ON venue_booking_requests");
    await installClient.query(`
      CREATE TRIGGER ddd_test_delay_formation_booking
      BEFORE INSERT ON venue_booking_requests
      FOR EACH ROW EXECUTE FUNCTION ddd_test_delay_formation_booking()
    `);
  } finally {
    installClient.release();
  }
  try {
    return await callback();
  } finally {
    const cleanupClient = await database.pool.connect();
    try {
      await cleanupClient.query("DROP TRIGGER IF EXISTS ddd_test_delay_formation_booking ON venue_booking_requests");
      await cleanupClient.query("DROP FUNCTION IF EXISTS ddd_test_delay_formation_booking()");
    } finally {
      cleanupClient.release();
    }
  }
}
