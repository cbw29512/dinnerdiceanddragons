import assert from "node:assert/strict";
import { createOpportunityAlertService } from "../netlify/functions/_lib/opportunity-alert-core.mjs";

const now = "2030-08-20T12:00:00.000Z";
const match = {
  id: "match-1",
  proposed_start: "2030-08-21T22:00:00.000Z"
};

function repository() {
  const state = { responses: [], notifications: [], pauseChecks: [] };
  return {
    state,
    async listResponses() { return [...state.responses]; },
    async closeResponse() {},
    async matchingPaused(userId) { state.pauseChecks.push(userId); return false; },
    async createResponse(row) { state.responses.push(row); return row; },
    async preferences() { return { email_match_alerts: false, email_event_updates: false, browser_push: false, digest_mode: "immediate", matching_paused: false }; },
    async createNotification(row) { state.notifications.push(row); return row; }
  };
}

const repo = repository();
const service = createOpportunityAlertService(repo, () => now);
await service.reconcile({
  match,
  participants: [
    { user_id: "venue-user", role: "venue_manager", preapproved: true, payload: { match_id: match.id, role: "venue_manager", venue_preapproved: true } },
    { user_id: "gm-user", role: "gm", payload: { match_id: match.id, role: "gm" } },
    { user_id: "player-user", role: "player", payload: { match_id: match.id, role: "player" } }
  ]
});

const venue = repo.state.responses.find((row) => row.role === "venue_manager");
const gm = repo.state.responses.find((row) => row.role === "gm");
const player = repo.state.responses.find((row) => row.role === "player");

assert.equal(venue.decision, "accepted", "Venue calendar availability must preapprove the match.");
assert.equal(venue.responded_at, now, "Venue preapproval must be recorded as an accepted response.");
assert.equal(gm.decision, "pending", "DM must still explicitly accept.");
assert.equal(player.decision, "pending", "Player must still explicitly accept.");
assert.deepEqual(repo.state.pauseChecks.sort(), ["gm-user", "player-user"], "Venue preapproval must not be blocked by Player/DM matching pause preferences.");
assert.ok(repo.state.notifications.some((row) => row.user_id === "venue-user"), "Venue manager still receives a match notification.");

console.log("Venue preapproval contract passed.");
