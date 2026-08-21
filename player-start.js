(() => {
  "use strict";
  let step = 1, authMode = "signup", signedIn = false, resumeMatching = false;
  let existingProfile = null;
  const params = new URLSearchParams(window.location.search);
  const editMode = params.get("edit") === "1";
  const form = () => document.getElementById("player-start-form");
  const byId = (id) => document.getElementById(id);
  const log = (message, error) => console.error(`[DDD Player Start] ${message}`, error);

  function announce(id, message, success = false) {
    const node = byId(id);
    if (!node) return;
    node.className = `form-status ${success ? "success-message" : "error-message"}`;
    node.textContent = message;
  }
  function rawValues() {
    const output = {};
    for (const [rawKey, value] of new FormData(form()).entries()) {
      const array = rawKey.endsWith("[]"), key = array ? rawKey.slice(0, -2) : rawKey;
      if (array) (output[key] ||= []).push(value); else output[key] = value;
    }
    return output;
  }
  function showReady(signals = []) {
    window.DDDPlayerStartSave.showReadyState(form(), document.querySelector(".start-progress"), byId("player-ready"), signals);
  }
  function showStep(next) {
    try {
      step = Math.max(editMode ? 3 : 1, Math.min(5, next));
      document.querySelectorAll(".start-step").forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
      byId("step-count").textContent = editMode ? `Update ${step - 2} of 3` : `Step ${step} of 5`;
      byId("progress-bar").style.width = editMode ? `${(step - 2) * 33.34}%` : `${step * 20}%`;
      if (step === 5) window.DDDPlayerStartSave.renderReview(byId("player-review"), rawValues(), editMode);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { log("Unable to change step", error); }
  }
  function fieldReady(name, message) {
    const result = window.DDDPlayerStartAccount.valid(form(), name, message);
    if (!result.ok) announce("auth-status", result.message);
    return result.ok;
  }
  function setAuthMode(mode) {
    authMode = mode;
    window.DDDPlayerStartAccount.setMode(form(), mode);
    announce("auth-status", "", true);
  }
  const availabilityReady = () => window.DDDPlayerStartSave.availabilityReady(form(), announce);
  const locationReady = () => window.DDDPlayerStartSave.locationReady(form(), announce);

  async function continueAfterAuth(session) {
    signedIn = true;
    window.DDDPlayerStartAccount.lockSignedIn(form(), session);
    announce("auth-status", `Signed in as ${session.user.email}.`, true);
    existingProfile = await window.DDDProductionAPI.getPlayerOnboardingOptional();
    if (existingProfile) {
      const current = window.DDDPlayerStartProfile.currentDemands(await window.DDDProductionAPI.getPlayerDemands());
      if (editMode) {
        if (window.DDDPlayerStartProfile.hydrate(form(), existingProfile)) {
          byId("conduct-check").checked = true;
          byId("conduct-check").closest("label").hidden = true;
          return showStep(3);
        }
        throw new Error("Saved Player availability could not be loaded safely.");
      }
      if (current.length) return showReady(current);
      resumeMatching = true;
      if (!window.DDDPlayerStartProfile.hydrate(form(), existingProfile)) throw new Error("Saved Player settings could not be loaded safely.");
      showStep(4);
      announce("area-status", "Your Player profile is saved. Review your travel area, then restart game matching.", true);
      return;
    }
    window.DDDPlayerStartAccount.enableDisplayName(form());
    if (form().elements.display_name.value.trim()) return showStep(2);
    announce("auth-status", "Signed in. Add the display name your table should see, then continue.", true);
    form().elements.display_name.focus();
  }

  async function handleAccount() {
    try {
      if (signedIn) { if (fieldReady("display_name", "Enter the name your table should see.")) showStep(2); return; }
      announce("auth-status", authMode === "signin" ? "Signing in…" : "Creating your account…", true);
      const result = await window.DDDPlayerStartAccount.authenticate(form(), authMode);
      if (result.error) return announce("auth-status", result.error);
      if (!result.session) return announce("auth-status", "Check your email to confirm your account. Then come back and choose Sign in.");
      await continueAfterAuth(result.session);
    } catch (error) {
      log("Account step failed", error);
      announce("auth-status", error?.message || "We could not complete the account step.");
    }
  }

  async function savePlayer(event) {
    event.preventDefault();
    try {
      if (!byId("conduct-check").checked) {
        byId("conduct-check").focus();
        return announce("save-status", "Please agree to the Code of Conduct first.");
      }
      announce("save-status", editMode ? "Updating your availability…" : resumeMatching ? "Restarting game matching…" : "Saving your availability and starting your game search…", true);
      const saved = resumeMatching
        ? await window.DDDPlayerStartProfile.activateMatching(existingProfile)
        : await window.DDDPlayerStartSave.persist({ editMode, existingProfile, values: rawValues() });
      if (saved?.matchingError) return announce("save-status", `Your profile saved, but game search could not start: ${saved.matchingError.message}`);
      showReady(saved?.signals || saved?.matching?.signals || []);
    } catch (error) {
      log("Unable to save Player availability", error);
      announce("save-status", error?.message || "We could not save your availability.");
    }
  }

  function bind() {
    document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
    document.querySelector('[data-action="account"]').addEventListener("click", () => void handleAccount());
    document.querySelectorAll(".back-button").forEach((button) => button.addEventListener("click", () => showStep(step - 1)));
    document.querySelectorAll(".next-button:not([data-action])").forEach((button) => button.addEventListener("click", () => {
      if (step === 3 && !availabilityReady()) return;
      if (step === 4 && !locationReady()) return;
      showStep(step + 1);
    }));
    form().addEventListener("submit", (event) => void savePlayer(event));
  }
  async function init() {
    try {
      bind();
      if (params.get("mode") === "signin") setAuthMode("signin");
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (session) await continueAfterAuth(session);
    } catch (error) {
      log("Unable to initialize Player start", error);
      announce("auth-status", error?.message || "Account service is temporarily unavailable.");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();