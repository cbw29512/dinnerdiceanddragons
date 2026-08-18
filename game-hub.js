(() => {
  "use strict";

  const ROLE_LABELS = Object.freeze({
    gm: "Dungeon Master",
    player: "Player",
    venue_manager: "Venue Manager"
  });
  const ROLE_VIEW_IDS = Object.freeze({
    gm: "gm-view",
    player: "player-view",
    venue_manager: "venue-view"
  });
  const ROLE_CHANNELS = Object.freeze({
    gm: ["table_announcement", "table_discussion", "gm_venue", "player_gm"],
    player: ["table_announcement", "table_discussion", "player_gm", "player_venue_question"],
    venue_manager: ["table_announcement", "gm_venue", "player_venue_question"]
  });
  const CHANNEL_LABELS = Object.freeze({
    table_announcement: "Announcements",
    table_discussion: "Table Discussion",
    gm_venue: "DM ↔ Venue",
    player_gm: "Player ↔ DM",
    player_venue_question: "Player ↔ Venue"
  });
  const CATEGORY_LABELS = Object.freeze({
    accessibility: "Accessibility",
    food_allergies: "Food / allergies",
    parking: "Parking",
    seating: "Seating",
    venue_policy: "Venue policy",
    other: "Other"
  });
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const state = {
    eventId: "",
    hub: null,
    messages: [],
    nextCursor: "",
    role: ""
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const node = byId(id);
    if (node) node.textContent = value == null ? "" : String(value);
  }

  function setStatus(message, kind = "") {
    const node = byId("hub-status");
    if (!node) return;
    node.textContent = message;
    node.classList.toggle("error-message", kind === "error");
    node.classList.toggle("success-message", kind === "success");
  }

  function setVisible(id, visible) {
    const node = byId(id);
    if (node) node.hidden = !visible;
  }

  function eventIdFromUrl() {
    const value = new URLSearchParams(window.location.search).get("event") || "";
    return UUID_PATTERN.test(value) ? value : "";
  }

  function requestedRole() {
    const value = new URLSearchParams(window.location.search).get("role") || "";
    return Object.hasOwn(ROLE_LABELS, value) ? value : "";
  }

  function formatDateTime(value) {
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
  }

  function humanize(value) {
    return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function showError(title, copy) {
    setVisible("hub-loading", false);
    setVisible("hub-index", false);
    setVisible("hub-content", false);
    setVisible("hub-error", true);
    setText("hub-error-title", title);
    setText("hub-error-copy", copy);
    setStatus(copy, "error");
  }

  async function initialize() {
    try {
      if (!window.DDDProductionAuth || !window.DDDProductionAPI) {
        showError("Game Hub is unavailable.", "The production authentication client did not load.");
        return;
      }
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (!session) {
        showError("Sign in to open your Game Hubs.", "Use the account connected to your confirmed table, DM role, or verified Venue.");
        return;
      }
      state.eventId = eventIdFromUrl();
      if (state.eventId) await loadHub();
      else await loadHubIndex();
    } catch (error) {
      handleApiError(error, "Game Hub could not be loaded.");
    }
  }

  async function loadHubIndex() {
    setVisible("hub-loading", true);
    setVisible("hub-error", false);
    setVisible("hub-content", false);
    setVisible("hub-index", false);
    setText("hub-title", "Your game nights, in one place.");
    setText("hub-lede", "Choose a confirmed table where you participate as a Player, Dungeon Master, or verified Venue Manager.");
    setStatus("Loading your Game Hubs…");

    const hubs = await window.DDDProductionAPI.getGameHubs();
    const grid = byId("hub-index-grid");
    if (grid) grid.replaceChildren();
    for (const item of hubs) {
      if (grid) grid.append(buildHubCard(item));
    }
    if (grid && hubs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "panel empty-state";
      const heading = document.createElement("h3");
      heading.textContent = "No live Game Hubs yet.";
      const copy = document.createElement("p");
      copy.textContent = "A Hub appears after a matched table is formed and you are the DM, a confirmed Player, or a verified manager of its Venue.";
      const link = document.createElement("a");
      link.className = "button primary";
      link.href = "index.html#shared-games";
      link.textContent = "Find a Table";
      empty.append(heading, copy, link);
      grid.append(empty);
    }
    setText("hub-status-value", `${hubs.length} Hub${hubs.length === 1 ? "" : "s"}`);
    setText("hub-headcount", "—");
    setText("hub-venue", "—");
    setText("hub-time", "—");
    setVisible("hub-loading", false);
    setVisible("hub-index", true);
    setStatus(hubs.length ? "Choose a Game Hub." : "No live Game Hubs found.");
  }

  function buildHubCard(item) {
    const card = document.createElement("article");
    card.className = "game-card hub-index-card";
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = `${humanize(item.status)} · ${item.system_name}${item.system_edition ? ` ${item.system_edition}` : ""}`;
    const heading = document.createElement("h3");
    heading.textContent = item.title;
    const meta = document.createElement("p");
    meta.className = "game-meta";
    meta.textContent = `${formatDateTime(item.starts_at)} · ${item.venue_name}, ${item.venue_city}, ${item.venue_state_region}`;
    const link = document.createElement("a");
    link.className = "button primary";
    link.href = `game-hub.html?event=${encodeURIComponent(item.event_id)}`;
    link.textContent = "Open Live Game Hub";
    card.append(eyebrow, heading, meta, link);
    return card;
  }

  async function loadHub() {
    setVisible("hub-loading", true);
    setVisible("hub-error", false);
    setVisible("hub-index", false);
    setVisible("hub-content", false);
    setStatus("Loading live Event and communication state…");

    const [hub, page] = await Promise.all([
      window.DDDProductionAPI.getGameHub(state.eventId),
      window.DDDProductionAPI.getHubMessages(state.eventId, { limit: 50 })
    ]);
    state.hub = hub;
    state.messages = page.items || [];
    state.nextCursor = page.next_cursor || "";
    state.role = chooseInitialRole(hub.capabilities.viewer_roles || []);
    renderHub();
    setVisible("hub-loading", false);
    setVisible("hub-content", true);
    setStatus("Live Game Hub loaded.", "success");
  }

  function chooseInitialRole(roles) {
    const preferred = requestedRole();
    if (preferred && roles.includes(preferred)) return preferred;
    return roles[0] || "";
  }

  function renderHub() {
    const event = state.hub.event;
    document.title = `${event.title} Game Hub | Dinner, Dice & Dragons`;
    setText("hub-title", event.title);
    setText("hub-lede", "Live table logistics, commitments, Venue coordination, and role-scoped communication.");
    setText("hub-status-value", humanize(event.status));
    setText("hub-headcount", event.booking.expected_guests);
    setText("hub-venue", event.venue_name);
    setText("hub-time", formatDateTime(event.starts_at));
    setText("event-system", `${event.system_name}${event.system_edition ? ` · ${event.system_edition}` : ""}`);
    setText("event-title", event.title);
    setText("event-description", event.description);
    setText("event-venue-name", event.venue_name);
    setText("event-venue-locality", `${event.venue_city}, ${event.venue_state_region}`);
    setText("event-schedule", `${formatDateTime(event.starts_at)} – ${formatDateTime(event.ends_at)}`);
    renderExpectations(event.expectations || {});
    renderRoleButtons();
    renderGmView();
    renderPlayerView();
    renderVenueView();
    showRole(state.role, false);
  }

  function renderExpectations(expectations) {
    const list = byId("event-expectations");
    if (!list) return;
    list.replaceChildren();
    const fields = [
      ["Play style", expectations.play_style],
      ["Boundaries", expectations.boundaries],
      ["PvP", expectations.pvp_policy],
      ["Homebrew", expectations.homebrew_policy],
      ["Safety", expectations.safety_framework],
      ["Accessibility", expectations.accessibility_notes]
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
    const container = byId("hub-role-switch");
    if (!container) return;
    container.replaceChildren();
    const roles = state.hub.capabilities.viewer_roles || [];
    for (const role of roles) {
      const button = document.createElement("button");
      button.className = "button secondary hub-role-button";
      button.type = "button";
      button.dataset.role = role;
      button.setAttribute("aria-pressed", String(role === state.role));
      button.textContent = ROLE_LABELS[role] || humanize(role);
      button.addEventListener("click", () => showRole(role));
      container.append(button);
    }
    container.hidden = roles.length < 2;
  }

  function showRole(role, announce = true) {
    if (!state.hub?.capabilities?.viewer_roles?.includes(role)) return;
    state.role = role;
    for (const [knownRole, viewId] of Object.entries(ROLE_VIEW_IDS)) {
      setVisible(viewId, knownRole === role);
    }
    document.querySelectorAll(".hub-role-button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.role === role));
    });
    const url = new URL(window.location.href);
    url.searchParams.set("event", state.eventId);
    url.searchParams.set("role", role);
    history.replaceState({}, "", url);
    renderMessageChannels();
    if (announce) setStatus(`${ROLE_LABELS[role]} view active.`);
  }

  function renderGmView() {
    const queue = byId("gm-registration-queue");
    if (queue) queue.replaceChildren();
    const items = state.hub.registration_queue || [];
    if (queue && items.length === 0) appendEmpty(queue, "No pending or committed Player rows are available.");
    for (const item of items) {
      if (queue) queue.append(buildRegistrationRow(item));
    }
    const booking = state.hub.event.booking;
    setText("gm-booking-summary", `${humanize(booking.status)} · ${booking.expected_guests} expected guest${booking.expected_guests === 1 ? "" : "s"}`);
  }

  function buildRegistrationRow(item) {
    const row = document.createElement("div");
    row.className = "hub-registration-row";
    const summary = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.display_name;
    const status = document.createElement("div");
    status.className = "hub-muted";
    status.textContent = `${humanize(item.status)} · requested ${formatDateTime(item.requested_at)}`;
    summary.append(name, status);
    const actions = document.createElement("div");
    actions.className = "hub-registration-actions";
    if (["requested", "waitlisted"].includes(item.status)) {
      actions.append(actionButton("Confirm", () => mutateRegistration(item.registration_id, "confirm")));
      actions.append(actionButton("Decline", () => mutateRegistration(item.registration_id, "decline"), "secondary"));
    } else if (item.status === "confirmed") {
      actions.append(actionButton("Remove", () => mutateRegistration(item.registration_id, "remove"), "secondary"));
    }
    row.append(summary, actions);
    return row;
  }

  function renderPlayerView() {
    const registration = state.hub.event.your_registration;
    setText("player-seat-summary", registration ? `Your seat is ${humanize(registration.status)}.` : "No active Player registration is attached to this view.");
    const cancel = byId("cancel-seat");
    if (cancel) {
      cancel.hidden = !registration || registration.status !== "confirmed";
      cancel.onclick = cancel.hidden ? null : cancelSeat;
    }
    const form = byId("venue-question-form");
    if (form) {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        await sendMessage({
          channel_type: "player_venue_question",
          category: String(data.get("category") || "other"),
          body: String(data.get("body") || "").trim()
        }, form);
      };
    }
  }

  function renderVenueView() {
    const booking = state.hub.event.booking;
    setText("venue-headcount-summary", `${booking.expected_guests} expected guest${booking.expected_guests === 1 ? "" : "s"} for this Event.`);
    const container = byId("venue-booking-actions");
    if (!container) return;
    container.replaceChildren();
    if (["requested", "question"].includes(booking.status)) {
      container.append(actionButton("Approve", () => mutateBooking("approve")));
      container.append(actionButton("Ask Question", () => mutateBooking("question"), "secondary"));
      container.append(actionButton("Decline", () => mutateBooking("decline"), "secondary"));
    } else if (booking.status === "approved") {
      container.append(actionButton("Cancel Venue Booking", () => mutateBooking("cancel"), "secondary"));
    } else {
      appendEmpty(container, `Booking is ${humanize(booking.status)}.`);
    }
  }

  function actionButton(label, handler, variant = "primary") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `button ${variant}`;
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function renderMessageChannels() {
    const grid = byId("message-channel-grid");
    if (!grid) return;
    grid.replaceChildren();
    for (const channel of ROLE_CHANNELS[state.role] || []) {
      grid.append(buildChannel(channel));
    }
    const loadOlder = byId("load-older-messages");
    if (loadOlder) {
      loadOlder.hidden = !state.nextCursor;
      loadOlder.onclick = state.nextCursor ? loadOlderMessages : null;
    }
  }

  function buildChannel(channel) {
    const panel = document.createElement("section");
    panel.className = "hub-channel";
    const heading = document.createElement("h3");
    heading.textContent = CHANNEL_LABELS[channel] || humanize(channel);
    const list = document.createElement("div");
    list.className = "hub-message-list";
    list.dataset.channel = channel;
    const messages = state.messages.filter((item) => item.channel_type === channel);
    if (messages.length === 0) appendEmpty(list, "No messages in this channel yet.");
    for (const message of messages) list.append(buildMessageItem(message, channel));
    panel.append(heading, list);

    if (canPostChannel(channel) && !(state.role === "player" && channel === "player_venue_question")) {
      panel.append(buildMessageForm(channel));
    }
    return panel;
  }

  function buildMessageItem(message, channel) {
    const item = document.createElement("article");
    item.className = "hub-message-item";
    const meta = document.createElement("div");
    meta.className = "hub-message-meta";
    const category = message.category ? ` · ${CATEGORY_LABELS[message.category] || humanize(message.category)}` : "";
    meta.textContent = `${message.sender_display_name} · ${humanize(message.sender_role)}${category} · ${formatDateTime(message.created_at)}`;
    const body = document.createElement("p");
    body.textContent = message.body;
    item.append(meta, body);

    const canReply = message.reply_registration_id && (
      (state.role === "gm" && channel === "player_gm") ||
      (state.role === "venue_manager" && channel === "player_venue_question")
    );
    if (canReply) {
      const actions = document.createElement("div");
      actions.className = "hub-message-actions";
      actions.append(actionButton(`Reply to ${message.sender_display_name}`, () => startReply(channel, message), "secondary"));
      item.append(actions);
    }
    return item;
  }

  function canPostChannel(channel) {
    return (state.hub.capabilities.post_channels || []).includes(channel) &&
      (ROLE_CHANNELS[state.role] || []).includes(channel);
  }

  function buildMessageForm(channel) {
    const form = document.createElement("form");
    form.className = "quick-message";
    form.dataset.channel = channel;
    const replyContext = document.createElement("div");
    replyContext.className = "hub-reply-context";
    replyContext.hidden = true;
    form.append(replyContext);

    if (channel === "player_venue_question") {
      const label = document.createElement("label");
      label.textContent = "Category";
      const select = document.createElement("select");
      select.name = "category";
      for (const [value, text] of Object.entries(CATEGORY_LABELS)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        select.append(option);
      }
      label.append(select);
      form.append(label);
    }

    const label = document.createElement("label");
    label.textContent = "Message";
    const textarea = document.createElement("textarea");
    textarea.name = "body";
    textarea.rows = 3;
    textarea.maxLength = 4000;
    textarea.required = true;
    label.append(textarea);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "button primary";
    submit.textContent = "Send Message";
    form.append(label, submit);

    const requiresTarget = (state.role === "gm" && channel === "player_gm") ||
      (state.role === "venue_manager" && channel === "player_venue_question");
    if (requiresTarget) form.hidden = true;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body) {
        textarea.focus();
        setStatus("Type a message first.", "error");
        return;
      }
      const payload = { channel_type: channel, body };
      const select = form.querySelector("select[name='category']");
      if (select) payload.category = select.value;
      if (form.dataset.registrationId) payload.registration_id = form.dataset.registrationId;
      await sendMessage(payload, form);
    });
    return form;
  }

  function startReply(channel, message) {
    const form = document.querySelector(`form[data-channel="${channel}"]`);
    if (!form) return;
    form.hidden = false;
    form.dataset.registrationId = message.reply_registration_id;
    const context = form.querySelector(".hub-reply-context");
    if (context) {
      context.replaceChildren();
      const text = document.createElement("span");
      text.textContent = `Replying to ${message.sender_display_name}.`;
      const clear = document.createElement("button");
      clear.type = "button";
      clear.className = "button secondary";
      clear.textContent = "Cancel Reply";
      clear.addEventListener("click", () => {
        delete form.dataset.registrationId;
        form.hidden = true;
      });
      context.append(text, clear);
      context.hidden = false;
    }
    form.querySelector("textarea")?.focus();
  }

  async function sendMessage(payload, form) {
    try {
      setStatus("Sending message…");
      await window.DDDProductionAPI.postHubMessage(state.eventId, payload);
      form?.reset();
      if (form?.dataset.registrationId) delete form.dataset.registrationId;
      await refreshMessages();
      setStatus("Message sent.", "success");
    } catch (error) {
      handleApiError(error, "Message could not be sent.");
    }
  }

  async function refreshMessages() {
    const page = await window.DDDProductionAPI.getHubMessages(state.eventId, { limit: 50 });
    state.messages = page.items || [];
    state.nextCursor = page.next_cursor || "";
    renderMessageChannels();
  }

  async function loadOlderMessages() {
    try {
      if (!state.nextCursor) return;
      const page = await window.DDDProductionAPI.getHubMessages(state.eventId, { limit: 50, cursor: state.nextCursor });
      const known = new Set(state.messages.map((item) => item.id));
      for (const item of page.items || []) if (!known.has(item.id)) state.messages.push(item);
      state.nextCursor = page.next_cursor || "";
      renderMessageChannels();
      setStatus("Older messages loaded.", "success");
    } catch (error) {
      handleApiError(error, "Older messages could not be loaded.");
    }
  }

  async function mutateRegistration(registrationId, action) {
    try {
      setStatus(`${humanize(action)}ing Player registration…`);
      await window.DDDProductionAPI.decideRegistration(state.eventId, registrationId, action);
      await reloadHubState();
      setStatus(`Player registration ${humanize(action)} action completed.`, "success");
    } catch (error) {
      handleApiError(error, "Player registration could not be updated.");
    }
  }

  async function cancelSeat() {
    try {
      setStatus("Cancelling your seat…");
      await window.DDDProductionAPI.cancelMyRegistration(state.eventId);
      history.replaceState({}, "", "game-hub.html");
      state.eventId = "";
      state.hub = null;
      await loadHubIndex();
      setStatus("Your seat was cancelled.", "success");
    } catch (error) {
      handleApiError(error, "Your seat could not be cancelled.");
    }
  }

  async function mutateBooking(action) {
    try {
      const booking = state.hub.event.booking;
      setStatus(`${humanize(action)}ing Venue booking…`);
      await window.DDDProductionAPI.decideVenueBooking(booking.id, action);
      await reloadHubState();
      setStatus(`Venue booking ${humanize(action)} action completed.`, "success");
    } catch (error) {
      handleApiError(error, "Venue booking could not be updated.");
    }
  }

  async function reloadHubState() {
    state.hub = await window.DDDProductionAPI.getGameHub(state.eventId);
    if (!state.hub.capabilities.viewer_roles.includes(state.role)) {
      state.role = chooseInitialRole(state.hub.capabilities.viewer_roles);
    }
    renderHub();
  }

  function appendEmpty(container, text) {
    const node = document.createElement("p");
    node.className = "hub-empty";
    node.textContent = text;
    container.append(node);
  }

  function handleApiError(error, fallback) {
    const status = Number(error?.status || 0);
    if (status === 401) {
      showError("Your session has expired.", "Sign in again to reopen your private Game Hubs.");
      return;
    }
    if (status === 403) {
      setStatus(error?.message || fallback, "error");
      return;
    }
    if (status === 404) {
      showError("This Game Hub is not available.", "It may have been cancelled, your role may have changed, or this account is not a confirmed participant.");
      return;
    }
    setStatus(error?.message || fallback, "error");
  }

  try {
    initialize();
  } catch (error) {
    handleApiError(error, "Game Hub could not initialize.");
  }
})();
