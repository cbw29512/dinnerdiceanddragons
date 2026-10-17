(() => {
  "use strict";

  const TYPE_LABELS = Object.freeze({
    match_available: "A table fits your schedule",
    seat_offered: "A seat is available",
    table_formed: "💥 Table formed",
    waitlist_promoted: "A waitlist seat opened",
    event_disrupted: "Your Event needs a replacement",
    event_cancelled: "Event cancelled",
    event_changed: "Event details changed",
    attendance_reminder: "Game night reminder"
  });

  function byId(id) { return document.getElementById(id); }

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function formatTime(value) {
    try { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : ""; }
    catch { return String(value || ""); }
  }

  async function markRead(item) {
    try {
      if (["read", "acted", "expired", "cancelled"].includes(item.state)) return;
      await window.DDDProductionAPI.markNotification(item.id, "read");
      window.dispatchEvent(new CustomEvent("ddd:notifications-changed"));
    } catch (error) {
      console.error("[DDD Notifications] Unable to mark notification read", error);
    }
  }

  function actionLink(item) {
    const payload = item.payload || {};
    if (payload.match_id) {
      const link = element("a", "button primary", item.type === "table_formed" ? "Review Table" : "Review Match");
      const params = new URLSearchParams({ match: payload.match_id });
      if (payload.role) params.set("role", payload.role);
      link.href = `opportunity.html?${params}`;
      link.addEventListener("click", () => { void markRead(item); });
      return link;
    }
    if (payload.event_id) {
      const link = element("a", "button primary", "Open Game Hub");
      link.href = `game-hub.html?event=${encodeURIComponent(payload.event_id)}`;
      link.addEventListener("click", () => { void markRead(item); });
      return link;
    }
    return null;
  }

  function renderItems(items) {
    const list = byId("notification-list");
    list.replaceChildren();
    if (!items.length) {
      list.append(element("div", "panel notification-empty", "No notifications yet. DDD will alert you here when a compatible table or Event update is available."));
      return;
    }
    for (const item of items) {
      const card = element("article", `panel notification-card ${["read", "acted"].includes(item.state) ? "is-read" : ""}`);
      card.dataset.notificationType = item.type;
      card.append(
        element("p", "eyebrow", String(item.type).replaceAll("_", " ").toUpperCase()),
        element("h2", "", TYPE_LABELS[item.type] || "DDD notification")
      );
      const meta = element("div", "notification-meta");
      meta.append(element("span", "", formatTime(item.created_at)));
      if (item.expires_at) meta.append(element("span", "", `Respond by ${formatTime(item.expires_at)}`));
      card.append(meta);
      const action = actionLink(item);
      if (action) {
        const actions = element("div", "notification-actions");
        actions.append(action);
        card.append(actions);
      }
      list.append(card);
    }
  }

  async function loadPreferences() {
    const prefs = await window.DDDProductionAPI.getNotificationPreferences();
    const toggle = byId("matching-paused");
    if (toggle) toggle.checked = Boolean(prefs.matching_paused);
    return prefs;
  }

  async function savePause(current) {
    try {
      const toggle = byId("matching-paused");
      const next = { ...current, matching_paused: Boolean(toggle?.checked) };
      await window.DDDProductionAPI.putNotificationPreferences(next);
      byId("preference-status").textContent = next.matching_paused ? "Matching alerts paused. Your saved availability was not deleted." : "Matching alerts active.";
      return next;
    } catch (error) {
      console.error("[DDD Notifications] Unable to save matching pause", error);
      byId("preference-status").textContent = error?.message || "Preference could not be saved.";
      return current;
    }
  }

  async function init() {
    try {
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (!session) {
        byId("notification-status").textContent = "Sign in to see your DDD notifications.";
        return;
      }
      const [items, initialPrefs] = await Promise.all([
        window.DDDProductionAPI.getNotifications(),
        loadPreferences()
      ]);
      renderItems(items || []);
      let prefs = initialPrefs;
      byId("matching-paused")?.addEventListener("change", async () => { prefs = await savePause(prefs); });
      byId("notification-status").textContent = "DDD handles match coordination here without exposing private contact information.";
    } catch (error) {
      console.error("[DDD Notifications] Unable to load notification center", error);
      byId("notification-status").textContent = error?.message || "Notifications could not be loaded.";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
