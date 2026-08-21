(() => {
  "use strict";

  const ROLE_LABELS = Object.freeze({ player: "Player", gm: "Dungeon Master", venue_manager: "Venue" });
  function byId(id) { return document.getElementById(id); }
  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function formatDate(value, timezone) {
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: "full", timeStyle: "short", timeZone: timezone }).format(new Date(value)); }
    catch { return String(value || ""); }
  }
  function params() {
    const search = new URLSearchParams(location.search);
    return { matchId: search.get("match") || "", requestedRole: search.get("role") || "" };
  }
  function chooseRole(opportunity, requested) {
    const roles = opportunity.viewer_roles || [];
    return roles.includes(requested) ? requested : roles[0] || "";
  }
  function renderFacts(opportunity, role) {
    byId("opportunity-title").textContent = opportunity.system?.name || "Table opportunity";
    byId("opportunity-system").textContent = opportunity.system?.edition ? `${opportunity.system.name} · ${opportunity.system.edition}` : opportunity.system?.name || "Tabletop RPG";
    byId("opportunity-time").textContent = `${formatDate(opportunity.proposed_start, opportunity.timezone)} – ${formatDate(opportunity.proposed_end, opportunity.timezone)}`;
    byId("opportunity-venue").textContent = `${opportunity.venue?.name || "Verified public venue"} · ${opportunity.venue?.city || ""}, ${opportunity.venue?.state_region || ""}`;
    byId("opportunity-role").textContent = ROLE_LABELS[role] || role;
    byId("opportunity-players").textContent = `${opportunity.compatible_player_count} compatible Players · minimum ${opportunity.minimum_players}`;
  }
  function waitingText(role) {
    if (role === "venue_manager") return "Reserved from your Venue availability. DDD is waiting for the DM and enough Players to accept.";
    if (role === "gm") return "You accepted this game. The Venue time is already reserved; DDD is waiting for enough Players.";
    return "You accepted this game. The Venue time is already reserved; DDD is waiting for the DM and enough Players.";
  }
  function gameHubLink(eventId) {
    const link = element("a", "button primary", "Open Game Hub");
    link.href = `game-hub.html?event=${encodeURIComponent(eventId)}`;
    return link;
  }
  function formedAction(opportunity, role) {
    const actions = byId("opportunity-actions");
    actions.replaceChildren();
    if (role === "gm" && !opportunity.event_id) {
      const link = element("a", "button primary", "💥 GAME ON · Finish Event Setup");
      link.href = `create-game.html?table_match_id=${encodeURIComponent(opportunity.id)}`;
      actions.append(link);
    } else if (opportunity.event_id) {
      actions.append(gameHubLink(opportunity.event_id));
    } else {
      actions.append(element("p", "success-message", role === "venue_manager"
        ? "💥 GAME ON. This table is reserved from your Venue availability."
        : "💥 GAME ON. The DM is finishing the Event details."));
    }
  }
  async function respond(opportunity, role, decision) {
    const actions = byId("opportunity-actions");
    actions.querySelectorAll("button").forEach((button) => { button.disabled = true; });
    try {
      const result = await window.DDDProductionAPI.respondToOpportunity(opportunity.id, role, decision);
      opportunity.status = result.table_status;
      opportunity.your_responses = { ...(opportunity.your_responses || {}), [role]: result.decision };
      if (decision === "declined") actions.replaceChildren(element("p", "microcopy", "Passed. DDD will keep watching for another fit."));
      else if (result.table_status === "forming") formedAction(opportunity, role);
      else actions.replaceChildren(element("p", "microcopy", waitingText(role)));
      window.dispatchEvent(new CustomEvent("ddd:notifications-changed"));
    } catch (error) {
      console.error("[DDD Opportunity] Unable to save response", error);
      byId("opportunity-status").textContent = error?.message || "Your response could not be saved.";
      actions.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    }
  }
  function renderActions(opportunity, role) {
    if (opportunity.status === "forming" || opportunity.event_id) return formedAction(opportunity, role);
    const actions = byId("opportunity-actions");
    const decision = opportunity.your_responses?.[role] || "pending";
    if (["accepted", "interested"].includes(decision)) return actions.replaceChildren(element("p", "microcopy", waitingText(role)));
    if (["declined", "expired"].includes(decision)) return actions.replaceChildren(element("p", "microcopy", decision === "declined" ? "You passed on this match." : "This match offer expired."));
    if (role === "venue_manager") return actions.replaceChildren(element("p", "success-message", "Reserved from your Venue availability. No extra approval is needed."));
    const accept = element("button", "button primary", "Accept Game");
    const decline = element("button", "button secondary", "Not This One");
    accept.type = decline.type = "button";
    accept.addEventListener("click", () => { void respond(opportunity, role, "accepted"); });
    decline.addEventListener("click", () => { void respond(opportunity, role, "declined"); });
    actions.replaceChildren(accept, decline);
  }
  async function init() {
    try {
      await window.DDDProductionAuth.init();
      if (!(await window.DDDProductionAuth.getSession())) throw new Error("Sign in to review this match.");
      const { matchId, requestedRole } = params();
      if (!matchId) throw new Error("Match link is incomplete.");
      const opportunity = await window.DDDProductionAPI.getMatchingOpportunity(matchId);
      const role = chooseRole(opportunity, requestedRole);
      if (!role) throw new Error("This match is not available to your account.");
      renderFacts(opportunity, role);
      renderActions(opportunity, role);
      byId("opportunity-panel").hidden = false;
      byId("opportunity-status").textContent = "DDD matched a DM, Players, a public Venue, and a shared time. Private contact details stay private.";
    } catch (error) {
      console.error("[DDD Opportunity] Unable to load opportunity", error);
      byId("opportunity-status").textContent = error?.message || "This match could not be loaded.";
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();