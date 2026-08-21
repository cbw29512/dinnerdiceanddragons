(() => {
  "use strict";

  function ensureLink() {
    try {
      let link = document.getElementById("ddd-notifications-link");
      if (link) return link;
      const account = document.getElementById("ddd-global-account-button");
      if (!account?.parentElement) return null;
      link = document.createElement("a");
      link.id = "ddd-notifications-link";
      link.className = "ddd-notification-link";
      link.href = "notifications.html";
      link.setAttribute("aria-label", "Notifications");
      link.textContent = "🔔";
      link.hidden = true;
      account.parentElement.insertBefore(link, account);
      return link;
    } catch (error) {
      console.error("[DDD Notifications] Unable to create notification link", error);
      return null;
    }
  }

  async function refresh() {
    try {
      const link = ensureLink();
      if (!link || !window.DDDProductionAuth || !window.DDDProductionAPI) return;
      const session = await window.DDDProductionAuth.getSession();
      link.hidden = !session;
      if (!session) return;
      const items = await window.DDDProductionAPI.getNotifications();
      const unread = (items || []).filter((item) => !["read", "acted", "expired", "cancelled"].includes(item.state)).length;
      link.textContent = unread ? `🔔 ${unread}` : "🔔";
      link.setAttribute("aria-label", unread ? `Notifications, ${unread} unread` : "Notifications");
    } catch (error) {
      console.error("[DDD Notifications] Unable to refresh notification badge", error);
    }
  }

  function init() {
    ensureLink();
    window.setTimeout(() => { void refresh(); }, 0);
    window.addEventListener("ddd:auth-change", () => { void refresh(); });
    window.addEventListener("ddd:notifications-changed", () => { void refresh(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
