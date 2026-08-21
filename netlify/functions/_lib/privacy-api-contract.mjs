const DIGESTS = new Set(["immediate", "daily"]);
const OPPORTUNITY_DECISIONS = new Set(["interested", "accepted", "declined"]);
const OPPORTUNITY_ROLES = new Set(["player", "gm", "venue_manager"]);
const NOTIFICATION_ACTIONS = new Set(["read", "act"]);
const DEFAULT_REMINDERS = Object.freeze([1440, 60]);

export class PrivacyApiContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "PrivacyApiContractError";
  }
}

function bool(value, name) {
  if (typeof value !== "boolean") throw new PrivacyApiContractError(`${name} must be true or false.`);
  return value;
}

function reminderMinutes(value) {
  const raw = value === undefined ? DEFAULT_REMINDERS : value;
  if (!Array.isArray(raw) || raw.length > 5) throw new PrivacyApiContractError("default_reminder_minutes is invalid.");
  const values = raw.map((item) => Number(item));
  if (values.some((item) => !Number.isInteger(item) || item < 1 || item > 20160)) {
    throw new PrivacyApiContractError("default_reminder_minutes is invalid.");
  }
  return [...new Set(values)].sort((a, b) => b - a);
}

export function parsePreferenceUpdate(raw) {
  try {
    const payload = raw && typeof raw === "object" ? raw : {};
    const digest = String(payload.digest_mode || "");
    if (!DIGESTS.has(digest)) throw new PrivacyApiContractError("digest_mode is invalid.");
    return Object.freeze({
      email_match_alerts: bool(payload.email_match_alerts, "email_match_alerts"),
      email_event_updates: bool(payload.email_event_updates, "email_event_updates"),
      browser_push: bool(payload.browser_push, "browser_push"),
      digest_mode: digest,
      matching_paused: bool(payload.matching_paused, "matching_paused"),
      default_reminder_minutes: reminderMinutes(payload.default_reminder_minutes)
    });
  } catch (error) {
    if (error instanceof PrivacyApiContractError) throw error;
    throw new PrivacyApiContractError("Notification preferences are invalid.");
  }
}

export function parseOpportunityDecision(raw) {
  const decision = String(raw?.decision || "");
  const role = String(raw?.role || "");
  if (!OPPORTUNITY_DECISIONS.has(decision)) throw new PrivacyApiContractError("Opportunity decision is invalid.");
  if (!OPPORTUNITY_ROLES.has(role)) throw new PrivacyApiContractError("Opportunity role is invalid.");
  return Object.freeze({ decision, role });
}

export function parseNotificationAction(raw) {
  const action = String(raw?.action || "");
  if (!NOTIFICATION_ACTIONS.has(action)) throw new PrivacyApiContractError("Notification action is invalid.");
  return Object.freeze({ action });
}

export function publicNotification(row) {
  try {
    const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
    const text = JSON.stringify(payload);
    for (const forbidden of ["email", "phone", "postal_code", "auth_provider_user_id", "user_id", "private_notes"]) {
      if (text.includes(`\"${forbidden}\"`)) throw new PrivacyApiContractError("Notification payload contains private fields.");
    }
    return Object.freeze({
      id: String(row.id), type: String(row.type), state: String(row.state),
      payload: Object.freeze({ ...payload }), expires_at: row.expires_at || null,
      created_at: row.created_at || null, read_at: row.read_at || null, acted_at: row.acted_at || null
    });
  } catch (error) {
    if (error instanceof PrivacyApiContractError) throw error;
    throw new PrivacyApiContractError("Notification projection is invalid.");
  }
}
