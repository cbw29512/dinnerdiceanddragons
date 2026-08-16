(() => {
  "use strict";

  const SUPPORTED_TYPES = new Set(["Player", "Game Master"]);

  class ProductionAuthRequiredError extends Error {
    constructor(message = "Sign in to save this profile to your DDD account.") {
      super(message);
      this.name = "ProductionAuthRequiredError";
      this.status = 401;
    }
  }

  function authStatusNode() {
    return document.getElementById("ddd-auth-status");
  }

  function announceAuth(message, success = false) {
    const node = authStatusNode();
    if (!node) return;
    node.className = `form-status ${success ? "success-message" : ""}`.trim();
    node.textContent = message;
  }

  function setAuthBusy(busy) {
    document.querySelectorAll("#ddd-auth-form button, #ddd-auth-form input").forEach((element) => {
      element.disabled = Boolean(busy);
    });
  }

  function syncProfileEmails(session) {
    const email = session?.user?.email || "";
    const signedIn = Boolean(session?.access_token);
    document.querySelectorAll('#player-form [name="email"], #gm-form [name="email"]').forEach((input) => {
      if (signedIn) input.value = email;
      input.readOnly = signedIn;
    });
  }

  function alignProductionControls() {
    const learning = document.querySelector('#player-form [name="willing_to_learn"]');
    if (!learning) return;
    Array.from(learning.options).forEach((option) => {
      if (option.textContent.trim() === "Maybe") option.remove();
    });
  }

  function renderSession(session, message = "") {
    const emailInput = document.getElementById("ddd-auth-email");
    const passwordInput = document.getElementById("ddd-auth-password");
    const signInButton = document.getElementById("ddd-sign-in");
    const createButton = document.getElementById("ddd-create-account");
    const signOutButton = document.getElementById("ddd-sign-out");
    const email = session?.user?.email || "";
    const signedIn = Boolean(session?.access_token);

    if (emailInput) {
      emailInput.disabled = signedIn;
      if (signedIn) emailInput.value = email;
    }
    if (passwordInput) {
      passwordInput.disabled = signedIn;
      if (signedIn) passwordInput.value = "";
    }
    if (signInButton) signInButton.hidden = signedIn;
    if (createButton) createButton.hidden = signedIn;
    if (signOutButton) signOutButton.hidden = !signedIn;

    syncProfileEmails(session);
    if (message) {
      announceAuth(message, signedIn);
    } else if (signedIn) {
      announceAuth(`Signed in as ${email}. Your Player and DM profiles use this same DDD account.`, true);
    } else {
      announceAuth("Sign in or create an account to save Player and DM profiles online.");
    }
  }

  async function ensureDDDIdentity() {
    const session = await window.DDDProductionAuth.getSession();
    if (!session) return null;
    return window.DDDProductionAPI.getMe();
  }

  async function handleSignIn(event) {
    event.preventDefault();
    const email = document.getElementById("ddd-auth-email")?.value || "";
    const password = document.getElementById("ddd-auth-password")?.value || "";
    let failureMessage = "";

    setAuthBusy(true);
    announceAuth("Signing in…");
    try {
      await window.DDDProductionAuth.signIn(email, password);
      await ensureDDDIdentity();
    } catch (error) {
      failureMessage = error?.message || "Sign in failed.";
    } finally {
      setAuthBusy(false);
      const current = await window.DDDProductionAuth.getSession();
      if (failureMessage && !current) {
        renderSession(null, failureMessage);
      } else {
        renderSession(current);
      }
    }
  }

  async function handleCreateAccount() {
    const email = document.getElementById("ddd-auth-email")?.value || "";
    const password = document.getElementById("ddd-auth-password")?.value || "";
    if (!email || !password) {
      announceAuth("Enter an email address and password first.");
      return;
    }

    setAuthBusy(true);
    announceAuth("Creating your account…");
    try {
      const result = await window.DDDProductionAuth.signUp(email, password);
      if (result.session) {
        await ensureDDDIdentity();
        renderSession(result.session, `Account created and signed in as ${result.session.user?.email || email}.`);
      } else {
        renderSession(null, "Account created. Check your email to confirm it, then return here and sign in.");
      }
    } catch (error) {
      renderSession(null, error?.message || "Account creation failed.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    setAuthBusy(true);
    try {
      await window.DDDProductionAuth.signOut();
      renderSession(null, "Signed out.");
    } finally {
      setAuthBusy(false);
    }
  }

  function browserTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    } catch {
      return "America/New_York";
    }
  }

  function isEnabled(type) {
    return SUPPORTED_TYPES.has(type) && Boolean(
      window.DDDProductionAuth &&
      window.DDDProductionAPI &&
      window.DDDProductionOnboardingAdapters
    );
  }

  async function save(type, rawValues) {
    if (!isEnabled(type)) {
      throw new Error(`Production onboarding is not available for ${type}.`);
    }

    const session = await window.DDDProductionAuth.getSession();
    if (!session) throw new ProductionAuthRequiredError();

    const options = { timezone: browserTimezone() };
    const mapped = type === "Player"
      ? window.DDDProductionOnboardingAdapters.player(rawValues, options)
      : window.DDDProductionOnboardingAdapters.gm(rawValues, options);

    const result = type === "Player"
      ? await window.DDDProductionAPI.putPlayerOnboarding(mapped.payload)
      : await window.DDDProductionAPI.putGMOnboarding(mapped.payload);

    return {
      shared: true,
      production: true,
      result,
      deferred: mapped.deferred,
      payload: mapped.payload
    };
  }

  async function init() {
    if (!window.DDDProductionAuth || !window.DDDProductionAPI) return;

    alignProductionControls();
    const form = document.getElementById("ddd-auth-form");
    const createButton = document.getElementById("ddd-create-account");
    const signOutButton = document.getElementById("ddd-sign-out");

    if (form) form.addEventListener("submit", handleSignIn);
    if (createButton) createButton.addEventListener("click", handleCreateAccount);
    if (signOutButton) signOutButton.addEventListener("click", handleSignOut);

    window.DDDProductionAuth.onAuthStateChange((session) => renderSession(session));

    try {
      const session = await window.DDDProductionAuth.init();
      if (session) await ensureDDDIdentity();
      renderSession(session);
    } catch (error) {
      renderSession(null, error?.message || "Online account sign-in is temporarily unavailable.");
    }
  }

  window.DDDProductionOnboarding = Object.freeze({
    ProductionAuthRequiredError,
    isEnabled,
    save,
    init,
    browserTimezone
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
