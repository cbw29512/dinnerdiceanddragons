import assert from "node:assert/strict";

import { eq, insertRows, selectMany, selectOne } from "../netlify/functions/_lib/database.mjs";
import { formAcceptedTableMatch } from "../netlify/functions/_lib/matched-event-formation.mjs";
import { privacyRepository } from "../netlify/functions/_lib/privacy-repository.mjs";
import { createPrivacyService } from "../netlify/functions/_lib/privacy-service-core.mjs";
import {
  GM_USER_ID,
  PLAYER_ONE_USER_ID,
  PLAYER_TWO_USER_ID,
  cloneMatch,
  loadGameOnFixture,
  responseCopies,
  seedFormationRace,
  withBookingInsertDelay
} from "./netlify-database-game-on-concurrency-fixtures.mjs";

const THRESHOLD_MATCH_ID = "a7100000-0000-4000-8000-000000000001";
const FORMATION_MATCH_IDS = ["a7200000-0000-4000-8000-000000000001", "a7200000-0000-4000-8000-000000000002"];
const FORMATION_TABLE_IDS = ["a7300000-0000-4000-8000-000000000001", "a7300000-0000-4000-8000-000000000002"];
const fixture = await loadGameOnFixture();
const { baseMatch, baseResponses } = fixture;

await insertRows("table_matches", [cloneMatch(
  baseMatch,
  THRESHOLD_MATCH_ID,
  "potential",
  "2026-09-19T22:00:00.000Z",
  "2026-09-20T02:00:00.000Z"
)], { returning: false });
await insertRows("opportunity_responses", responseCopies(baseResponses, THRESHOLD_MATCH_ID, [
  "a7110000-0000-4000-8000-000000000001",
  "a7110000-0000-4000-8000-000000000002",
  "a7110000-0000-4000-8000-000000000003",
  "a7110000-0000-4000-8000-000000000004"
], "pending"), { returning: false });

let listCalls = 0;
let releaseFirstList;
const firstListGate = new Promise((resolve) => { releaseFirstList = resolve; });
let firstListTimedOut = false;
const raceRepository = {
  ...privacyRepository,
  async listResponses(matchId) {
    if (matchId === THRESHOLD_MATCH_ID) {
      listCalls += 1;
      if (listCalls === 1) {
        firstListTimedOut = await Promise.race([
          firstListGate.then(() => false),
          new Promise((resolve) => setTimeout(() => resolve(true), 300))
        ]);
      } else {
        releaseFirstList();
      }
    }
    return privacyRepository.listResponses(matchId);
  }
};
const thresholdService = createPrivacyService(raceRepository);
const thresholdResults = await Promise.all([
  thresholdService.respond(PLAYER_ONE_USER_ID, THRESHOLD_MATCH_ID, "player", "accepted"),
  thresholdService.respond(PLAYER_TWO_USER_ID, THRESHOLD_MATCH_ID, "player", "accepted")
]);
assert.equal(firstListTimedOut, true, "The second response must wait behind the Table Match row lock.");
assert.equal(thresholdResults.filter((row) => row.table_status === "forming").length, 1);
assert.equal((await selectOne("table_matches", { id: eq(THRESHOLD_MATCH_ID) }, { required: true })).status, "forming");
const thresholdNotifications = await selectMany("notifications", { table_match_id: eq(THRESHOLD_MATCH_ID), type: eq("table_formed"), limit: 20 });
assert.equal(thresholdNotifications.length, 4, "GAME ON notifications must be emitted exactly once.");

const formationStart = "2026-10-03T22:00:00.000Z";
const formationEnd = "2026-10-04T02:00:00.000Z";
await seedFormationRace(fixture, FORMATION_MATCH_IDS, FORMATION_TABLE_IDS, [
  ["a7210000-0000-4000-8000-000000000001", "a7210000-0000-4000-8000-000000000002", "a7210000-0000-4000-8000-000000000003", "a7210000-0000-4000-8000-000000000004"],
  ["a7220000-0000-4000-8000-000000000001", "a7220000-0000-4000-8000-000000000002", "a7220000-0000-4000-8000-000000000003", "a7220000-0000-4000-8000-000000000004"]
], formationStart, formationEnd);
const approvedBefore = await selectMany("venue_booking_requests", {
  venue_table_window_id: eq(baseMatch.venue_table_window_id),
  status: eq("approved"),
  limit: 20
});
assert.equal(approvedBefore.length, 0, "The shared Venue window must start uncommitted for the race proof.");

function eventPayload(index) {
  return {
    title: `Serialized Venue Race ${index + 1}`,
    description: "Only one Event may claim the final Venue table.",
    event_type: "one_shot",
    join_mode: "request_to_join",
    expected_sessions: 1,
    expectations: { play_style: "Cooperative table play", boundaries: "Respect table boundaries." }
  };
}

const formationOutcomes = await withBookingInsertDelay(baseMatch.venue_table_window_id, () =>
  Promise.allSettled(FORMATION_MATCH_IDS.map((matchId, index) =>
    formAcceptedTableMatch({ id: GM_USER_ID }, matchId, eventPayload(index))
  ))
);
assert.equal(formationOutcomes.filter((item) => item.status === "fulfilled").length, 1);
assert.equal(formationOutcomes.filter((item) => item.status === "rejected").length, 1);
assert.equal(Number(formationOutcomes.find((item) => item.status === "rejected").reason?.status), 409);
const formationBookings = (await selectMany("venue_booking_requests", {
  venue_table_window_id: eq(baseMatch.venue_table_window_id), status: eq("approved"), limit: 20
})).filter((row) => FORMATION_MATCH_IDS.includes(row.table_match_id));
assert.equal(formationBookings.length, 1, "Two formed matches must never reserve the same final Venue table.");
const formationEvents = await Promise.all(FORMATION_MATCH_IDS.map((matchId) => selectOne("events", { table_match_id: eq(matchId) })));
assert.equal(formationEvents.filter(Boolean).length, 1);
const formationStatuses = await Promise.all(FORMATION_MATCH_IDS.map(async (matchId) =>
  (await selectOne("table_matches", { id: eq(matchId) }, { required: true })).status
));
assert.deepEqual([...formationStatuses].sort(), ["converted", "forming"]);

console.log("GAME ON threshold and Venue formation concurrency checks passed.");
