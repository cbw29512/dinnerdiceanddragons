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
    return Number.isFinite(Number(value))
      ? `${Number(value).toFixed(1)} miles from your ZIP-area anchor`
      : "Inside your configured travel range";
  }

  function opportunityCard(opportunity, type) {
    const card = element("article", "role-card");
    const status = String(opportunity.status || "opportunity").replaceAll("_", " ").toUpperCase();
    const location = `${opportunity.venue?.name || "Verified venue"} · ${opportunity.venue?.city || ""}, ${opportunity.venue?.state_region || ""}`;
    card.append(
      element("p", "eyebrow", status),
      element("h3", "", opportunity.system?.name || "Table opportunity"),
      element("p", "", location),
      element("p", "microcopy", formatDateTime(opportunity.proposed_start, opportunity.timezone)),
      element(
        "p",
        "microcopy",
        `${opportunity.compatible_player_count} compatible ${opportunity.compatible_player_count === 1 ? "Player" : "Players"} · ${distanceCopy(opportunity, type)}`
      )
    );
    window.DDDOpportunityActions?.render?.(opportunity, type, card);
    return card;
  }

  function render(type, matching) {
    try {
      const prefix = type === "Player" ? "player" : "gm";
      const section = byId(`${prefix}-production-results`);
      const list = byId(`${prefix}-production-results-list`);
      if (!section || !list) return;
      list.replaceChildren();
      const opportunities = matching?.opportunities || matching?.match?.opportunities || [];
      if (!opportunities.length) {
        const empty = element("article", "role-card");
        empty.append(
          element("h3", "", "No complete three-way Table yet"),
          element("p", "", "Your matching signal is active. DDD will alert you when Player, DM, Venue, schedule, and travel range line up.")
        );
        list.append(empty);
      } else {
        opportunities.forEach((opportunity) => list.append(opportunityCard(opportunity, type)));
      }
      section.hidden = false;
      section.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to render production matching results", error);
    }
  }

  document.addEventListener("ddd:save-success", (event) => {
    try {
      const detail = event.detail || {};
      if (!detail.production || !detail.matching || detail.matchingError) return;
      if (detail.type !== "Player" && detail.type !== "Game Master") return;
      render(detail.type, detail.matching);
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to handle production match results", error);
    }
  });

  window.DDDProductionMatchResults = Object.freeze({ formatDateTime, render });
})();
