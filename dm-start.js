(() => {
  "use strict";

  let step = 1;
  let authMode = "signup";
  let signedIn = false;
  let existingProfile = null;
  let existingSupplies = [];
  const params = new URLSearchParams(window.location.search);
  const editMode = params.get("edit") === "1";
  const form = () => document.getElementById("dm-start-form");
  const byId = (id) => document.getElementById(id);
  const log = (message, error) => console.error(`[DDD DM Start] ${message}`, error);

  function announce(id, message, success = false) {
    const node = byId(id);
    if (!node) return;
    node.className = `form-status ${success ? "success-message" : "error-message"}`;
    node.textContent = message;
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

  function showReady() {
    window.DDDDMStartSave.showReady(form(), document.querySelector(".start-progress"), byId("dm-ready"));
  }

  function showStep(next) {
    try {
      step = Math.max(editMode ? 3 : 1, Math.min(5, next));
      document.querySelectorAll(".start-step").forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
      byId("step-count").textContent = editMode ? `Update ${step - 2} of 3` : `Step ${step} of 5`;
      byId("progress-bar").style.width = editMode ? `${(step - 2) * 33.34}%` : `${step * 20}%`;
      if (step === 5) window.DDDDMStartSave.renderReview(byId("dm-review"), values(), editMode);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { log("Unable to change DM step", error); }
  }

  function fieldReady(name, message) {
    const result = window.DDDDMStartAccount.valid(form(), name, message);
    if (!result.ok) announce("auth-status", result.message);
    return result.ok;
  }

  function setAuthMode(mode) {
    authMode = mode;
    window.DDDDMStartAccount.setMode(form(), mode);
  }

  async function afterAuth(session) {
    signedIn = true;
    window.DDDDMStartAccount.lockSignedIn(form(), session);
    announce("auth-status", `Signed in as ${session.user.email}.`, true);
    existingProfile = await window.DDDProductionAPI.getGMOnboardingOptional();
    if (existingProfile) {
      if (!editMode) return showReady();
      existingSupplies = await window.DDDProductionAPI.getGMSupplies();
      window.DDDDMStartSave.configureEditUi(form(), byId("conduct-check"));
      if (window.DDDDMStartProfile.hydrate(form(), existingProfile)) return showStep(3);
      throw new Error("Saved DM availability could not be loaded safely.");
    }
    window.DDDDMStartAccount.enableDisplayName(form());
    if (form().elements.display_name.value.trim()) return showStep(2);
    announce("auth-status", "Signed in. Add the display name Players should see, then continue.", true);
    form().elements.display_name.focus();
  }

  async function account() {
    try {
      if (signedIn) {
        if (fieldReady("display_name", "Enter the name Players should see.")) showStep(2);
        return;
      }
      announce("auth-status", authMode === "signin" ? "Signing in…" : "Creating your account…", true);
      const result = await window.DDDDMStartAccount.authenticate(form(), authMode);
      if (result.error) return announce("auth-status", result.error);
      if (!result.session) return announce("auth-status", "Check your email to confirm the account, then return and sign in.");
      await afterAuth(result.session);
    } catch (error) {
      log("Account step failed", error);
      announce("auth-status", error?.message || "We could not complete the account step.");
    }
  }

  function availabilityReady() {
    if (form().querySelectorAll('[name="availability_day[]"]').length) return true;
    announce("availability-status", "Choose at least one time when you can DM.");
    return false;
  }

  function tableReady() {
    const zip = form().elements.postal_code;
    if (!/^\d{5}$/.test(zip.value.trim())) {
      zip.setCustomValidity("Enter a five-digit ZIP code.");
      zip.setAttribute("aria-invalid", "true");
      zip.focus();
      announce("table-status", "Enter a five-digit ZIP code.");
      return false;
    }
    zip.setCustomValidity("");
    if (editMode) { announce("table-status", "Travel area looks good.", true); return true; }
    const minimum = Number(form().elements.minimum_players.value);
    const maximum = Number(form().elements.maximum_players.value);
    if (maximum < minimum) {
      form().elements.maximum_players.focus();
      announce("table-status", "Maximum Players must be at least the minimum Player count.");
      return false;
    }
    announce("table-status", "Table size and travel area look good.", true);
    return true;
  }

  async function save(event) {
    event.preventDefault();
    try {
      if (!editMode && !byId("conduct-check").checked) {
        byId("conduct-check").focus();
        return announce("save-status", "Please agree to the Code of Conduct first.");
      }
      announce("save-status", editMode ? "Updating your DM availability…" : "Saving your DM availability and looking for a table…", true);
      const saved = await window.DDDDMStartSave.persist({ editMode, existingProfile, existingSupplies, values: values() });
      if (saved?.matchingError) return announce("save-status", `Your DM profile saved, but table search could not start: ${saved.matchingError.message}`);
      showReady();
    } catch (error) {
      log("Unable to save DM setup", error);
      announce("save-status", error?.message || "We could not save your DM setup.");
    }
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
    } catch (error) {
      log("Unable to initialize DM setup", error);
      announce("auth-status", error?.message || "Account service is temporarily unavailable.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
