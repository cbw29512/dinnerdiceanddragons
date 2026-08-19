(() => {
  "use strict";

  function byId(id) {
    return document.getElementById(id);
  }

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function formatDateTime(value, timezone) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone || undefined,
        timeZoneName: "short"
      }).format(new Date(value));
    } catch {
      return String(value || "");
    }
  }

  function distanceCopy(opportunity, type) {
    const value = type === "Player"
      ? opportunity.your_player_distance_miles
      : opportunity.your_gm_distance_miles;
    return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} miles from your ZIP-area anchor` : "Inside your configured travel range";
  }

  function opportunityCard(opportunity, type) {
    const card = element("article", "role-card");
    const eyebrow = element("p", "eyebrow", String(opportunity.status || "opportunity").replaceAll("_", " ").toUpperCase());
    const title = element("h3", "", opportunity.system?.name || "Table opportunity");
    const where = element("p", "", `${opportunity.venue?.name || "Verified venue"} · ${opportunity.venue?.city || ""}, ${opportunity.venue?.state_region || ""}`);
    const when = element("p", "microcopy", formatDateTime(opportunity.proposed_start, opportunity.timezone));
    const fit = element(
      "p",
      "microcopy",
      `${opportunity.compatible_player_count} compatible ${opportunity.compatible_player_count === 1 ? "Player" : "Players"} · ${distanceCopy(opportunity, type)}`
    );

    card.append(eyebrow, title, where, when, fit);

    if (type === "Game Master") {
      const action = element("a", "button primary", "Build This Table");
      action.href = `create-game.html?table_match_id=${encodeURIComponent(opportunity.id)}`;
      card.append(action);
    } else {
      const state = element(
        "p",
        "microcopy",
        opportunity.game_table_id
          ? "This potential Table is formed. The DM still needs to schedule the Event before seats can be confirmed."
          : "This is a compatible opportunity. No seat has been committed yet."
      );
      card.append(state);
    }
    return card;
  }

  function render(type, matching) {
    const prefix = type === "Player" ? "player" : "gm";
    const section = byId(`${prefix}-production-results`);
    const list = byId(`${prefix}-production-results-list`);
    if (!section || !list) return;

    list.replaceChildren();
    const opportunities = matching?.match?.opportunities || [];
    if (!opportunities.length) {
      const empty = element("article", "role-card");
      empty.append(
        element("h3", "", "No complete three-way Table yet"),
        element("p", "", "Your matching signal is active. A compatible Player/DM, verified Venue, and overlapping time still need to line up.")
      );
      list.append(empty);
    } else {
      opportunities.forEach((opportunity) => list.append(opportunityCard(opportunity, type)));
    }
    section.hidden = false;
    section.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  document.addEventListener("ddd:save-success", (event) => {
    try {
      const detail = event.detail || {};
      if (!detail.production || !detail.matching || detail.matchingError) return;
      if (detail.type !== "Player" && detail.type !== "Game Master") return;
      render(detail.type, detail.matching);
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to render production matching results", error);
    }
  });

  window.DDDProductionMatchResults = Object.freeze({ formatDateTime, render });
})();
