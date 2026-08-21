(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const SYSTEM_NAMES = Object.freeze({
    "dnd-5e-2024": "D&D 5e (2024)", "dnd-5e-2014": "D&D 5e (2014)",
    "pathfinder-2e": "Pathfinder 2e", "call-of-cthulhu": "Call of Cthulhu",
    "cyberpunk-red": "Cyberpunk RED", shadowrun: "Shadowrun", "other-rpg": "Other RPG"
  });

  function log(message, error) { console.error(`[DDD Dashboard] ${message}`, error); }
  function availabilityCopy(profile) {
    try {
      const games = (profile.systems || []).map((item) => SYSTEM_NAMES[item.system_slug] || item.system_slug).join(", ");
      const days = [...new Set((profile.availability || []).map((item) => String(item.day_of_week || "").replace(/^./, (c) => c.toUpperCase())))];
      const schedule = days.length ? days.join(", ") : "No times selected";
      return `${games || "Game preferences saved"} · ${schedule} · within ${profile.travel_radius_miles} miles`;
    } catch (error) {
      log("Unable to summarize Player availability", error);
      return "Your Player preferences are saved.";
    }
  }
  function showSignedOut() {
    byId("account-copy").textContent = "You are not signed in.";
    byId("signed-out").hidden = false;
    byId("dashboard-content").hidden = true;
  }
  function renderProfile(profile) {
    const title = byId("availability-title");
    const summary = byId("availability-summary");
    const action = byId("availability-action");
    const pause = byId("matching-paused")?.closest("label");
    if (!profile) {
      title.textContent = "You’re not available for games yet.";
      summary.textContent = "Tell DDD what you want to play, when you are free, and how far you will travel.";
      action.href = "play.html";
      action.textContent = "Get Available";
      if (pause) pause.hidden = true;
      return;
    }
    title.textContent = "You’re available for games.";
    summary.textContent = availabilityCopy(profile);
    action.href = "play.html?edit=1";
    action.textContent = "Change Availability";
    if (pause) pause.hidden = false;
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
        ? "Game search paused. Your availability is still saved."
        : "Game search active. DDD will alert you when a table fits.";
      return saved;
    } catch (error) {
      log("Unable to change matching pause", error);
      byId("pause-status").textContent = error?.message || "Could not update game-search status.";
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
      const [profile, notifications, hubs, initialPrefs] = await Promise.all([
        window.DDDProductionAPI.getPlayerOnboardingOptional(),
        window.DDDProductionAPI.getNotifications(),
        window.DDDProductionAPI.getGameHubs(),
        window.DDDProductionAPI.getNotificationPreferences()
      ]);
      renderProfile(profile);
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