const TYPES = new Set([
  "match_available", "seat_offered", "table_formed", "waitlist_promoted",
  "event_disrupted", "event_cancelled", "event_changed", "attendance_reminder"
]);
const CHANNELS = new Set(["in_app", "email", "browser_push"]);
const CRITICAL = new Set(["table_formed", "event_disrupted", "event_cancelled", "event_changed"]);

export function deliveryChannels(type, preferences = {}) {
  try {
    if (!TYPES.has(type)) throw new Error("Notification type is invalid.");
    const channels = ["in_app"];
    const isEvent = type.startsWith("event_") || type === "attendance_reminder" || type === "table_formed";
    const emailEnabled = isEvent ? preferences.email_event_updates !== false : preferences.email_match_alerts !== false;
    if (emailEnabled) channels.push("email");
    if (preferences.browser_push === true) channels.push("browser_push");
    return Object.freeze({
      channels: Object.freeze(channels),
      immediate: CRITICAL.has(type) || preferences.digest_mode !== "daily"
    });
  } catch (error) {
    console.error("[DDD Notifications] Unable to resolve delivery channels", { error_type: String(error?.name || "Error") });
    throw error;
  }
}

export function notificationRow(raw) {
  try {
    if (!TYPES.has(raw?.type)) throw new Error("Notification type is invalid.");
    if (!CHANNELS.has(raw?.channel)) throw new Error("Notification channel is invalid.");
    const payload = raw?.payload && typeof raw.payload === "object" ? raw.payload : {};
    return Object.freeze({
      id: String(raw.id),
      user_id: String(raw.user_id),
      table_match_id: raw.table_match_id || null,
      event_id: raw.event_id || null,
      type: raw.type,
      channel: raw.channel,
      state: raw.state || "queued",
      payload,
      expires_at: raw.expires_at || null
    });
  } catch (error) {
    console.error("[DDD Notifications] Unable to build notification row", { error_type: String(error?.name || "Error") });
    throw error;
  }
}
