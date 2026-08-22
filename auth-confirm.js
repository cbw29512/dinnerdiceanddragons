(() => {
  "use strict";

  function confirmationTokenPresent() {
    try {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      return Boolean(new URLSearchParams(hash).get("confirmation_token"));
    } catch (error) {
      console.error("[DDD Auth] Unable to inspect confirmation link", error);
      return false;
    }
  }

  function showMessage(message, error = false) {
    try {
      let panel = document.getElementById("ddd-confirmation-status");
      if (!panel) {
        panel = document.createElement("div");
        panel.id = "ddd-confirmation-status";
        panel.setAttribute("role", "status");
        panel.setAttribute("aria-live", "polite");
        panel.className = "confirmation-banner";
        document.body.prepend(panel);
      }
      panel.classList.toggle("is-error", error);
      panel.textContent = message;
    } catch (displayError) {
      console.error("[DDD Auth] Unable to show confirmation status", displayError);
    }
  }

  async function confirm() {
    if (!confirmationTokenPresent()) return;
    showMessage("Confirming your Dinner, Dice & Dragons account…");
    try {
      await window.DDDProductionAuth.init();
      if (!window.DDDProductionAuth.didConfirmEmail()) throw new Error("Account confirmation did not complete.");
      window.location.replace("signin.html?confirmed=1");
    } catch (error) {
      console.error("[DDD Auth] Account confirmation failed", error);
      showMessage("We could not finish account confirmation. Open Sign In and try again from your confirmation email.", true);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void confirm(), { once: true });
  else void confirm();
})();