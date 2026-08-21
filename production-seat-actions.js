(() => {
  "use strict";

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function area(card) {
    let node = card.querySelector("[data-opportunity-actions]");
    if (!node) {
      node = element("div", "cta-row");
      node.dataset.opportunityActions = "true";
      card.append(node);
    }
    return node;
  }

  function gameHubLink(eventId) {
    const link = element("a", "button primary", "Seat Confirmed · Open Game Hub");
    link.href = `game-hub.html?event=${encodeURIComponent(eventId)}`;
    return link;
  }

  function registrationState(card, registration) {
    const target = area(card);
    const status = String(registration?.status || "");
    if (status === "confirmed") {
      target.replaceChildren(gameHubLink(registration.event_id));
      return;
    }
    target.replaceChildren(element(
      "p",
      "microcopy",
      status === "waitlisted"
        ? "You are on the waitlist. DDD will alert you automatically if a seat opens."
        : "Seat requested. The DM still needs to approve your request."
    ));
  }

  function render(opportunity, card) {
    try {
      const target = area(card);
      const button = element("button", "button primary", "Request My Seat");
      button.type = "button";
      button.addEventListener("click", async () => {
        const original = button.textContent;
        try {
          button.disabled = true;
          button.textContent = "Checking seat…";
          const event = await window.DDDProductionAPI.getEvent(opportunity.event_id);
          if (event?.your_registration) {
            registrationState(card, event.your_registration);
            return;
          }
          button.textContent = "Requesting seat…";
          registrationState(card, await window.DDDProductionAPI.postRegistration(opportunity.event_id));
        } catch (error) {
          console.error("[Dinner Dice & Dragons] Unable to request matched Event seat", error);
          button.disabled = false;
          button.textContent = original;
          target.append(element("p", "error-message", error?.message || "Seat request could not be completed."));
        }
      });
      target.replaceChildren(button);
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to render Player seat action", error);
    }
  }

  window.DDDSeatActions = Object.freeze({ render });
})();
