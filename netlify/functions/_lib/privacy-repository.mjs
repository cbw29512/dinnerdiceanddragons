import { eq, insertRows, selectMany, selectOne, updateRows } from "./supabase-rest.mjs";

export const privacyRepository = Object.freeze({
  findPreferences: (userId) => selectOne("notification_preferences", { user_id: eq(userId) }),
  async upsertPreferences(userId, values) {
    const rows = await insertRows("notification_preferences", [{ user_id: userId, ...values }], {
      upsert: true,
      onConflict: "user_id"
    });
    return rows[0] || null;
  },
  listNotifications: (userId, limit) => selectMany("notifications", { user_id: eq(userId), order: "created_at.desc", limit }),
  async updateNotification(userId, notificationId, values) {
    const rows = await updateRows("notifications", { id: eq(notificationId), user_id: eq(userId) }, values);
    return rows[0] || null;
  },
  findResponse: (userId, matchId) => selectOne("opportunity_responses", { table_match_id: eq(matchId), user_id: eq(userId) }),
  updateResponse: (responseId, userId, values) => updateRows("opportunity_responses", { id: eq(responseId), user_id: eq(userId) }, {
    decision: values.decision,
    responded_at: values.responded_at,
    updated_at: values.updated_at
  }, { returning: false }),
  findMatch: (matchId) => selectOne("table_matches", { id: eq(matchId) }),
  listResponses: (matchId) => selectMany("opportunity_responses", { table_match_id: eq(matchId), order: "offered_at.asc" }),
  updateMatchStatus: (matchId, status, updatedAt) => updateRows("table_matches", { id: eq(matchId) }, {
    status,
    updated_at: updatedAt
  }, { returning: false })
});
