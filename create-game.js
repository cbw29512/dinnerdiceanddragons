(() => {
  "use strict";

  let opportunity = null;
  let tableMatchId = "";

  function byId(id) {
    return document.getElementById(id);
  }

  function announce(node, message, success = false) {
    if (!node) return;
    node.className = `form-status ${success ? "success-message" : "error-message"}`;
    node.textContent = message;
  }

  function clean(value) {
    const text = String(value || "").trim();
    return text || null;
  }

  function dateTimeLabel(start, end, timezone) {
    try {
      const formatter = new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone || undefined,
        timeZoneName: "short"
      });
      return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
    } catch {
      return `${start} – ${end}`;
    }
  }

  function systemLabel(system) {
    if (!system) return "RPG";
    return [system.name, system.edition].filter(Boolean).join(" · ");
  }

  function renderSummary(match) {
    const root = byId("selected-slot");
    if (!root) return;
    root.replaceChildren();
    const title = document.createElement("h2");
    title.id = "selected-match-title";
    title.textContent = systemLabel(match.system);
    const venue = document.createElement("p");
    venue.textContent = `${match.venue.name} · ${match.venue.city}, ${match.venue.state_region}`;
    const schedule = document.createElement("p");
    schedule.textContent = dateTimeLabel(match.proposed_start, match.proposed_end, match.timezone);
    const capacity = document.createElement("p");
    capacity.className = "microcopy";
    capacity.textContent = `${match.compatible_player_count} compatible ${match.compatible_player_count === 1 ? "Player" : "Players"} · needs ${match.minimum_players}–${match.maximum_players} Players`;
    root.append(title, venue, schedule, capacity);
  }

  function hydrateForm(match) {
    byId("game-system").value = systemLabel(match.system);
    byId("game-when").value = dateTimeLabel(match.proposed_start, match.proposed_end, match.timezone);
    byId("game-venue").value = `${match.venue.name} · ${match.venue.city}, ${match.venue.state_region}`;
    byId("min-players").value = String(match.minimum_players);
    byId("max-players").value = String(match.maximum_players);
    const form = byId("game-form");
    form.hidden = false;
  }

  function showExistingEvent(match) {
    const pageStatus = byId("create-game-page-status");
    announce(pageStatus, "This Table Match has already been converted into an Event.", true);
    byId("game-form").hidden = true;
    const next = byId("game-next-step");
    const link = byId("game-hub-link");
    link.href = `game-hub.html?event=${encodeURIComponent(match.event_id)}`;
    byId("game-created-copy").textContent = `Event status: ${String(match.event_status || "formed").replaceAll("_", " ")}. Continue in the Game Hub.`;
    next.hidden = false;
  }

  function payloadFromForm(form) {
    const minimumAge = clean(form.elements.minimum_age.value);
    const characterGuidance = clean(form.elements.character_guidance.value);
    return {
      title: form.elements.title.value.trim(),
      description: form.elements.description.value.trim(),
      event_type: form.elements.event_type.value,
      join_mode: form.elements.join_mode.value,
      minimum_age: minimumAge === null ? null : Number(minimumAge),
      beginner_friendly: form.elements.beginner_friendly.value === "true",
      expected_sessions: Number(form.elements.expected_sessions.value),
      gm_message: clean(form.elements.gm_message.value),
      expectations: {
        play_style: form.elements.play_style.value.trim(),
        boundaries: form.elements.boundaries.value.trim(),
        homebrew_policy: clean(form.elements.homebrew_policy.value),
        age_environment: minimumAge === null ? null : `${minimumAge}+ table`,
        new_players_welcome: form.elements.beginner_friendly.value === "true",
        other_notes: characterGuidance
      }
    };
  }

  async function submitForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.querySelector(".form-status");
    if (!form.checkValidity()) {
      announce(status, "Please complete the required game and table-expectation fields.");
      form.reportValidity();
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    try {
      submit.disabled = true;
      announce(status, "Creating the real Event…", true);
      const formed = await window.DDDProductionAPI.formTableMatch(tableMatchId, payloadFromForm(form));
      form.hidden = true;
      const next = byId("game-next-step");
      const link = byId("game-hub-link");
      link.href = `game-hub.html?event=${encodeURIComponent(formed.event_id)}`;
      byId("game-created-copy").textContent = `Event status: ${formed.event_status.replaceAll("_", " ")}. Matched Players can now request seats and the Venue can review its booking request.`;
      next.hidden = false;
      announce(byId("create-game-page-status"), formed.created ? "Event created successfully." : "This match was already converted; the existing Event was reused.", true);
      next.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to form matched Event", error);
      submit.disabled = false;
      announce(status, error?.message || "The matched Event could not be created.");
    }
  }

  async function ensureProductionSession() {
    if (!window.DDDProductionAPI?.isConfigured?.()) {
      await window.DDDProductionAuth.init();
    }
    return window.DDDProductionAuth.getSession();
  }

  async function init() {
    const pageStatus = byId("create-game-page-status");
    try {
      tableMatchId = new URLSearchParams(window.location.search).get("table_match_id") || "";
      if (!tableMatchId) {
        throw new Error("Choose a matched Table from your GM signup results first.");
      }

      const session = await ensureProductionSession();
      if (!session) {
        throw new Error("Sign in with the GM account that owns this match, then reload this page.");
      }

      opportunity = await window.DDDProductionAPI.getMatchingOpportunity(tableMatchId);
      if (!Array.isArray(opportunity.viewer_roles) || !opportunity.viewer_roles.includes("gm")) {
        throw new Error("This Table Match does not belong to your GM profile.");
      }

      renderSummary(opportunity);
      if (opportunity.event_id) {
        showExistingEvent(opportunity);
        return;
      }

      hydrateForm(opportunity);
      byId("game-form").addEventListener("submit", submitForm);
      announce(pageStatus, "Match loaded. Add the game details below to create the Event.", true);
    } catch (error) {
      console.error("[Dinner Dice & Dragons] Unable to initialize matched Event creation", error);
      announce(pageStatus, error?.message || "The selected Table Match could not be loaded.");
      byId("game-form").hidden = true;
      const root = byId("selected-slot");
      if (root) {
        const help = document.createElement("p");
        help.className = "microcopy";
        help.textContent = "Return to the GM signup flow to refresh your current production matches.";
        root.append(help);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { void init(); }, { once: true });
  } else {
    void init();
  }
})();
