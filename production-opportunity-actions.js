(() => {
  "use strict";

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function roleFor(type) {
    return type === "Game Master" ? "gm" : "player";
  }

  function actionArea(card) {
    let area = card.querySelector("[data-opportunity-actions]");
    if (!area) {
      area = element("div", "cta-row");
      area.dataset.opportunityActions = "true";
      card.append(area);
    }
    return area;
  }

  function gameHubLink(eventId) {
    const link = element("a", "button primary", "Event Formed · Open Game Hub");
    link.href = `game-hub.html?event=${encodeURIComponent(eventId)}`;
    return link;
  }

  function eventSetupLink(opportunity) {
    const link = element("a", "button primary", "💥 Table Formed · Finish Event Setup");
    link.href = `create-game.html?table_match_id=${encodeURIComponent(opportunity.id)}`;
    return link;
  }

  function waitingCopy(role, progress = null) {
    if (progress) {
      const venue = progress.venueAccepted ? "Venue ✓" : "Venue waiting";
      const gm = progress.gmAccepted ? "DM ✓" : "DM waiting";
      return `${gm} · ${venue} · ${progress.acceptedPlayers} Player${progress.acceptedPlayers === 1 ? "" : "s"} accepted`;
    }
    return role === "gm"
      ? "You accepted. DDD is waiting for the Venue and enough Players."
      : "You're interested. DDD is waiting for the DM, Venue, and enough Players.";
  }

  function renderWaiting(card, role, progress = null) {
    actionArea(card).replaceChildren(element("p", "microcopy", waitingCopy(role, progress)));
  }

  async function respond(opportunity, type, card, decision) {
    const role = roleFor(type);
    const area = actionArea(card);
    const buttons = area.querySelectorAll("button");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const result = await window.DDDProductionAPI.respondToOpportunity(opportunity.id, role, decision);
      opportunity.your_responses = { ...(opportunity.your_responses || {}), [role]: result.decision };
      opportunity.status = result.table_status;
      if (decision === "declined") {
        area.replaceChildren(element("p", "microcopy", "Passed. DDD will keep watching for another fit."));
        return;
      }
      if (result.table_status === "forming") {
        area.replaceChildren(
          role === "gm"
            ? eventSetupLink(opportunity)
            : element("p", "success-message", "💥 Table formed. The DM is finishing the Event details before seats open.")
        );
        return;
      }
      renderWaiting(card, role, result.progress);
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to respond to opportunity", error);
      buttons.forEach((button) => { button.disabled = false; });
      area.append(element("p", "error-message", error?.message || "Your response could not be saved."));
    }
  }

  function responseControls(opportunity, type, card) {
    const role = roleFor(type);
    const decision = opportunity.your_responses?.[role] || "pending";
    const area = actionArea(card);
    if (decision === "accepted" || decision === "interested") {
      renderWaiting(card, role);
      return;
    }
    if (decision === "declined" || decision === "expired") {
      area.replaceChildren(element("p", "microcopy", decision === "declined" ? "You passed on this match." : "This match offer expired."));
      return;
    }
    const accept = element("button", "button primary", role === "gm" ? "Accept Match" : "I'm Interested");
    accept.type = "button";
    const decline = element("button", "button secondary", "Not This One");
    decline.type = "button";
    accept.addEventListener("click", () => { void respond(opportunity, type, card, "accepted"); });
    decline.addEventListener("click", () => { void respond(opportunity, type, card, "declined"); });
    area.replaceChildren(accept, decline);
  }

  function render(opportunity, type, card) {
    try {
      const role = roleFor(type);
      if (opportunity.event_id) {
        if (role === "gm") actionArea(card).replaceChildren(gameHubLink(opportunity.event_id));
        else window.DDDSeatActions?.render?.(opportunity, card);
      } else if (opportunity.status === "forming") {
        actionArea(card).replaceChildren(
          role === "gm"
            ? eventSetupLink(opportunity)
            : element("p", "success-message", "💥 Table formed. Waiting for the DM to finish Event setup.")
        );
      } else {
        responseControls(opportunity, type, card);
      }
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to render opportunity actions", error);
    }
  }

  window.DDDOpportunityActions = Object.freeze({ render, roleFor });
})();
