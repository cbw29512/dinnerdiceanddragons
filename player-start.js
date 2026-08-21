(() => {
  "use strict";

  let step = 1;
  let authMode = "signup";
  let signedIn = false;
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

  function showStep(next) {
    try {
      step = Math.max(editMode ? 3 : 1, Math.min(5, next));
      document.querySelectorAll(".start-step").forEach((node) => { node.hidden = Number(node.dataset.step) !== step; });
      byId("step-count").textContent = editMode ? `Update ${step - 2} of 3` : `Step ${step} of 5`;
      byId("progress-bar").style.width = editMode ? `${(step - 2) * 33.34}%` : `${step * 20}%`;
      if (step === 5) renderReview();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { log("Unable to change step", error); }
  }

  function rawValues() {
    const output = {};
    for (const [rawKey, value] of new FormData(form()).entries()) {
      const array = rawKey.endsWith("[]");
      const key = array ? rawKey.slice(0, -2) : rawKey;
      if (array) (output[key] ||= []).push(value); else output[key] = value;
    }
    return output;
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

  async function continueAfterAuth(session) {
    signedIn = true;
    window.DDDPlayerStartAccount.lockSignedIn(form(), session);
    announce("auth-status", `Signed in as ${session.user.email}.`, true);
    existingProfile = await window.DDDProductionAPI.getPlayerOnboardingOptional();
    if (existingProfile) {
      if (!editMode) return showReady();
      if (window.DDDPlayerStartProfile.hydrate(form(), existingProfile)) {
        byId("conduct-check").checked = true;
        byId("conduct-check").closest("label").hidden = true;
        return showStep(3);
      }
    }
    window.DDDPlayerStartAccount.enableDisplayName(form());
    if (form().elements.display_name.value.trim()) return showStep(2);
    announce("auth-status", "Signed in. Add the display name your table should see, then continue.", true);
    form().elements.display_name.focus();
  }

  async function handleAccount() {
    try {
      if (signedIn) {
        if (fieldReady("display_name", "Enter the name your table should see.")) showStep(2);
        return;
      }
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

  function availabilityReady() {
    if (form().querySelectorAll('[name="availability_day[]"]').length) return true;
    announce("availability-status", "Choose at least one time when you can play.");
    return false;
  }

  function locationReady() {
    const zip = form().elements.postal_code;
    const good = /^\d{5}$/.test(zip.value.trim());
    zip.setCustomValidity(good ? "" : "Enter a five-digit ZIP code.");
    if (good) { announce("area-status", "Travel area looks good.", true); return true; }
    zip.setAttribute("aria-invalid", "true");
    zip.focus();
    announce("area-status", "Enter a five-digit ZIP code.");
    return false;
  }

  function renderReview() {
    const values = rawValues();
    const windows = (values.availability_day || []).map((day, i) => `${day} ${values.availability_start?.[i] || ""}–${values.availability_end?.[i] || ""}`).join(" · ");
    const game = editMode ? "Game preferences unchanged" : (values.player_system?.[0] || "D&D 5e (2024)");
    const rows = [["Game", game], ["Available", windows || "No times selected"], ["Travel", `${values.radius || 25} miles from ${values.postal_code || "your ZIP"}`]];
    const review = byId("player-review");
    review.replaceChildren();
    for (const [label, value] of rows) {
      const row = document.createElement("div"); row.className = "review-row";
      const name = document.createElement("span"); name.textContent = label;
      const strong = document.createElement("strong"); strong.textContent = value;
      row.append(name, strong); review.append(row);
    }
  }

  function showReady() {
    form().hidden = true;
    document.querySelector(".start-progress").hidden = true;
    byId("player-ready").hidden = false;
  }

  async function savePlayer(event) {
    event.preventDefault();
    try {
      if (!byId("conduct-check").checked) { byId("conduct-check").focus(); return announce("save-status", "Please agree to the Code of Conduct first."); }
      announce("save-status", editMode ? "Updating your availability…" : "Saving your availability and starting your game search…", true);
      if (editMode && existingProfile) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const payload = window.DDDPlayerStartProfile.updatePayload(existingProfile, rawValues(), timezone);
        await window.DDDProductionAPI.putPlayerOnboarding(payload);
        await window.DDDProductionMatching.syncAndFind("Player", { payload, deferred: { table_style_preference: null } }, rawValues());
      } else {
        const saved = await window.DDDProductionOnboarding.save("Player", rawValues());
        if (saved.matchingError) return announce("save-status", `Your profile saved, but game search could not start: ${saved.matchingError.message}`);
      }
      showReady();
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
      announce("auth-status", "Account service is temporarily unavailable.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();
