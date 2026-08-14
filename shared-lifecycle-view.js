(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function make(tag, text, className) {
    try {
      const node = document.createElement(tag);
      if (text !== undefined && text !== null) node.textContent = String(text);
      if (className) node.className = className;
      return node;
    } catch (error) {
      logError(`Unable to create ${tag}`, error);
      return document.createElement("span");
    }
  }

  function actionButton(label, onClick, secondary = false) {
    try {
      const button = make("button", label, `button ${secondary ? "secondary" : "primary"}`);
      button.type = "button";
      button.addEventListener("click", onClick);
      return button;
    } catch (error) {
      logError("Unable to create shared lifecycle action", error);
      return make("span");
    }
  }

  function hubLink(role) {
    try {
      const link = make("a", "Open Game Hub", "button primary");
      link.href = `game-hub.html?role=${encodeURIComponent(role)}`;
      return link;
    } catch (error) {
      logError("Unable to create Game Hub link", error);
      return make("span");
    }
  }

  function stateSummary(state) {
    try {
      return `${String(state.status || "forming").toUpperCase()} · Venue ${state.venue_approved ? "approved" : "pending"} · ${Number(state.confirmed_players || 0)}/${Number(state.min_players || 0)} minimum Players · ${Number(state.requested_players || 0)} requested · ${Number(state.waitlisted_players || 0)} waitlisted`;
    } catch (error) {
      logError("Unable to summarize shared game state", error);
      return "Shared state unavailable";
    }
  }

  function card(title, eyebrow) {
    try {
      const node = make("article", null, "role-card");
      if (eyebrow) node.appendChild(make("p", eyebrow, "eyebrow"));
      node.appendChild(make("h3", title));
      return node;
    } catch (error) {
      logError("Unable to create shared lifecycle card", error);
      return make("article", null, "role-card");
    }
  }

  function renderMessage(container, title, message) {
    try {
      container.replaceChildren();
      const box = make("div", null, "message");
      box.appendChild(make("strong", title));
      box.appendChild(make("p", message));
      container.appendChild(box);
    } catch (error) {
      logError("Unable to render shared lifecycle message", error);
    }
  }

  function renderGM(container, queue, manage) {
    try {
      container.replaceChildren();
      const intro = card(queue.game?.title || "Your Forming Table", "GM · SHARED PILOT");
      intro.appendChild(make("p", stateSummary(queue.state), "microcopy"));
      if (["confirmed", "full"].includes(String(queue.state?.status))) intro.appendChild(hubLink("gm"));
      container.appendChild(intro);

      (queue.registrations || []).forEach((registration) => {
        const item = card(registration.display_name || "Player", String(registration.status || "requested").toUpperCase());
        item.appendChild(make("p", registration.requested_at ? `Requested ${registration.requested_at}` : "Seat request", "microcopy"));
        const actions = make("div", null, "cta-row");
        if (registration.status === "requested") {
          actions.appendChild(actionButton("Approve", () => manage(registration.registration_id, "approve")));
          actions.appendChild(actionButton("Decline", () => manage(registration.registration_id, "decline"), true));
        } else if (registration.status === "confirmed") {
          actions.appendChild(actionButton("Remove Player", () => manage(registration.registration_id, "remove"), true));
        }
        item.appendChild(actions);
        container.appendChild(item);
      });
      if (!(queue.registrations || []).length) container.appendChild(card("No Player requests yet", "WAITING FOR COMMITMENTS"));
    } catch (error) {
      logError("Unable to render GM shared lifecycle", error);
    }
  }

  function renderVenue(container, queue, manage) {
    try {
      container.replaceChildren();
      const intro = card(queue.venue?.name || "Your Venue", "VENUE · SHARED PILOT");
      intro.appendChild(make("p", "Only booking requests for the Venue Manager identity stored in this browser are shown.", "microcopy"));
      container.appendChild(intro);

      (queue.bookings || []).forEach((booking) => {
        const item = card(booking.game_title || "Forming Table", String(booking.booking_status || "requested").toUpperCase());
        item.appendChild(make("p", `${booking.system || "RPG"} · ${booking.requested_start || "Schedule pending"}`));
        item.appendChild(make("p", `${booking.expected_guests || 0} expected guests · GM ${booking.gm_display_name || "Game Master"}`, "microcopy"));
        item.appendChild(make("p", `${String(booking.game_status || "forming").toUpperCase()} · ${booking.confirmed_players || 0} confirmed · ${booking.requested_players || 0} requested`, "microcopy"));
        const actions = make("div", null, "cta-row");
        if (booking.booking_status === "requested") {
          actions.appendChild(actionButton("Approve Table", () => manage(booking.game_id, "approve")));
          actions.appendChild(actionButton("Decline", () => manage(booking.game_id, "decline"), true));
        } else if (booking.booking_status === "approved") {
          actions.appendChild(actionButton("Reopen Approval", () => manage(booking.game_id, "reopen"), true));
        } else if (booking.booking_status === "declined") {
          actions.appendChild(actionButton("Reopen Request", () => manage(booking.game_id, "reopen")));
        }
        if (["confirmed", "full"].includes(String(booking.game_status))) actions.appendChild(hubLink("venue"));
        item.appendChild(actions);
        container.appendChild(item);
      });
      if (!(queue.bookings || []).length) container.appendChild(card("No booking requests yet", "WAITING FOR A MATCH"));
    } catch (error) {
      logError("Unable to render Venue shared lifecycle", error);
    }
  }

  function renderPlayer(container, state, cancel) {
    try {
      container.replaceChildren();
      (state.registrations || []).forEach((registration) => {
        const game = registration.game || {};
        const item = card(registration.game_title || game.title || "Your Table", `PLAYER · ${String(registration.status || "requested").toUpperCase()}`);
        item.appendChild(make("p", `${game.system || "RPG"} · ${game.starts_at || "Schedule pending"}`));
        item.appendChild(make("p", `${Number(game.confirmed_players || 0)}/${Number(game.min_players || 0)} minimum confirmed · Venue ${game.venue_approved ? "approved" : "pending"}`, "microcopy"));
        const actions = make("div", null, "cta-row");
        actions.appendChild(actionButton(registration.status === "requested" ? "Cancel My Request" : "Cancel My Seat", () => cancel(registration.game_id), true));
        if (["confirmed", "full"].includes(String(game.status)) && registration.status === "confirmed") actions.appendChild(hubLink("player"));
        item.appendChild(actions);
        container.appendChild(item);
      });
      if (!(state.registrations || []).length) container.appendChild(card("No active shared registrations", "PLAYER · SHARED PILOT"));
    } catch (error) {
      logError("Unable to render Player shared lifecycle", error);
    }
  }

  window.DDDSharedLifecycleView = { renderMessage, renderGM, renderVenue, renderPlayer };
})();
