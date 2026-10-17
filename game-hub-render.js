(() => {
  "use strict";

  const rt = window.DDDGameHubRuntime;

  function renderIndex(hubs) {
    const grid = rt.byId("hub-index-grid");
    if (grid) grid.replaceChildren();
    for (const item of hubs) if (grid) grid.append(buildHubCard(item));
    if (grid && hubs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel empty-state";
      const heading = document.createElement("h3");
      heading.textContent = "No live Game Hubs yet.";
      const copy = document.createElement("p");
      copy.textContent = "A Hub appears after a matched table is formed and you are the DM, a confirmed Player, or a verified manager of its Venue.";
      const link = document.createElement("a");
      link.className = "button primary";
      link.href = "join.html";
      link.textContent = "Find a Table";
      empty.append(heading, copy, link);
      grid.append(empty);
    }
    rt.setText("hub-status-value", `${hubs.length} Hub${hubs.length === 1 ? "" : "s"}`);
    rt.setText("hub-headcount", "—");
    rt.setText("hub-venue", "—");
    rt.setText("hub-time", "—");
    rt.setVisible("hub-loading", false);
    rt.setVisible("hub-index", true);
  }

  function buildHubCard(item) {
    const card = document.createElement("article");
    card.className = "game-card hub-index-card";
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = `${rt.humanize(item.status)} · ${item.system_name}${item.system_edition ? ` ${item.system_edition}` : ""}`;
    const heading = document.createElement("h3");
    heading.textContent = item.title;
    const meta = document.createElement("p");
    meta.className = "game-meta";
    meta.textContent = `${rt.formatDateTime(item.starts_at)} · ${item.venue_name}, ${item.venue_city}, ${item.venue_state_region}`;
    const link = document.createElement("a");
    link.className = "button primary";
    link.href = `game-hub.html?event=${encodeURIComponent(item.event_id)}`;
    link.textContent = "Open Game Hub";
    card.append(eyebrow, heading, meta, link);
    return card;
  }

  function venueLocation(event) {
    const lines = [event.venue_address_line1, event.venue_address_line2].filter(Boolean);
    const locality = [event.venue_city, event.venue_state_region, event.venue_postal_code].filter(Boolean).join(" ");
    return [...lines, locality].filter(Boolean).join(" · ");
  }

  function renderHub() {
    const event = rt.state.hub.event;
    document.title = `${event.title} Game Hub | Dinner, Dice & Dragons`;
    rt.setText("hub-title", event.title);
    rt.setText("hub-lede", "Live table logistics, commitments, public Venue details, announcements, and structured role actions.");
    rt.setText("hub-status-value", rt.humanize(event.status));
    rt.setText("hub-headcount", event.booking.expected_guests);
    rt.setText("hub-venue", event.venue_name);
    rt.setText("hub-time", rt.formatDateTime(event.starts_at));
    rt.setText("event-system", `${event.system_name}${event.system_edition ? ` · ${event.system_edition}` : ""}`);
    rt.setText("event-title", event.title);
    rt.setText("event-description", event.description);
    rt.setText("event-venue-name", event.venue_name);
    rt.setText("event-venue-locality", venueLocation(event));
    rt.setText("event-schedule", `${rt.formatDateTime(event.starts_at)} – ${rt.formatDateTime(event.ends_at)}`);
    renderExpectations(event.expectations || {});
    renderRoleButtons();
    window.DDDGameHubRoles.renderAll();
    showRole(rt.state.role, false);
  }

  function renderExpectations(expectations) {
    const list = rt.byId("event-expectations");
    if (!list) return;
    list.replaceChildren();
    const fields = [
      ["Play style", expectations.play_style], ["Boundaries", expectations.boundaries],
      ["PvP", expectations.pvp_policy], ["Homebrew", expectations.homebrew_policy],
      ["Safety", expectations.safety_framework], ["Accessibility", expectations.accessibility_notes]
    ];
    for (const [label, value] of fields) {
      if (!value) continue;
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = value;
      list.append(term, detail);
    }
  }

  function renderRoleButtons() {
    const container = rt.byId("hub-role-switch");
    if (!container) return;
    container.replaceChildren();
    const roles = rt.state.hub.capabilities.viewer_roles || [];
    for (const role of roles) {
      const button = document.createElement("button");
      button.className = "button secondary hub-role-button";
      button.type = "button";
      button.dataset.role = role;
      button.setAttribute("aria-pressed", String(role === rt.state.role));
      button.textContent = rt.ROLE_LABELS[role] || rt.humanize(role);
      button.addEventListener("click", () => showRole(role));
      container.append(button);
    }
    container.hidden = roles.length < 2;
  }

  function showRole(role, announce = true) {
    if (!rt.state.hub?.capabilities?.viewer_roles?.includes(role)) return;
    rt.state.role = role;
    for (const [knownRole, viewId] of Object.entries(rt.ROLE_VIEW_IDS)) rt.setVisible(viewId, knownRole === role);
    document.querySelectorAll(".hub-role-button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.role === role)));
    const url = new URL(window.location.href);
    url.searchParams.set("event", rt.state.eventId);
    url.searchParams.set("role", role);
    history.replaceState({}, "", url);
    window.DDDGameHubAnnouncements?.bind?.();
    if (announce) rt.setStatus(`${rt.ROLE_LABELS[role]} view active.`);
  }

  window.DDDGameHubRender = Object.freeze({ renderHub, renderIndex, showRole });
})();
