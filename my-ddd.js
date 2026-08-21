(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const SYSTEM_NAMES = Object.freeze({
    "dnd-5e-2024": "D&D 5e (2024)", "dnd-5e-2014": "D&D 5e (2014)",
    "pathfinder-2e": "Pathfinder 2e", "call-of-cthulhu": "Call of Cthulhu",
    "cyberpunk-red": "Cyberpunk RED", shadowrun: "Shadowrun", "other-rpg": "Other RPG"
  });
  const currentSignals = (signals) => (signals || []).filter((item) => ["active", "paused"].includes(item.status));

  function log(message, error) { console.error(`[DDD Dashboard] ${message}`, error); }

  function summary(profile) {
    try {
      const games = (profile?.systems || []).map((item) => SYSTEM_NAMES[item.system_slug] || item.system_slug).join(", ");
      const days = [...new Set((profile?.availability || []).map((item) => String(item.day_of_week || "").replace(/^./, (c) => c.toUpperCase())))];
      return `${games || "Preferences saved"} · ${days.join(", ") || "No times selected"} · within ${profile.travel_radius_miles} miles`;
    } catch (error) {
      log("Unable to summarize availability", error);
      return "Your preferences are saved.";
    }
  }

  function showSignedOut() {
    byId("account-copy").textContent = "You are not signed in.";
    byId("signed-out").hidden = false;
    byId("dashboard-content").hidden = true;
  }

  function renderRole(prefix, profile, signals) {
    const title = byId(`${prefix}-status-title`);
    const copy = byId(`${prefix}-status-summary`);
    const action = byId(`${prefix}-status-action`);
    const player = prefix === "player";

    if (!profile) {
      title.textContent = player ? "Not looking for a Player seat yet." : "Not available as a DM yet.";
      copy.textContent = player ? "Tell DDD when you can play." : "Tell DDD what you can run and when.";
      action.href = player ? "play.html" : "dm.html";
      action.textContent = player ? "Get Available to Play" : "Get Available to DM";
      return;
    }

    const current = currentSignals(signals);
    const active = current.some((item) => item.status === "active");
    const paused = current.length > 0 && current.every((item) => item.status === "paused");

    if (active) {
      title.textContent = player ? "You’re available for games." : "You’re available to DM.";
      copy.textContent = summary(profile);
      action.href = player ? "play.html?edit=1" : "dm.html?edit=1";
      action.textContent = player ? "Change Availability" : "Change DM Availability";
      return;
    }

    if (paused) {
      title.textContent = player ? "Player matching is paused." : "DM matching is paused.";
      copy.textContent = `${summary(profile)} · Matching can be resumed below.`;
      action.href = player ? "play.html?edit=1" : "dm.html?edit=1";
      action.textContent = player ? "Change Availability" : "Change DM Availability";
      return;
    }

    title.textContent = player ? "Your Player profile is saved." : "Your DM profile is saved.";
    copy.textContent = `${summary(profile)} · Matching is not active yet.`;
    action.href = player ? "play.html" : "dm.html";
    action.textContent = player ? "Start Looking for Games" : "Start Looking for a Table";
  }

  function renderCounts(notifications, hubs) {
    const active = (notifications || []).filter((item) => !["read", "acted", "expired", "cancelled"].includes(item.state));
    byId("alert-count").textContent = String(active.length);
    byId("hub-count").textContent = String((hubs || []).length);
  }

  async function signalsFor(profile, loader) {
    if (!profile) return [];
    try {
      return await loader();
    } catch (error) {
      if ([403, 404].includes(Number(error?.status))) return [];
      throw error;
    }
  }

  async function savePause(prefs) {
    try {
      const next = { ...prefs, matching_paused: Boolean(byId("matching-paused").checked) };
      const saved = await window.DDDProductionAPI.putNotificationPreferences(next);
      byId("pause-status").textContent = saved.matching_paused
        ? "New matches paused. Your saved availability and confirmed games were not deleted."
        : "Matching active. DDD will notify you when a table fits.";
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

      const [player, gm, notifications, hubs, opportunities, initialPrefs] = await Promise.all([
        window.DDDProductionAPI.getPlayerOnboardingOptional(),
        window.DDDProductionAPI.getGMOnboardingOptional(),
        window.DDDProductionAPI.getNotifications(),
        window.DDDProductionAPI.getGameHubs(),
        window.DDDProductionAPI.getMatchingOpportunities(),
        window.DDDProductionAPI.getNotificationPreferences()
      ]);
      const [playerDemands, gmSupplies] = await Promise.all([
        signalsFor(player, () => window.DDDProductionAPI.getPlayerDemands()),
        signalsFor(gm, () => window.DDDProductionAPI.getGMSupplies())
      ]);

      renderRole("player", player, playerDemands);
      renderRole("dm", gm, gmSupplies);
      renderCounts(notifications, hubs);
      window.DDDGameCards?.render?.(opportunities);

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