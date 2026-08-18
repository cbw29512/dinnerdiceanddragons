(() => {
  "use strict";

  const rt = window.DDDGameHubRuntime;

  function renderChannels() {
    const grid = rt.byId("message-channel-grid");
    if (!grid) return;
    grid.replaceChildren();
    for (const channel of rt.ROLE_CHANNELS[rt.state.role] || []) {
      grid.append(buildChannel(channel));
    }
    const older = rt.byId("load-older-messages");
    if (older) {
      older.hidden = !rt.state.nextCursor;
      older.onclick = rt.state.nextCursor ? loadOlderMessages : null;
    }
  }

  function buildChannel(channel) {
    const panel = document.createElement("section");
    panel.className = "hub-channel";
    const heading = document.createElement("h3");
    heading.textContent = rt.CHANNEL_LABELS[channel] || rt.humanize(channel);
    const list = document.createElement("div");
    list.className = "hub-message-list";
    list.dataset.channel = channel;
    const messages = rt.state.messages.filter((item) => item.channel_type === channel);
    if (messages.length === 0) rt.appendEmpty(list, "No messages in this channel yet.");
    for (const message of messages) list.append(buildMessageItem(message, channel));
    panel.append(heading, list);
    if (canPost(channel) && !(rt.state.role === "player" && channel === "player_venue_question")) {
      panel.append(buildMessageForm(channel));
    }
    return panel;
  }

  function buildMessageItem(message, channel) {
    const item = document.createElement("article");
    item.className = "hub-message-item";
    const meta = document.createElement("div");
    meta.className = "hub-message-meta";
    const category = message.category
      ? ` · ${rt.CATEGORY_LABELS[message.category] || rt.humanize(message.category)}`
      : "";
    meta.textContent = `${message.sender_display_name} · ${rt.humanize(message.sender_role)}${category} · ${rt.formatDateTime(message.created_at)}`;
    const body = document.createElement("p");
    body.textContent = message.body;
    item.append(meta, body);

    const canReply = message.reply_registration_id && (
      (rt.state.role === "gm" && channel === "player_gm") ||
      (rt.state.role === "venue_manager" && channel === "player_venue_question")
    );
    if (canReply) {
      const actions = document.createElement("div");
      actions.className = "hub-message-actions";
      actions.append(
        rt.actionButton(
          `Reply to ${message.sender_display_name}`,
          () => startReply(channel, message),
          "secondary"
        )
      );
      item.append(actions);
    }
    return item;
  }

  function canPost(channel) {
    return (rt.state.hub.capabilities.post_channels || []).includes(channel)
      && (rt.ROLE_CHANNELS[rt.state.role] || []).includes(channel);
  }

  function buildMessageForm(channel) {
    const form = document.createElement("form");
    form.className = "quick-message";
    form.dataset.channel = channel;
    const context = document.createElement("div");
    context.className = "hub-reply-context";
    context.hidden = true;
    form.append(context);

    if (channel === "player_venue_question") {
      const label = document.createElement("label");
      label.textContent = "Category";
      const select = document.createElement("select");
      select.name = "category";
      for (const [value, text] of Object.entries(rt.CATEGORY_LABELS)) {
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

    const targeted = (rt.state.role === "gm" && channel === "player_gm")
      || (rt.state.role === "venue_manager" && channel === "player_venue_question");
    if (targeted) form.hidden = true;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const body = textarea.value.trim();
      if (!body) {
        textarea.focus();
        rt.setStatus("Type a message first.", "error");
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
      const clear = rt.actionButton("Cancel Reply", () => {
        delete form.dataset.registrationId;
        form.hidden = true;
      }, "secondary");
      context.append(text, clear);
      context.hidden = false;
    }
    form.querySelector("textarea")?.focus();
  }

  async function sendMessage(payload, form) {
    try {
      rt.setStatus("Sending message…");
      await window.DDDProductionAPI.postHubMessage(rt.state.eventId, payload);
      form?.reset();
      if (form?.dataset.registrationId) delete form.dataset.registrationId;
      await refreshMessages();
      rt.setStatus("Message sent.", "success");
    } catch (error) {
      rt.handleApiError(error, "Message could not be sent.");
    }
  }

  async function refreshMessages() {
    const page = await window.DDDProductionAPI.getHubMessages(rt.state.eventId, { limit: 50 });
    rt.state.messages = page.items || [];
    rt.state.nextCursor = page.next_cursor || "";
    renderChannels();
  }

  async function loadOlderMessages() {
    try {
      if (!rt.state.nextCursor) return;
      const page = await window.DDDProductionAPI.getHubMessages(rt.state.eventId, {
        limit: 50,
        cursor: rt.state.nextCursor
      });
      const known = new Set(rt.state.messages.map((item) => item.id));
      for (const item of page.items || []) {
        if (!known.has(item.id)) rt.state.messages.push(item);
      }
      rt.state.nextCursor = page.next_cursor || "";
      renderChannels();
      rt.setStatus("Older messages loaded.", "success");
    } catch (error) {
      rt.handleApiError(error, "Older messages could not be loaded.");
    }
  }

  window.DDDGameHubMessages = Object.freeze({ renderChannels, sendMessage });
})();
