(() => {
  "use strict";

  const HUB_ROLE_MAP = Object.freeze({
    player: "player",
    gm: "gm",
    venue: "venue_manager"
  });

  // Data schema: one role owns its label, hero copy, and the two next-step actions.
  const ROLE_CONFIG = Object.freeze({
    player: {
      label: "Player",
      title: "Find your next game.",
      copy: "Tell local GMs what you want to play, browse forming tables, and see when your game night is ready.",
      primary: { href: "join.html#player", label: "Find My Table" },
      secondary: { href: "games/shadows-over-florence/", label: "Preview a Forming Table" }
    },
    gm: {
      label: "Game Master",
      title: "Build your next table.",
      copy: "Tell Players what you can run, compare local demand, find a public venue, and move a viable match toward confirmation.",
      primary: { href: "join.html#gm", label: "Form a Table" },
      secondary: { href: "find-venue.html", label: "Find Players + Venue" }
    },
    venue: {
      label: "Venue",
      title: "Turn open tables into game nights.",
      copy: "Post the times and capacity you want filled, connect with GMs, and keep expected headcount and game-night logistics in one place.",
      primary: { href: "venues.html#signup", label: "Fill My Tables" },
      secondary: { href: "game-hub.html", label: "Open My Game Hubs" }
    }
  });

  // State logic: role is the only mutable dashboard state in this static prototype.
  const state = { role: "player" };

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function setText(selector, value) {
    try {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    } catch (error) {
      logError(`Unable to update ${selector}`, error);
    }
  }

  function syncHubLinks(role) {
    try {
      const hubRole = HUB_ROLE_MAP[role] || role;
      document.querySelectorAll('a[href^="game-hub.html"]').forEach((link) => {
        link.href = `game-hub.html?role=${encodeURIComponent(hubRole)}`;
      });
    } catch (error) {
      logError("Unable to preserve role in Game Hub links", error);
    }
  }

  function syncRoleContent(role, announce = true) {
    try {
      const config = ROLE_CONFIG[role];
      if (!config) return;

      document.querySelectorAll(".role-btn").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.role === role));
      });

      document.querySelectorAll(".role-content").forEach((section) => {
        section.hidden = !section.classList.contains(role);
      });

      const select = document.querySelector("#role-select");
      if (select && select.value !== role) select.value = role;

      const primary = document.querySelector("#role-primary");
      const secondary = document.querySelector("#role-secondary");
      if (primary) {
        primary.href = config.primary.href;
        primary.textContent = config.primary.label;
      }
      if (secondary) {
        secondary.href = config.secondary.href;
        secondary.textContent = config.secondary.label;
      }

      syncHubLinks(role);
      setText("#hero-title", config.title);
      setText("#hero-copy", config.copy);
      if (document.body.dataset.homepage !== "true") {
        document.title = `${config.label} Dashboard Prototype | Dinner, Dice & Dragons`;
      }

      if (announce) setText("#role-status", `${config.label} view selected.`);
    } catch (error) {
      logError("Unable to synchronize dashboard role", error);
    }
  }

  function setRole(role, announce = true) {
    try {
      if (!Object.hasOwn(ROLE_CONFIG, role)) return;
      state.role = role;
      syncRoleContent(role, announce);
    } catch (error) {
      logError("Unable to switch dashboard role", error);
    }
  }

  function initialRole() {
    try {
      const requested = new URLSearchParams(window.location.search).get("role");
      return requested && Object.hasOwn(ROLE_CONFIG, requested) ? requested : state.role;
    } catch (error) {
      logError("Unable to read requested dashboard role", error);
      return state.role;
    }
  }

  function bindRoleControls() {
    try {
      document.querySelectorAll(".role-btn").forEach((button) => {
        button.addEventListener("click", () => setRole(button.dataset.role));
      });

      const select = document.querySelector("#role-select");
      if (select) select.addEventListener("change", () => setRole(select.value));
    } catch (error) {
      logError("Unable to bind dashboard role controls", error);
    }
  }

  try {
    bindRoleControls();
    setRole(initialRole(), false);
  } catch (error) {
    logError("Dashboard failed to initialize", error);
  }
})();
