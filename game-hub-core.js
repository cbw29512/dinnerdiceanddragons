(() => {
  "use strict";

  const runtime = {
    ROLE_LABELS: Object.freeze({
      gm: "Dungeon Master",
      player: "Player",
      venue_manager: "Venue Manager"
    }),
    ROLE_VIEW_IDS: Object.freeze({
      gm: "gm-view",
      player: "player-view",
      venue_manager: "venue-view"
    }),
    ROLE_CHANNELS: Object.freeze({
      gm: ["table_announcement", "table_discussion", "gm_venue", "player_gm"],
      player: ["table_announcement", "table_discussion", "player_gm", "player_venue_question"],
      venue_manager: ["table_announcement", "gm_venue", "player_venue_question"]
    }),
    CHANNEL_LABELS: Object.freeze({
      table_announcement: "Announcements",
      table_discussion: "Table Discussion",
      gm_venue: "DM ↔ Venue",
      player_gm: "Player ↔ DM",
      player_venue_question: "Player ↔ Venue"
    }),
    CATEGORY_LABELS: Object.freeze({
      accessibility: "Accessibility",
      food_allergies: "Food / allergies",
      parking: "Parking",
      seating: "Seating",
      venue_policy: "Venue policy",
      other: "Other"
    }),
    state: {
      eventId: "",
      hub: null,
      messages: [],
      nextCursor: "",
      role: ""
    },
    UUID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  };

  runtime.byId = (id) => document.getElementById(id);
  runtime.setText = (id, value) => {
    const node = runtime.byId(id);
    if (node) node.textContent = value == null ? "" : String(value);
  };
  runtime.setVisible = (id, visible) => {
    const node = runtime.byId(id);
    if (node) node.hidden = !visible;
  };
  runtime.setStatus = (message, kind = "") => {
    const node = runtime.byId("hub-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error-message", kind === "error");
    node.classList.toggle("success-message", kind === "success");
  };
  runtime.eventIdFromUrl = () => {
    const value = new URLSearchParams(window.location.search).get("event") || "";
    return runtime.UUID_PATTERN.test(value) ? value : "";
  };
  runtime.requestedRole = () => {
    const value = new URLSearchParams(window.location.search).get("role") || "";
    return Object.hasOwn(runtime.ROLE_LABELS, value) ? value : "";
  };
  runtime.formatDateTime = (value) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
      }).format(new Date(value));
    } catch {
      return String(value || "");
    }
  };
  runtime.humanize = (value) => String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  runtime.appendEmpty = (container, text) => {
    const node = document.createElement("p");
    node.className = "hub-empty";
    node.textContent = text;
    container.append(node);
  };
  runtime.actionButton = (label, handler, variant = "primary") => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${variant}`;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  };
  runtime.showError = (title, copy) => {
    runtime.setVisible("hub-loading", false);
    runtime.setVisible("hub-index", false);
    runtime.setVisible("hub-content", false);
    runtime.setVisible("hub-error", true);
    runtime.setText("hub-error-title", title);
    runtime.setText("hub-error-copy", copy);
    runtime.setStatus(copy, "error");
  };
  runtime.handleApiError = (error, fallback) => {
    const status = Number(error?.status || 0);
    if (status === 401) {
      runtime.showError("Your session has expired.", "Sign in again to reopen your private Game Hubs.");
      return;
    }
    if (status === 404) {
      runtime.showError("This Game Hub is not available.", "It may have been cancelled, your role may have changed, or this account is not a confirmed participant.");
      return;
    }
    runtime.setStatus(error?.message || fallback, "error");
  };

  window.DDDGameHubRuntime = runtime;
})();
