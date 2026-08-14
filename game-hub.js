(() => {
  "use strict";

  // Data schema: the Game Hub exposes exactly three supported participant views.
  const ROLE_LABELS = Object.freeze({
    gm: "Dungeon Master",
    player: "Player",
    venue: "Venue"
  });

  // State logic: one role view is active at a time and may be deep-linked with ?role=.
  const state = { role: "gm" };

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function updateRoleUrl(role) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("role", role);
      window.history.replaceState({}, "", url);
    } catch (error) {
      logError("Unable to update Game Hub role URL", error);
    }
  }

  function showRole(role, announce = true, updateUrl = true) {
    try {
      if (!Object.hasOwn(ROLE_LABELS, role)) return;
      state.role = role;

      document.querySelectorAll(".hub-view").forEach((view) => {
        view.hidden = view.id !== `${role}-view`;
      });

      document.querySelectorAll(".hub-role").forEach((button) => {
        const active = button.dataset.role === role;
        button.classList.toggle("primary", active);
        button.classList.toggle("secondary", !active);
        button.setAttribute("aria-pressed", String(active));
      });

      document.title = `${ROLE_LABELS[role]} Game Hub | Dinner, Dice & Dragons`;
      if (updateUrl) updateRoleUrl(role);

      const status = document.querySelector("#hub-status");
      if (announce && status) status.textContent = `${ROLE_LABELS[role]} view active.`;
    } catch (error) {
      logError("Unable to switch Game Hub role", error);
    }
  }

  function initialRole() {
    try {
      const requested = new URLSearchParams(window.location.search).get("role");
      return requested && Object.hasOwn(ROLE_LABELS, requested) ? requested : state.role;
    } catch (error) {
      logError("Unable to read requested Game Hub role", error);
      return state.role;
    }
  }

  function bindMessages() {
    try {
      document.querySelectorAll(".quick-message").forEach((form) => {
        form.addEventListener("submit", (event) => {
          try {
            event.preventDefault();
            const textarea = form.querySelector("textarea");
            const status = document.querySelector("#hub-status");
            if (!textarea || !textarea.value.trim()) {
              if (status) status.textContent = "Type a message first.";
              if (textarea) textarea.focus();
              return;
            }

            const preview = document.createElement("div");
            preview.className = "message success-message";
            preview.innerHTML = "<strong>Preview added</strong><p></p>";
            preview.querySelector("p").textContent = textarea.value.trim();
            form.before(preview);
            textarea.value = "";
            if (status) status.textContent = "Preview added to this page only. No message was sent.";
          } catch (error) {
            logError("Unable to add message preview", error);
          }
        });
      });
    } catch (error) {
      logError("Unable to initialize Game Hub messages", error);
    }
  }

  function bindRoleControls() {
    try {
      document.querySelectorAll(".hub-role").forEach((button) => {
        button.addEventListener("click", () => showRole(button.dataset.role));
      });
    } catch (error) {
      logError("Unable to initialize Game Hub role controls", error);
    }
  }

  try {
    bindRoleControls();
    bindMessages();
    showRole(initialRole(), false, false);
  } catch (error) {
    logError("Unable to initialize Game Hub", error);
  }
})();