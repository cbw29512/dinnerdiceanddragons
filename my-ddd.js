(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const SYSTEM_NAMES = Object.freeze({
    "dnd-5e-2024": "D&D 5e (2024)", "dnd-5e-2014": "D&D 5e (2014)",
    "pathfinder-2e": "Pathfinder 2e", "call-of-cthulhu": "Call of Cthulhu",
    "cyberpunk-red": "Cyberpunk RED", shadowrun: "Shadowrun", "other-rpg": "Other RPG"
  });

  function log(message, error) { console.error(`[DDD Dashboard] ${message}`, error); }
  function summary(profile) {
    try {
      const games = (profile?.systems || []).map((item) => SYSTEM_NAMES[item.system_slug] || item.system_slug).join(", ");
      const days = [...new Set((profile?.availability || []).map((item) => String(item.day_of_week || "").replace(/^./, (c) => c.toUpperCase())))];
      return `${games || "Preferences saved"} · ${days.join(", ") || "No times selected"} · within ${profile.travel_radius_miles} miles`;
    } catch (error) { log("Unable to summarize availability", error); return "Your preferences are saved."; }
  }
  function showSignedOut() {
    byId("account-copy").textContent = "You are not signed in.";
    byId("signed-out").hidden = false;
    byId("dashboard-content").hidden = true;
  }
  function renderRole(prefix, profile) {
    const title = byId(`${prefix}-status-title`);
    const copy = byId(`${prefix}-status-summary`);
    const action = byId(`${prefix}-status-action`);
    if (profile) {
      title.textContent = prefix === "player" ? "You’re available for games." : "You’re available to DM.";
      copy.textContent = summary(profile);
      action.href = prefix === "player" ? "play.html?edit=1" : "dm.html";
      action.textContent = prefix === "player" ? "Change Availability" : "DM Setup Saved";
      return;
    }
    title.textContent = prefix === "player" ? "Not looking for a Player seat yet." : "Not available as a DM yet.";
    copy.textContent = prefix === "player" ? "Tell DDD when you can play." : "Tell DDD what you can run and when.";
    action.href = prefix === "player" ? "play.html" : "dm.html";
    action.textContent = prefix === "player" ? "Get Available to Play" : "Get Available to DM";
  }
  function renderCounts(notifications, hubs) {
    const active = (notifications || []).filter((item) => !["read", "acted", "expired", "cancelled"].includes(item.state));
    byId("alert-count").textContent = String(active.length);
    byId("hub-count").textContent = String((hubs || []).length);
  }
  async function savePause(prefs) {
    try {
      const next = { ...prefs, matching_paused: Boolean(byId("matching-paused").checked) };
      const saved = await window.DDDProductionAPI.putNotificationPreferences(next);
      byId("pause-status").textContent = saved.matching_paused
        ? "New match alerts paused. Your saved availability was not deleted."
        : "Match alerts active. DDD will notify you when a table fits.";
      return saved;
    } catch (error) {
      log("Unable to change matching pause", error);
      byId("pause-status").textContent = error?.message || "Could not update matching status.";
      return prefs;
    }
  }
  async function init() {
    try {
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (!session) return showSignedOut();
      byId("account-copy").textContent = `Signed in as ${session.user.email}.`;
      byId("signed-out").hidden = true;
      byId("dashboard-content").hidden = false;
      const [player, gm, notifications, hubs, initialPrefs] = await Promise.all([
        window.DDDProductionAPI.getPlayerOnboardingOptional(),
        window.DDDProductionAPI.getGMOnboardingOptional(),
        window.DDDProductionAPI.getNotifications(),
        window.DDDProductionAPI.getGameHubs(),
        window.DDDProductionAPI.getNotificationPreferences()
      ]);
      renderRole("player", player);
      renderRole("dm", gm);
      renderCounts(notifications, hubs);
      let prefs = initialPrefs;
      byId("matching-paused").checked = Boolean(prefs.matching_paused);
      byId("matching-paused").addEventListener("change", async () => { prefs = await savePause(prefs); });
    } catch (error) {
      log("Unable to load My DDD", error);
      byId("account-copy").textContent = "DDD could not load your status right now.";
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();