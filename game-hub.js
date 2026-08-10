(() => {
  "use strict";

  function logError(message, error) {
    console.error(`[Dinner Dice & Dragons] ${message}`, error);
  }

  function showRole(role) {
    try {
      document.querySelectorAll(".hub-view").forEach((view) => {
        view.hidden = view.id !== `${role}-view`;
      });
      document.querySelectorAll(".hub-role").forEach((button) => {
        const active = button.dataset.role === role;
        button.classList.toggle("primary", active);
        button.classList.toggle("secondary", !active);
        button.setAttribute("aria-pressed", String(active));
      });
      const status = document.querySelector("#hub-status");
      if (status) status.textContent = `${role === "gm" ? "Game Master" : role === "player" ? "Player" : "Venue"} view active.`;
    } catch (error) {
      logError("Unable to switch Game Hub role", error);
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
            preview.innerHTML = "<strong>Preview saved locally</strong><p></p>";
            preview.querySelector("p").textContent = textarea.value.trim();
            form.before(preview);
            textarea.value = "";
            if (status) status.textContent = "Message preview added. Production will save and notify the appropriate role.";
          } catch (error) {
            logError("Unable to add message preview", error);
          }
        });
      });
    } catch (error) {
      logError("Unable to initialize Game Hub messages", error);
    }
  }

  try {
    document.querySelectorAll(".hub-role").forEach((button) => {
      button.addEventListener("click", () => showRole(button.dataset.role));
    });
    showRole("gm");
    bindMessages();
  } catch (error) {
    logError("Unable to initialize Game Hub", error);
  }
})();