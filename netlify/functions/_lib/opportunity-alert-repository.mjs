import { eq, insertRows, selectMany, selectOne, updateRows } from "./supabase-rest.mjs";

export const opportunityAlertRepository = Object.freeze({
  listResponses: (matchId) => selectMany("opportunity_responses", {
    table_match_id: eq(matchId), order: "offered_at.asc", limit: 200
  }),
  closeResponse: (responseId, decision, now) => updateRows("opportunity_responses", { id: eq(responseId) }, {
    decision, responded_at: now, updated_at: now
  }, { returning: false }),
  matchingPaused: async (userId) => Boolean((await selectOne("notification_preferences", {
    user_id: eq(userId), matching_paused: "is.true"
  }))?.matching_paused),
  preferences: (userId) => selectOne("notification_preferences", { user_id: eq(userId) }),
  createResponse: (row) => insertRows("opportunity_responses", [row], { returning: false }),
  createNotification: (row) => insertRows("notifications", [row], { returning: false })
});
