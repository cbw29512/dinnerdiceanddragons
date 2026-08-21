import { applyUserDecision, formationProgress } from "./opportunity-response-state.mjs";
import { parsePreferenceUpdate, publicNotification } from "./privacy-api-contract.mjs";

export const DEFAULT_PREFERENCES = Object.freeze({
  email_match_alerts: true,
  email_event_updates: true,
  browser_push: false,
  digest_mode: "immediate",
  matching_paused: false
});

export function createPrivacyService(repository, clock = () => new Date().toISOString()) {
  if (!repository) throw new Error("Privacy repository is required.");

  async function preferences(userId) {
    try {
      const row = await repository.findPreferences(userId);
      return Object.freeze(row ? {
        email_match_alerts: Boolean(row.email_match_alerts),
        email_event_updates: Boolean(row.email_event_updates),
        browser_push: Boolean(row.browser_push),
        digest_mode: row.digest_mode,
        matching_paused: Boolean(row.matching_paused)
      } : { ...DEFAULT_PREFERENCES });
    } catch (error) {
      console.error("[DDD Privacy] Unable to load preferences", { error_type: String(error?.name || "Error") });
      throw error;
    }
  }

  async function savePreferences(userId, raw) {
    try {
      const values = parsePreferenceUpdate(raw);
      const row = await repository.upsertPreferences(userId, { ...values, updated_at: clock() });
      return Object.freeze(row || values);
    } catch (error) {
      console.error("[DDD Privacy] Unable to save preferences", { error_type: String(error?.name || "Error") });
      throw error;
    }
  }

  async function notifications(userId, limit = 50) {
    try {
      return Object.freeze((await repository.listNotifications(userId, limit)).map(publicNotification));
    } catch (error) {
      console.error("[DDD Privacy] Unable to list notifications", { error_type: String(error?.name || "Error") });
      throw error;
    }
  }

  async function markNotification(userId, notificationId, action) {
    try {
      const now = clock();
      const values = action === "read" ? { state: "read", read_at: now } : { state: "acted", acted_at: now };
      const row = await repository.updateNotification(userId, notificationId, values);
      if (!row) throw Object.assign(new Error("Notification not found."), { status: 404 });
      return publicNotification(row);
    } catch (error) {
      console.error("[DDD Privacy] Unable to update notification", { error_type: String(error?.name || "Error") });
      throw error;
    }
  }

  async function respond(userId, matchId, role, decision) {
    try {
      const current = await repository.findResponse(userId, matchId, role);
      if (!current) throw Object.assign(new Error("Opportunity response not found."), { status: 404 });
      const next = applyUserDecision(current, decision, clock());
      await repository.updateResponse(current.id, userId, role, next);
      const match = await repository.findMatch(matchId);
      if (!match) throw Object.assign(new Error("Table Match not found."), { status: 404 });
      const responses = await repository.listResponses(matchId);
      const progress = formationProgress(responses, Number(match.minimum_players));
      let tableStatus = match.status;
      if (progress.formed && ["potential", "invited"].includes(match.status)) {
        tableStatus = "forming";
        await repository.updateMatchStatus(matchId, tableStatus, clock());
      }
      return Object.freeze({ role, decision: next.decision, progress, table_status: tableStatus });
    } catch (error) {
      console.error("[DDD Privacy] Unable to respond to opportunity", { error_type: String(error?.name || "Error") });
      throw error;
    }
  }

  return Object.freeze({ preferences, savePreferences, notifications, markNotification, respond });
}
