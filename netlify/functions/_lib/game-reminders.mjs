import { deleteRows, eq, insertRows, selectMany, selectOne, updateRows } from "./supabase-rest.mjs";
import { SupabaseRestError } from "./supabase-rest.mjs";

export const DEFAULT_REMINDER_MINUTES = Object.freeze([1440, 60]);
const MAX_REMINDERS = 5;
const MIN_MINUTES = 15;
const MAX_MINUTES = 20160;

export function normalizeReminderMinutes(value) {
  if (!Array.isArray(value)) throw new SupabaseRestError("Reminder times must be an array.", 422);
  if (value.length > MAX_REMINDERS) throw new SupabaseRestError(`Choose no more than ${MAX_REMINDERS} reminders.`, 422);
  const normalized = value.map((item) => Number(item));
  if (normalized.some((item) => !Number.isInteger(item) || item < MIN_MINUTES || item > MAX_MINUTES)) {
    throw new SupabaseRestError("Reminder times must be between 15 minutes and 14 days before the game.", 422);
  }
  return [...new Set(normalized)].sort((a, b) => b - a);
}

async function acceptedResponse(userId, matchId) {
  return selectOne("opportunity_responses", {
    user_id: eq(userId), table_match_id: eq(matchId), decision: eq("accepted")
  });
}

async function requireAccepted(userId, matchId) {
  const response = await acceptedResponse(userId, matchId);
  if (!response) throw new SupabaseRestError("Only accepted game participants can manage reminders.", 403);
  return response;
}

export async function listGameReminders(user, matchId) {
  await requireAccepted(user.id, matchId);
  const rows = await selectMany("game_reminders", {
    user_id: eq(user.id), table_match_id: eq(matchId), order: "minutes_before.desc", limit: MAX_REMINDERS
  });
  return rows.map((row) => ({ minutes_before: Number(row.minutes_before), enabled: Boolean(row.enabled) }));
}

export async function replaceGameReminders(user, matchId, minutes) {
  await requireAccepted(user.id, matchId);
  const offsets = normalizeReminderMinutes(minutes);
  await deleteRows("game_reminders", { user_id: eq(user.id), table_match_id: eq(matchId) });
  if (!offsets.length) return [];
  const now = new Date().toISOString();
  await insertRows("game_reminders", offsets.map((minutesBefore) => ({
    id: crypto.randomUUID(), user_id: user.id, table_match_id: matchId,
    minutes_before: minutesBefore, enabled: true, sent_for_start_at: null,
    sent_at: null, created_at: now, updated_at: now
  })), { returning: false });
  return offsets.map((minutesBefore) => ({ minutes_before: minutesBefore, enabled: true }));
}

export async function seedDefaultGameReminders(matchId, responses) {
  const accepted = responses.filter((row) => row.decision === "accepted");
  const userIds = [...new Set(accepted.map((row) => row.user_id))];
  const now = new Date().toISOString();
  for (const userId of userIds) {
    const existing = await selectMany("game_reminders", { user_id: eq(userId), table_match_id: eq(matchId), limit: 1 });
    if (existing.length) continue;
    const prefs = await selectOne("notification_preferences", { user_id: eq(userId) });
    const offsets = normalizeReminderMinutes(prefs?.default_reminder_minutes || DEFAULT_REMINDER_MINUTES);
    if (!offsets.length) continue;
    await insertRows("game_reminders", offsets.map((minutesBefore) => ({
      id: crypto.randomUUID(), user_id: userId, table_match_id: matchId,
      minutes_before: minutesBefore, enabled: true, sent_for_start_at: null,
      sent_at: null, created_at: now, updated_at: now
    })), { returning: false });
  }
}

export async function markReminderSent(id, startAt, sentAt) {
  await updateRows("game_reminders", { id: eq(id) }, {
    sent_for_start_at: startAt, sent_at: sentAt, updated_at: sentAt
  }, { returning: false });
}
