(() => {
  "use strict";

  let step = 1;
  let authMode = "signup";
  let signedIn = false;
  const params = new URLSearchParams(window.location.search);
  const addingAnotherVenue = params.get("new") === "1";
  const form = () => document.getElementById("venue-start-form");
  const byId = (id) => document.getElementById(id);
  const log = (message, error) => console.error(`[DDD Venue Start] ${message}`, error);

  function announce(id, message, success = false) {
    const node = byId(id);
    if (!node) return;
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
      const isArray = rawKey.endsWith("[]");
      const key = isArray ? rawKey.slice(0, -2) : rawKey;
      if (isArray) (output[key] ||= []).push(value);
      else output[key] = value;
    }
    return output;
  }

  function setAuthMode(mode) {
    authMode = mode;
    const signingIn = mode === "signin";
    document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("is-selected", button.dataset.authMode === mode));
    const manager = form().elements.contact_name;
    manager.closest("label").hidden = signingIn;
    manager.disabled = signingIn;
    form().elements.password.autocomplete = signingIn ? "current-password" : "new-password";
    document.querySelector('[data-action="account"]').textContent = signingIn ? "Sign In & Continue" : "Create Account & Continue";
  }

  function valid(name, message, statusId) {
    const field = form().elements[name];
    if (field?.checkValidity()) return true;
    field?.setAttribute("aria-invalid", "true");
    field?.focus();
    announce(statusId, message);
    return false;
  }

  function showExistingVenueManager() {
    try {
      form().hidden = true;
      document.querySelector(".start-progress").hidden = true;
      const ready = byId("venue-ready");
      ready.hidden = false;
      ready.querySelector(".eyebrow").textContent = "VENUE HOST ACCOUNT";
      ready.querySelector("h2").textContent = "Your account already manages a venue in DDD.";
      ready.querySelector("p:not(.eyebrow)").textContent = "Open My DDD for your game-night status, or explicitly add another public venue if you manage more than one location.";
      const actions = ready.querySelector(".step-actions");
      if (!actions.querySelector("[data-add-another-venue]")) {
        const add = document.createElement("a");
        add.className = "button secondary";
        add.href = "host.html?new=1";
        add.dataset.addAnotherVenue = "true";
        add.textContent = "Add Another Venue";
        actions.append(add);
      }
    } catch (error) {
      log("Unable to show returning venue state", error);
      throw error;
    }
  }

  async function afterAuth(session) {
    signedIn = true;
    form().elements.email.value = session.user.email;
    form().elements.email.readOnly = true;
    form().elements.password.disabled = true;
    document.querySelector(".auth-toggle").hidden = true;
    document.querySelector('[data-action="account"]').textContent = "Continue";
    announce("auth-status", `Signed in as ${session.user.email}.`, true);
    if (!addingAnotherVenue) {
      const me = await window.DDDProductionAPI.getMe();
      if ((me?.roles || []).includes("venue_manager")) return showExistingVenueManager();
    }
    form().elements.contact_name.disabled = false;
    form().elements.contact_name.closest("label").hidden = false;
    if (form().elements.contact_name.value.trim()) showStep(2);
    else {
      announce("auth-status", "Signed in. Add the host or manager name for this venue, then continue.", true);
      form().elements.contact_name.focus();
    }
  }

  async function account() {
    try {
      if (signedIn) {
        if (valid("contact_name", "Enter the host or manager name.", "auth-status")) showStep(2);
        return;
      }
      if (authMode === "signup" && !valid("contact_name", "Enter the host or manager name.", "auth-status")) return;
      if (!valid("email", "Enter a valid email address.", "auth-status")) return;
      if (!valid("password", "Use a password with at least 8 characters.", "auth-status")) return;
      announce("auth-status", authMode === "signin" ? "Signing in…" : "Creating your account…", true);
      const email = form().elements.email.value.trim();
      const password = form().elements.password.value;
      const result = authMode === "signin" ? { session: await window.DDDProductionAuth.signIn(email, password) } : await window.DDDProductionAuth.signUp(email, password);
      if (!result.session) return announce("auth-status", "Check your email to confirm the account, then return and sign in.");
      await afterAuth(result.session);
    } catch (error) {
      log("Account step failed", error);
      announce("auth-status", error?.message || "We could not complete the account step.");
    }
  }

  function venueReady() {
    const fields = [
      ["business_name", "Enter the public venue name."], ["address", "Enter the public street address."],
      ["city", "Enter the city."], ["state", "Enter a two-letter state code."], ["postal_code", "Enter a five-digit ZIP code."]
    ];
    for (const [name, message] of fields) if (!valid(name, message, "venue-details-status")) return false;
    announce("venue-details-status", "Public venue location looks good.", true);
    return true;
  }

  function availabilityReady() {
    if (form().querySelectorAll('[name="availability_day[]"]').length) return true;
    announce("availability-status", "Choose at least one time when this venue can host a game.");
    return false;
  }

  function renderReview() {
    const raw = values();
    const rows = [
      ["Venue", raw.business_name], ["Address", `${raw.address}, ${raw.city}, ${raw.state} ${raw.postal_code}`],
      ["Available", (raw.availability_day || []).join(", ")], ["Capacity", `${raw.table_count} table(s) · ${raw.seats_per_table} seats each`],
      ["Status", "Saved now; matching begins after verification"]
    ];
    const review = byId("venue-review");
    review.replaceChildren();
    rows.forEach(([label, value]) => {
      const row = document.createElement("div");
      row.className = "review-row";
      const name = document.createElement("span");
      name.textContent = label;
      const strong = document.createElement("strong");
      strong.textContent = value;
      row.append(name, strong);
      review.append(row);
    });
  }

  async function save(event) {
    event.preventDefault();
    try {
      if (!byId("conduct-check").checked) {
        byId("conduct-check").focus();
        return announce("save-status", "Please confirm the Code of Conduct and your authority to offer this venue.");
      }
      announce("save-status", "Saving your venue and table availability…", true);
      const saved = await window.DDDProductionOnboarding.save("Venue", values());
      form().hidden = true;
      document.querySelector(".start-progress").hidden = true;
      byId("venue-ready").hidden = false;
      if (!saved.pendingVerification) byId("venue-ready").querySelector("h2").textContent = "Your venue is ready for DDD matching.";
    } catch (error) {
      log("Unable to save venue", error);
      announce("save-status", error?.message || "We could not save this venue.");
    }
  }

  async function init() {
    try {
      document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
      document.querySelector('[data-action="account"]').addEventListener("click", () => void account());
      document.querySelectorAll(".back-button").forEach((button) => button.addEventListener("click", () => showStep(step - 1)));
      document.querySelectorAll(".next-button:not([data-action])").forEach((button) => button.addEventListener("click", () => {
        if (step === 2 && !venueReady()) return;
        if (step === 3 && !availabilityReady()) return;
        showStep(step + 1);
      }));
      form().addEventListener("submit", (event) => void save(event));
      if (params.get("mode") === "signin") setAuthMode("signin");
      await window.DDDProductionAuth.init();
      const session = await window.DDDProductionAuth.getSession();
      if (session) await afterAuth(session);
    } catch (error) {
      log("Unable to initialize venue setup", error);
      announce("auth-status", error?.message || "Account service is temporarily unavailable.");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else void init();
})();