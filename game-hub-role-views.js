(() => {
  "use strict";

  const rt = window.DDDGameHubRuntime;

  function renderAll() {
    renderGmView();
    renderPlayerView();
    renderVenueView();
  }

  function renderGmView() {
    const queue = rt.byId("gm-registration-queue");
    if (queue) queue.replaceChildren();
    const items = rt.state.hub.registration_queue || [];
    if (queue && items.length === 0) {
      rt.appendEmpty(queue, "No pending or committed Player rows are available.");
    }
    for (const item of items) {
      if (queue) queue.append(buildRegistrationRow(item));
    }
    const booking = rt.state.hub.event.booking;
    rt.setText(
      "gm-booking-summary",
      `${rt.humanize(booking.status)} · ${booking.expected_guests} expected guest${booking.expected_guests === 1 ? "" : "s"}`
    );
  }

  function buildRegistrationRow(item) {
    const row = document.createElement("div");
    row.className = "hub-registration-row";
    const summary = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.display_name;
    const status = document.createElement("div");
    status.className = "hub-muted";
    status.textContent = `${rt.humanize(item.status)} · requested ${rt.formatDateTime(item.requested_at)}`;
    summary.append(name, status);

    const actions = document.createElement("div");
    actions.className = "hub-registration-actions";
    if (["requested", "waitlisted"].includes(item.status)) {
      actions.append(
        rt.actionButton("Confirm", () => window.DDDGameHubActions.mutateRegistration(item.registration_id, "confirm")),
        rt.actionButton("Decline", () => window.DDDGameHubActions.mutateRegistration(item.registration_id, "decline"), "secondary")
      );
    } else if (item.status === "confirmed") {
      actions.append(
        rt.actionButton("Remove", () => window.DDDGameHubActions.mutateRegistration(item.registration_id, "remove"), "secondary")
      );
    }
    row.append(summary, actions);
    return row;
  }

  function renderPlayerView() {
    const registration = rt.state.hub.event.your_registration;
    rt.setText(
      "player-seat-summary",
      registration
        ? `Your seat is ${rt.humanize(registration.status)}.`
        : "No active Player registration is attached to this view."
    );
    const cancel = rt.byId("cancel-seat");
    if (cancel) {
      cancel.hidden = !registration || registration.status !== "confirmed";
      cancel.onclick = cancel.hidden ? null : window.DDDGameHubActions.cancelSeat;
    }

    const form = rt.byId("venue-question-form");
    if (form) {
      form.onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        await window.DDDGameHubMessages.sendMessage(
          {
            channel_type: "player_venue_question",
            category: String(data.get("category") || "other"),
            body: String(data.get("body") || "").trim()
          },
          form
        );
      };
    }
  }

  function renderVenueView() {
    const booking = rt.state.hub.event.booking;
    rt.setText(
      "venue-headcount-summary",
      `${booking.expected_guests} expected guest${booking.expected_guests === 1 ? "" : "s"} for this Event.`
    );
    const container = rt.byId("venue-booking-actions");
    if (!container) return;
    container.replaceChildren();
    if (["requested", "question"].includes(booking.status)) {
      container.append(
        rt.actionButton("Approve", () => window.DDDGameHubActions.mutateBooking("approve")),
        rt.actionButton("Ask Question", () => window.DDDGameHubActions.mutateBooking("question"), "secondary"),
        rt.actionButton("Decline", () => window.DDDGameHubActions.mutateBooking("decline"), "secondary")
      );
    } else if (booking.status === "approved") {
      container.append(
        rt.actionButton("Cancel Venue Booking", () => window.DDDGameHubActions.mutateBooking("cancel"), "secondary")
      );
    } else {
      rt.appendEmpty(container, `Booking is ${rt.humanize(booking.status)}.`);
    }
  }

  window.DDDGameHubRoles = Object.freeze({ renderAll });
})();
