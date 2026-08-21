import { deliveryChannels } from "./notification-contract.mjs";
import { markReminderSent } from "./game-reminders.mjs";
import { eq, insertRows, selectMany, selectOne } from "./supabase-rest.mjs";

function sameInstant(left, right) {
  if (!left || !right) return false;
  return new Date(left).getTime() === new Date(right).getTime();
}

async function gameState(matchId) {
  const match = await selectOne("table_matches", { id: eq(matchId) });
  if (!match || !["forming", "converted"].includes(match.status)) return null;
  const event = await selectOne("events", { table_match_id: eq(matchId) });
  if (event && ["cancelled", "completed"].includes(event.status)) return null;
  return {
    match,
    event,
    starts_at: event?.starts_at || match.proposed_start
  };
}

async function acceptedRole(userId, matchId) {
  const rows = await selectMany("opportunity_responses", {
    user_id: eq(userId), table_match_id: eq(matchId), decision: eq("accepted"), limit: 5
  });
  return rows[0]?.role || null;
}

function isDue(reminder, startsAt, nowIso) {
  const start = new Date(startsAt).getTime();
  const now = new Date(nowIso).getTime();
  const target = start - Number(reminder.minutes_before) * 60_000;
  return Number.isFinite(target) && now >= target && now < start && !sameInstant(reminder.sent_for_start_at, startsAt);
}

export async function dispatchDueGameReminders(nowIso = new Date().toISOString()) {
  try {
    const reminders = await selectMany("game_reminders", { enabled: eq(true), limit: 500 });
    let sent = 0;
    for (const reminder of reminders) {
      const game = await gameState(reminder.table_match_id);
      if (!game || !isDue(reminder, game.starts_at, nowIso)) continue;
      const role = await acceptedRole(reminder.user_id, reminder.table_match_id);
      if (!role) continue;
      const prefs = await selectOne("notification_preferences", { user_id: eq(reminder.user_id) });
      const plan = deliveryChannels("attendance_reminder", prefs || {});
      for (const channel of plan.channels) {
        await insertRows("notifications", [{
          id: crypto.randomUUID(), user_id: reminder.user_id,
          table_match_id: reminder.table_match_id, event_id: game.event?.id || null,
          type: "attendance_reminder", state: "queued", channel,
          payload: {
            match_id: reminder.table_match_id,
            event_id: game.event?.id || null,
            role,
            starts_at: game.starts_at,
            minutes_before: Number(reminder.minutes_before)
          },
          expires_at: game.starts_at
        }], { returning: false });
      }
      await markReminderSent(reminder.id, game.starts_at, nowIso);
      sent += 1;
    }
    return Object.freeze({ checked: reminders.length, sent });
  } catch (error) {
    console.error("[DDD Reminders] Scheduled reminder dispatch failed", {
      error_type: String(error?.name || "Error")
    });
    throw error;
  }
}
