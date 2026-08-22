(() => {
  "use strict";

  const ROLE_NAMES = Object.freeze({ player: "Player", gm: "DM", venue_manager: "Venue" });

  function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function acceptedRoles(item) {
    return Object.entries(item.your_responses || {})
      .filter(([, decision]) => decision === "accepted")
      .map(([role]) => role);
  }

  function dateLabel(item) {
    try {
      const start = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium", timeStyle: "short", timeZone: item.timezone
      }).format(new Date(item.proposed_start));
      return start;
    } catch { return String(item.proposed_start || ""); }
  }

  function actionFor(item, roles) {
    if (item.event_id) {
      const link = el("a", "button primary", "Open Game Hub");
      link.href = `game-hub.html?event=${encodeURIComponent(item.event_id)}`;
      return link;
    }
    if (roles.includes("gm")) {
      const link = el("a", "button primary", "Finish Event Setup");
      link.href = `create-game.html?table_match_id=${encodeURIComponent(item.id)}`;
      return link;
    }
    return el("p", "microcopy", "The DM is finishing the game details. Your spot stays confirmed.");
  }

  function card(item) {
    const roles = acceptedRoles(item);
    const root = el("article", "status-panel game-on-card");
    root.dataset.matchId = item.id;
    root.append(el("p", "eyebrow game-on-label", "💥 GAME ON"));
    const system = [item.system?.name, item.system?.edition].filter(Boolean).join(" · ") || "Tabletop RPG";
    root.append(el("h2", "", system));
    const facts = el("div", "game-on-facts");
    facts.append(
      el("p", "", `📅 ${dateLabel(item)}`),
      el("p", "", `📍 ${item.venue?.name || "Public Venue"} · ${item.venue?.city || ""}, ${item.venue?.state_region || ""}`),
      el("p", "", `✓ Your role: ${roles.map((role) => ROLE_NAMES[role] || role).join(" + ")}`)
    );
    if (roles.includes("venue_manager")) facts.append(el("p", "", "✓ Reserved from your Venue availability"));
    root.append(facts);
    const actions = el("div", "dashboard-actions");
    actions.append(actionFor(item, roles));
    root.append(actions);
    const reminderRoot = el("div", "game-reminder-panel");
    reminderRoot.append(el("p", "microcopy", "Loading your reminders…"));
    root.append(reminderRoot);
    void window.DDDGameReminders?.render?.(item.id, reminderRoot);
    return root;
  }

  function render(items) {
    const section = document.getElementById("game-on-section");
    const list = document.getElementById("game-on-list");
    if (!section || !list) return;
    const accepted = (items || []).filter((item) =>
      ["forming", "converted"].includes(item.status) && acceptedRoles(item).length
    );
    list.replaceChildren();
    if (!accepted.length) {
      section.hidden = true;
      return;
    }
    accepted.sort((a, b) => new Date(a.proposed_start) - new Date(b.proposed_start));
    accepted.forEach((item) => list.append(card(item)));
    section.hidden = false;
  }

  window.DDDGameCards = Object.freeze({ render });
})();
