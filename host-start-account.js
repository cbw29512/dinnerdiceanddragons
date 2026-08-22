(() => {
  "use strict";

  function log(message, error) {
    console.error(`[DDD Venue Account] ${message}`, error);
  }

  function setMode(form, mode) {
    try {
      const signingIn = mode === "signin";
      document.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.authMode === mode);
      });
      const manager = form.elements.contact_name;
      manager.closest("label").hidden = signingIn;
      manager.disabled = signingIn;
      form.elements.password.autocomplete = signingIn ? "current-password" : "new-password";
      document.querySelector('[data-action="account"]').textContent = signingIn
        ? "Sign In & Continue"
        : "Create Account & Continue";
    } catch (error) {
      log("Unable to change account mode", error);
      throw error;
    }
  }

  function lockSignedIn(form, session) {
    try {
      form.elements.email.value = session.user.email;
      form.elements.email.readOnly = true;
      form.elements.password.disabled = true;
      document.querySelector(".auth-toggle").hidden = true;
      document.querySelector('[data-action="account"]').textContent = "Continue";
    } catch (error) {
      log("Unable to render signed-in account", error);
      throw error;
    }
  }

  function valid(form, name, message) {
    try {
      const field = form.elements[name];
      if (field?.checkValidity()) return { ok: true, message: "" };
      field?.setAttribute("aria-invalid", "true");
      field?.focus();
      return { ok: false, message };
    } catch (error) {
      log(`Unable to validate ${name}`, error);
      return { ok: false, message };
    }
  }

  async function authenticate(form, mode) {
    try {
      const emailCheck = valid(form, "email", "Enter a valid email address.");
      if (!emailCheck.ok) return { session: null, error: emailCheck.message };
      const passwordCheck = valid(form, "password", "Use a password with at least 8 characters.");
      if (!passwordCheck.ok) return { session: null, error: passwordCheck.message };
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      const result = mode === "signin"
        ? { session: await window.DDDProductionAuth.signIn(email, password) }
        : await window.DDDProductionAuth.signUp(email, password);
      return { session: result.session || null, error: null };
    } catch (error) {
      log("Authentication failed", error);
      return { session: null, error: error?.message || "We could not complete the account step." };
    }
  }

  window.DDDHostStartAccount = Object.freeze({ authenticate, lockSignedIn, setMode, valid });
})();