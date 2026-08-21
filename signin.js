(() => {
  "use strict";

  const form = document.getElementById("signin-form");
  const status = document.getElementById("signin-status");

  function announce(message, success = false) {
    status.className = `form-status ${success ? "success-message" : "error-message"}`;
    status.textContent = message;
  }

  async function submit(event) {
    event.preventDefault();
    try {
      if (!form.checkValidity()) {
        const invalid = form.querySelector(":invalid");
        invalid?.focus();
        announce("Enter your email address and password.");
        return;
      }
      announce("Signing in…", true);
      await window.DDDProductionAuth.signIn(form.elements.email.value.trim(), form.elements.password.value);
      await window.DDDProductionAPI.getMe();
      window.location.assign("my-ddd.html");
    } catch (error) {
      console.error("[DDD Sign In] Sign in failed", error);
      announce(error?.message || "Sign in failed.");
    }
  }

  async function init() {
    try {
      form.addEventListener("submit", (event) => void submit(event));
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (session) window.location.replace("my-ddd.html");
    } catch (error) {
      console.error("[DDD Sign In] Unable to initialize", error);
      announce("Account service is temporarily unavailable.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();