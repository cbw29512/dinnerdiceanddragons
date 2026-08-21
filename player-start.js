(() => {
  "use strict";

  let step = 1;
  let authMode = "signup";
  let signedIn = false;
  const form = () => document.getElementById("player-start-form");
  const byId = (id) => document.getElementById(id);

  function log(message, error) { console.error(`[DDD Player Start] ${message}`, error); }
  function announce(id, message, success = false) {
    const node = byId(id); if (!node) return;
    node.className = `form-status ${success ? "success-message" : "error-message"}`;
    node.textContent = message;
  }
  function showStep(next) {
    try {
      step = Math.max(1, Math.min(5, next));
      document.querySelectorAll(".start-step").forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
      byId("step-count").textContent = `Step ${step} of 5`;
      byId("progress-bar").style.width = `${step * 20}%`;
      if (step === 5) renderReview();
      document.querySelector(`[data-step="${step}"] h2`)?.focus?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { log("Unable to change step", error); }
  }
  function serialize() {
    const output = {};
    for (const [rawKey, value] of new FormData(form()).entries()) {
      const array = rawKey.endsWith("[]");
      const key = array ? rawKey.slice(0, -2) : rawKey;
      if (array) (output[key] ||= []).push(value);
      else output[key] = value;
    }
    return output;
  }
  function validField(selector, message) {
    const field = form().querySelector(selector);
    if (!field || field.checkValidity()) return true;
    field.setAttribute("aria-invalid", "true"); field.focus();
    announce(step === 4 ? "availability-status" : "auth-status", message);
    return false;
  }
  function setAuthMode(mode) {
    try {
      authMode = mode;
      document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("is-selected", button.dataset.authMode === mode));
      const password = form().querySelector('[name="password"]');
      password.autocomplete = mode === "signin" ? "current-password" : "new-password";
      document.querySelector('[data-action="account"]').textContent = mode === "signin" ? "Sign In & Continue" : "Create Account & Continue";
      announce("auth-status", "", true);
    } catch (error) { log("Unable to change account mode", error); }
  }
  async function handleAccount() {
    try {
      if (!validField('[name="display_name"]', "Enter the name your table should see.")) return;
      if (signedIn) return showStep(2);
      if (!validField('[name="email"]', "Enter a valid email address.")) return;
      if (!validField('[name="password"]', "Use a password with at least 8 characters.")) return;
      const email = form().elements.email.value.trim();
      const password = form().elements.password.value;
      announce("auth-status", authMode === "signin" ? "Signing in…" : "Creating your account…", true);
      const result = authMode === "signin"
        ? { session: await window.DDDProductionAuth.signIn(email, password) }
        : await window.DDDProductionAuth.signUp(email, password);
      if (!result.session) {
        announce("auth-status", "Check your email to confirm your account. Then come back and choose Sign in.");
        return;
      }
      signedIn = true;
      form().elements.email.readOnly = true;
      form().elements.password.disabled = true;
      announce("auth-status", `Signed in as ${result.session.user.email}.`, true);
      showStep(2);
    } catch (error) {
      log("Account step failed", error);
      announce("auth-status", error?.message || "We could not complete the account step.");
    }
  }
  function availabilityReady() {
    const fields = form().querySelectorAll('[name="availability_day[]"]');
    if (fields.length) return true;
    announce("availability-status", "Choose at least one time when you can play.");
    return false;
  }
  function locationReady() {
    const zip = form().elements.postal_code;
    const good = /^\d{5}$/.test(zip.value.trim());
    zip.setCustomValidity(good ? "" : "Enter a five-digit ZIP code.");
    if (good) return true;
    zip.focus(); return false;
  }
  function formatWindows(values) {
    const days = values.availability_day || [];
    return days.map((day, index) => `${day} ${values.availability_start?.[index] || ""}–${values.availability_end?.[index] || ""}`).join(" · ");
  }
  function renderReview() {
    try {
      const values = serialize();
      const rows = [
        ["Game", values.player_system?.[0] || "D&D 5e (2024)"],
        ["Available", formatWindows(values) || "No times selected"],
        ["Travel", `${values.radius || 25} miles from ${values.postal_code || "your ZIP"}`]
      ];
      const review = byId("player-review"); review.replaceChildren();
      for (const [label, value] of rows) {
        const row = document.createElement("div"); row.className = "review-row";
        const name = document.createElement("span"); name.textContent = label;
        const strong = document.createElement("strong"); strong.textContent = value;
        row.append(name, strong); review.append(row);
      }
    } catch (error) { log("Unable to render review", error); }
  }
  async function savePlayer(event) {
    event.preventDefault();
    try {
      if (!byId("conduct-check").checked) { byId("conduct-check").focus(); announce("save-status", "Please agree to the Code of Conduct first."); return; }
      announce("save-status", "Saving your availability and starting your game search…", true);
      const saved = await window.DDDProductionOnboarding.save("Player", serialize());
      if (saved.matchingError) { announce("save-status", `Your profile saved, but game search could not start: ${saved.matchingError.message}`); return; }
      form().hidden = true; document.querySelector(".start-progress").hidden = true; byId("player-ready").hidden = false;
    } catch (error) { log("Unable to activate Player search", error); announce("save-status", error?.message || "We could not save your game search."); }
  }
  async function init() {
    try {
      document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
      document.querySelector('[data-action="account"]').addEventListener("click", () => void handleAccount());
      document.querySelectorAll(".back-button").forEach((button) => button.addEventListener("click", () => showStep(step - 1)));
      document.querySelectorAll(".next-button:not([data-action])").forEach((button) => button.addEventListener("click", () => {
        if (step === 3 && !availabilityReady()) return;
        if (step === 4 && !locationReady()) return;
        showStep(step + 1);
      }));
      form().addEventListener("submit", (event) => void savePlayer(event));
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (session) {
        signedIn = true; form().elements.email.value = session.user.email; form().elements.email.readOnly = true; form().elements.password.disabled = true;
        document.querySelector(".auth-toggle").hidden = true; document.querySelector('[data-action="account"]').textContent = "Continue";
        announce("auth-status", `Signed in as ${session.user.email}.`, true);
      }
    } catch (error) { log("Unable to initialize Player start", error); announce("auth-status", "Account service is temporarily unavailable."); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else void init();
})();