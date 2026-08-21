(() => {
  "use strict";

  let step = 1;
  let authMode = "signup";
  let signedIn = false;
  const params = new URLSearchParams(window.location.search);
  const form = () => document.getElementById("dm-start-form");
  const byId = (id) => document.getElementById(id);
  const log = (message, error) => console.error(`[DDD DM Start] ${message}`, error);

  function announce(id, message, success = false) {
    const node = byId(id); if (!node) return;
    node.className = `form-status ${success ? "success-message" : "error-message"}`;
    node.textContent = message;
  }
  function showStep(next) {
    step = Math.max(1, Math.min(5, next));
    document.querySelectorAll(".start-step").forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
    byId("step-count").textContent = `Step ${step} of 5`;
    byId("progress-bar").style.width = `${step * 20}%`;
    if (step === 5) renderReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function values() {
    const output = {};
    for (const [rawKey, value] of new FormData(form()).entries()) {
      const array = rawKey.endsWith("[]");
      const key = array ? rawKey.slice(0, -2) : rawKey;
      if (array) (output[key] ||= []).push(value); else output[key] = value;
    }
    return output;
  }
  function setAuthMode(mode) {
    authMode = mode;
    const signingIn = mode === "signin";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("is-selected", button.dataset.authMode === mode));
    const display = form().elements.display_name;
    display.closest("label").hidden = signingIn;
    display.disabled = signingIn;
    form().elements.password.autocomplete = signingIn ? "current-password" : "new-password";
    document.querySelector('[data-action="account"]').textContent = signingIn ? "Sign In & Continue" : "Create Account & Continue";
  }
  function valid(name, message) {
    const field = form().elements[name];
    if (field?.checkValidity()) return true;
    field?.setAttribute("aria-invalid", "true"); field?.focus(); announce("auth-status", message); return false;
  }
  function showReady() {
    form().hidden = true; document.querySelector(".start-progress").hidden = true; byId("dm-ready").hidden = false;
  }
  async function afterAuth(session) {
    signedIn = true;
    form().elements.email.value = session.user.email;
    form().elements.email.readOnly = true;
    form().elements.password.disabled = true;
    document.querySelector(".auth-toggle").hidden = true;
    document.querySelector('[data-action="account"]').textContent = "Continue";
    announce("auth-status", `Signed in as ${session.user.email}.`, true);
    const existing = await window.DDDProductionAPI.getGMOnboardingOptional();
    if (existing) return showReady();
    form().elements.display_name.disabled = false;
    form().elements.display_name.closest("label").hidden = false;
    if (form().elements.display_name.value.trim()) showStep(2);
    else { announce("auth-status", "Signed in. Add the display name Players should see, then continue.", true); form().elements.display_name.focus(); }
  }
  async function account() {
    try {
      if (signedIn) { if (valid("display_name", "Enter the name Players should see.")) showStep(2); return; }
      if (authMode === "signup" && !valid("display_name", "Enter the name Players should see.")) return;
      if (!valid("email", "Enter a valid email address.")) return;
      if (!valid("password", "Use a password with at least 8 characters.")) return;
      announce("auth-status", authMode === "signin" ? "Signing in…" : "Creating your account…", true);
      const email = form().elements.email.value.trim(); const password = form().elements.password.value;
      const result = authMode === "signin" ? { session: await window.DDDProductionAuth.signIn(email, password) } : await window.DDDProductionAuth.signUp(email, password);
      if (!result.session) return announce("auth-status", "Check your email to confirm the account, then return and sign in.");
      await afterAuth(result.session);
    } catch (error) { log("Account step failed", error); announce("auth-status", error?.message || "We could not complete the account step."); }
  }
  function availabilityReady() {
    if (form().querySelectorAll('[name="availability_day[]"]').length) return true;
    announce("availability-status", "Choose at least one time when you can DM."); return false;
  }
  function tableReady() {
    const zip = form().elements.postal_code;
    if (!/^\d{5}$/.test(zip.value.trim())) { zip.focus(); return false; }
    if (Number(form().elements.maximum_players.value) >= Number(form().elements.minimum_players.value)) return true;
    form().elements.maximum_players.focus(); return false;
  }
  function renderReview() {
    const raw = values();
    const rows = [
      ["Game", `${raw.gm_system?.[0]} · ${raw.gm_format?.[0]}`],
      ["Available", (raw.availability_day || []).join(", ")],
      ["Travel", `${raw.radius} miles from ${raw.postal_code}`],
      ["Table size", `${raw.minimum_players}–${raw.maximum_players} Players`]
    ];
    const review = byId("dm-review"); review.replaceChildren();
    rows.forEach(([label, value]) => {
      const row = document.createElement("div"); row.className = "review-row";
      const name = document.createElement("span"); name.textContent = label;
      const strong = document.createElement("strong"); strong.textContent = value;
      row.append(name, strong); review.append(row);
    });
  }
  async function save(event) {
    event.preventDefault();
    try {
      if (!byId("conduct-check").checked) { byId("conduct-check").focus(); return announce("save-status", "Please agree to the Code of Conduct first."); }
      announce("save-status", "Saving your DM availability and looking for a table…", true);
      const saved = await window.DDDProductionOnboarding.save("Game Master", values());
      if (saved.matchingError) return announce("save-status", `Your DM profile saved, but table search could not start: ${saved.matchingError.message}`);
      showReady();
    } catch (error) { log("Unable to save DM setup", error); announce("save-status", error?.message || "We could not save your DM setup."); }
  }
  async function init() {
    try {
      document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
      document.querySelector('[data-action="account"]').addEventListener("click", () => void account());
      document.querySelectorAll(".back-button").forEach((button) => button.addEventListener("click", () => showStep(step - 1)));
      document.querySelectorAll(".next-button:not([data-action])").forEach((button) => button.addEventListener("click", () => {
        if (step === 3 && !availabilityReady()) return;
        if (step === 4 && !tableReady()) return;
        showStep(step + 1);
      }));
      form().addEventListener("submit", (event) => void save(event));
      if (params.get("mode") === "signin") setAuthMode("signin");
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (session) await afterAuth(session);
    } catch (error) { log("Unable to initialize DM setup", error); announce("auth-status", "Account service is temporarily unavailable."); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else void init();
})();